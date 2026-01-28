import {
    EventEmitter,
    createLogger,
    createPlayerError,
    ErrorCode,
    type QualityLevel,
    type MediaSourceConfig,
    type PlayerError,
    type Unsubscribe,
    detectPlatform,
} from 'aspect-player-shared';
import type { SegmentTiming } from 'aspect-player-core';
import type { SourceAdapter, SourceAdapterConfig, SegmentLoadedCallback, ErrorCallback } from './types';

// dashjs type imports
import type {
    MediaPlayerClass,
    BitrateInfo,
    MediaPlayerSettingClass,
} from 'dashjs';

const logger = createLogger('dash-adapter');

/**
 * DASH-specific adapter configuration.
 */
export interface DASHAdapterConfig extends SourceAdapterConfig {
    /** Enable low-latency DASH */
    lowLatency?: boolean;
    /** Override dash.js settings */
    dashSettings?: Partial<MediaPlayerSettingClass>;
}

/**
 * DASH Adapter Events.
 */
interface DASHAdapterEvents {
    segmentLoaded: SegmentTiming;
    error: PlayerError;
    qualityChange: { level: number; auto: boolean };
}

/**
 * DASH Adapter using dash.js with custom ABR integration.
 */
export class DASHAdapter implements SourceAdapter {
    readonly name = 'dash';
    readonly usesMSE = true;

    private readonly config: DASHAdapterConfig;
    private readonly events = new EventEmitter<DASHAdapterEvents>();
    private readonly platform = detectPlatform();

    private dashPlayer: MediaPlayerClass | null = null;
    private _video: HTMLVideoElement | null = null;
    private levels: QualityLevel[] = [];
    private currentLevelIndex = -1;
    private _manualLevelIndex = -1;

    private readonly segmentCallbacks: SegmentLoadedCallback[] = [];
    private readonly errorCallbacks: ErrorCallback[] = [];

    private destroyed = false;
    private dashjs: typeof import('dashjs') | null = null;

    constructor(config: DASHAdapterConfig = {}) {
        this.config = config;
        logger.debug('DASHAdapter created');
    }

    /**
     * Check if dash.js is supported.
     */
    static isSupported(): boolean {
        return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"');
    }

    async attach(video: HTMLVideoElement): Promise<void> {
        this.assertNotDestroyed();
        this._video = video;

        logger.debug('Attaching to video element');

        // Dynamically import dashjs
        this.dashjs = await import('dashjs');

        // Create dash.js player
        this.dashPlayer = this.dashjs.MediaPlayer().create();

        // Apply settings
        this.applySettings();

        // Initialize (don't auto-play)
        this.dashPlayer.initialize(video, undefined, false);

        // Setup event handlers
        this.setupEventHandlers();
    }

    async load(config: MediaSourceConfig): Promise<void> {
        this.assertNotDestroyed();

        if (this.dashPlayer === null) {
            throw new Error('DASH adapter not attached');
        }

        logger.info(`Loading DASH source: ${config.url.substring(0, 60)}...`);

        // Attach source
        this.dashPlayer.attachSource(config.url);

        // Wait for stream initialized
        return new Promise<void>((resolve, reject) => {
            if (this.dashPlayer === null || this.dashjs === null) {
                reject(new Error('Player not initialized'));
                return;
            }

            const onStreamInitialized = (): void => {
                this.dashPlayer?.off(this.dashjs!.MediaPlayer.events.STREAM_INITIALIZED, onStreamInitialized);
                this.dashPlayer?.off(this.dashjs!.MediaPlayer.events.ERROR, onError);

                // Build quality levels
                this.buildQualityLevels();

                // Apply start position if specified
                if (config.startPosition !== undefined && config.startPosition > 0) {
                    this.dashPlayer?.seek(config.startPosition);
                }

                // Apply preferred quality if specified
                if (config.preferredQuality !== undefined && config.preferredQuality >= 0) {
                    this.setQualityLevel(config.preferredQuality);
                }

                resolve();
            };

            const onError = (e: unknown): void => {
                this.dashPlayer?.off(this.dashjs!.MediaPlayer.events.STREAM_INITIALIZED, onStreamInitialized);
                this.dashPlayer?.off(this.dashjs!.MediaPlayer.events.ERROR, onError);
                reject(this.mapDashError(e));
            };

            this.dashPlayer.on(this.dashjs.MediaPlayer.events.STREAM_INITIALIZED, onStreamInitialized);
            this.dashPlayer.on(this.dashjs.MediaPlayer.events.ERROR, onError);
        });
    }

    getQualityLevels(): QualityLevel[] {
        return this.levels;
    }

    setQualityLevel(index: number): void {
        if (this.dashPlayer === null) return;

        if (index < 0) {
            // Auto quality
            this._manualLevelIndex = -1;
            this.dashPlayer.updateSettings({
                streaming: {
                    abr: {
                        autoSwitchBitrate: { video: true, audio: true },
                    },
                },
            });
            logger.debug('ABR enabled (auto quality)');
        } else if (index < this.levels.length) {
            // Manual quality lock
            this._manualLevelIndex = index;
            this.dashPlayer.updateSettings({
                streaming: {
                    abr: {
                        autoSwitchBitrate: { video: false, audio: false },
                    },
                },
            });
            this.dashPlayer.setQualityFor('video', index, true);
            logger.debug(`Quality locked to level ${index}`);
        }
    }

    getCurrentQualityLevel(): number {
        return this.currentLevelIndex;
    }

    onSegmentLoaded(callback: SegmentLoadedCallback): Unsubscribe {
        this.segmentCallbacks.push(callback);
        return () => {
            const idx = this.segmentCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.segmentCallbacks.splice(idx, 1);
            }
        };
    }

    onError(callback: ErrorCallback): Unsubscribe {
        this.errorCallbacks.push(callback);
        return () => {
            const idx = this.errorCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.errorCallbacks.splice(idx, 1);
            }
        };
    }

    destroy(): void {
        if (this.destroyed) return;

        logger.debug('Destroying DASHAdapter');
        this.destroyed = true;

        if (this.dashPlayer !== null) {
            this.dashPlayer.reset();
            this.dashPlayer = null;
        }

        this._video = null;
        this.levels = [];
        this.segmentCallbacks.length = 0;
        this.errorCallbacks.length = 0;
        this.events.removeAllListeners();
    }

    /**
     * Apply dash.js settings.
     */
    private applySettings(): void {
        if (this.dashPlayer === null) return;

        const isMobile = this.platform.isMobile || this.platform.isTablet;

        const settings: Partial<MediaPlayerSettingClass> = {
            debug: {
                logLevel: this.config.debug ? 4 : 0, // 4 = DEBUG, 0 = NONE
            },
            streaming: {
                buffer: {
                    fastSwitchEnabled: true,
                    bufferTimeAtTopQuality: isMobile ? 15 : 30,
                    bufferTimeAtTopQualityLongForm: isMobile ? 20 : 40,
                    stableBufferTime: isMobile ? 12 : 20,
                    bufferToKeep: isMobile ? 20 : 30,
                    bufferPruningInterval: 10,
                },
                abr: {
                    autoSwitchBitrate: { video: true, audio: true },
                    limitBitrateByPortal: false,
                    useDefaultABRRules: true,
                    bandwidthSafetyFactor: isMobile ? 0.6 : 0.8,
                },
                retryAttempts: {
                    MPD: 3,
                    MediaSegment: 4,
                    InitializationSegment: 3,
                    BitstreamSwitchingSegment: 3,
                    IndexSegment: 3,
                },
                retryIntervals: {
                    MPD: 1000,
                    MediaSegment: 1000,
                    InitializationSegment: 1000,
                    BitstreamSwitchingSegment: 1000,
                    IndexSegment: 1000,
                },
            },
        };

        // Merge with user settings
        if (this.config.dashSettings !== undefined) {
            this.deepMerge(settings, this.config.dashSettings);
        }

        this.dashPlayer.updateSettings(settings);
    }

    /**
     * Setup dash.js event handlers.
     */
    private setupEventHandlers(): void {
        if (this.dashPlayer === null || this.dashjs === null) return;

        // Fragment loaded - report timing for ABR
        this.dashPlayer.on(this.dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, (e: unknown) => {
            const event = e as { request?: { bytesTotal?: number; duration?: number }; startDate?: number; endDate?: number };
            if (event.request !== undefined && event.startDate !== undefined && event.endDate !== undefined) {
                const timing: SegmentTiming = {
                    bytes: event.request.bytesTotal ?? 0,
                    durationMs: event.endDate - event.startDate,
                    segmentDuration: event.request.duration ?? 0,
                };

                for (const callback of this.segmentCallbacks) {
                    try {
                        callback(timing);
                    } catch (err) {
                        logger.error('Segment callback error:', err);
                    }
                }
            }
        });

        // Quality changed
        this.dashPlayer.on(this.dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, (e: unknown) => {
            const event = e as { mediaType?: string; newQuality?: number };
            if (event.mediaType === 'video' && event.newQuality !== undefined) {
                this.currentLevelIndex = event.newQuality;
                logger.debug(`Quality changed to level ${event.newQuality}`);
            }
        });

        // Error handling
        this.dashPlayer.on(this.dashjs.MediaPlayer.events.ERROR, (e: unknown) => {
            const error = this.mapDashError(e);
            logger.error('DASH error:', error.message);

            for (const callback of this.errorCallbacks) {
                try {
                    callback(error);
                } catch (err) {
                    logger.error('Error callback error:', err);
                }
            }
        });
    }

    /**
     * Build quality levels from dash.js bitrate info.
     */
    private buildQualityLevels(): void {
        if (this.dashPlayer === null) return;

        const bitrateList = this.dashPlayer.getBitrateInfoListFor('video') as BitrateInfo[];

        this.levels = bitrateList.map((info, index) => ({
            index,
            bitrate: info.bitrate,
            width: info.width ?? 0,
            height: info.height ?? 0,
            codec: undefined,
            frameRate: undefined,
            label: this.buildQualityLabel(info),
        }));

        this.levels.sort((a, b) => a.bitrate - b.bitrate);

        logger.debug(`Quality levels built: ${this.levels.length} levels`);
    }

    /**
     * Build human-readable quality label.
     */
    private buildQualityLabel(info: BitrateInfo): string {
        const height = info.height ?? 0;
        if (height > 0) {
            if (height >= 2160) return '4K';
            if (height >= 1440) return '1440p';
            if (height >= 1080) return '1080p';
            if (height >= 720) return '720p';
            if (height >= 480) return '480p';
            if (height >= 360) return '360p';
            return `${height}p`;
        }

        const kbps = Math.round(info.bitrate / 1000);
        if (kbps >= 1000) {
            return `${(kbps / 1000).toFixed(1)} Mbps`;
        }
        return `${kbps} Kbps`;
    }

    /**
     * Map dash.js error to PlayerError.
     */
    private mapDashError(e: unknown): PlayerError {
        const event = e as { error?: { code?: number; message?: string; data?: unknown } };
        const errorData = event.error;

        if (errorData === undefined) {
            return createPlayerError(ErrorCode.UNKNOWN_ERROR, 'Unknown DASH error');
        }

        const code = errorData.code;
        const message = errorData.message ?? 'DASH error';

        // Map common dash.js error codes
        if (code !== undefined) {
            // Network errors (1-99)
            if (code >= 1 && code < 100) {
                return createPlayerError(ErrorCode.NETWORK_HTTP_ERROR, message, undefined, { dashCode: code });
            }
            // Parse errors (100-199)
            if (code >= 100 && code < 200) {
                return createPlayerError(ErrorCode.MANIFEST_PARSE_ERROR, message, undefined, { dashCode: code });
            }
            // Media errors (200-299)
            if (code >= 200 && code < 300) {
                return createPlayerError(ErrorCode.DECODE_MEDIA_ERROR, message, undefined, { dashCode: code });
            }
        }

        return createPlayerError(ErrorCode.UNKNOWN_ERROR, message, undefined, { dashCode: code });
    }

    /**
     * Deep merge objects.
     */
    private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
        for (const key of Object.keys(source)) {
            const sourceValue = source[key];
            const targetValue = target[key];

            if (
                sourceValue !== null &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue) &&
                targetValue !== null &&
                typeof targetValue === 'object' &&
                !Array.isArray(targetValue)
            ) {
                this.deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
            } else {
                target[key] = sourceValue;
            }
        }
    }

    private assertNotDestroyed(): void {
        if (this.destroyed) {
            throw new Error('DASHAdapter has been destroyed');
        }
    }
}
