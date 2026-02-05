import Hls from 'hls.js';
import type { HlsConfig, Level, ErrorData, FragLoadedData, LevelSwitchedData } from 'hls.js';
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
    type SubtitleTrack,
} from 'aspect-player-shared';
import type { SegmentTiming } from 'aspect-player-core';
import type { SourceAdapter, SourceAdapterConfig, SegmentLoadedCallback, ErrorCallback, SubtitleTracksCallback, LiveStreamInfo } from './types';

const logger = createLogger('hls-adapter');

/**
 * HLS-specific adapter configuration.
 */
export interface HLSAdapterConfig extends SourceAdapterConfig {
    /** Enable low-latency HLS */
    lowLatency?: boolean;
    /** Override hls.js config */
    hlsConfig?: Partial<HlsConfig>;
}

/**
 * HLS Adapter Events.
 */
interface HLSAdapterEvents {
    segmentLoaded: SegmentTiming;
    error: PlayerError;
    qualityChange: { level: number; auto: boolean };
}

/**
 * HLS Adapter using hls.js with custom ABR integration.
 *
 * Key behaviors:
 * - Overrides default hls.js ABR for integration with our ABR controller
 * - Custom segment loader configuration for retry logic
 * - Buffer management integrated with our buffer manager
 */
export class HLSAdapter implements SourceAdapter {
    readonly name = 'hls';
    readonly usesMSE = true;

    private readonly config: HLSAdapterConfig;
    private readonly events = new EventEmitter<HLSAdapterEvents>();
    private readonly platform = detectPlatform();

    private hls: Hls | null = null;
    private _video: HTMLVideoElement | null = null;
    private levels: QualityLevel[] = [];
    private currentLevelIndex = -1;
    private _manualLevelIndex = -1;

    private readonly segmentCallbacks: SegmentLoadedCallback[] = [];
    private readonly errorCallbacks: ErrorCallback[] = [];
    private readonly subtitleCallbacks: SubtitleTracksCallback[] = [];

    private subtitleTracks: SubtitleTrack[] = [];
    private currentSubtitleTrackId: string | null = null;

    private destroyed = false;
    private startPosition = 0;

    constructor(config: HLSAdapterConfig = {}) {
        this.config = config;
        logger.debug('HLSAdapter created');
    }

    /**
     * Check if HLS.js is supported on this platform.
     */
    static isSupported(): boolean {
        return Hls.isSupported();
    }

    async attach(video: HTMLVideoElement): Promise<void> {
        this.assertNotDestroyed();
        this._video = video;

        logger.debug('Attaching to video element');

        // Create hls.js instance with custom config
        this.hls = new Hls(this.buildHlsConfig());

        // Attach to video element
        this.hls.attachMedia(video);

        // Setup event handlers
        this.setupEventHandlers();

        // Wait for media attached
        return new Promise<void>((resolve, reject) => {
            const onAttached = (): void => {
                this.hls?.off(Hls.Events.MEDIA_ATTACHED, onAttached);
                this.hls?.off(Hls.Events.ERROR, onError);
                resolve();
            };

            const onError = (_: unknown, data: ErrorData): void => {
                if (data.fatal) {
                    this.hls?.off(Hls.Events.MEDIA_ATTACHED, onAttached);
                    this.hls?.off(Hls.Events.ERROR, onError);
                    reject(this.mapHlsError(data));
                }
            };

            this.hls?.on(Hls.Events.MEDIA_ATTACHED, onAttached);
            this.hls?.on(Hls.Events.ERROR, onError);
        });
    }

    async load(config: MediaSourceConfig): Promise<void> {
        this.assertNotDestroyed();

        if (this.hls === null) {
            throw new Error('HLS adapter not attached');
        }

        logger.info(`Loading HLS source: ${config.url.substring(0, 60)}...`);

        // Set start position if specified
        if (config.startPosition !== undefined && config.startPosition > 0) {
            this.startPosition = config.startPosition;
        }

        // Load the source
        this.hls.loadSource(config.url);

        // Wait for manifest parsed
        return new Promise<void>((resolve, reject) => {
            const onManifestParsed = (): void => {
                this.hls?.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
                this.hls?.off(Hls.Events.ERROR, onError);

                // Build quality levels from parsed manifest
                this.buildQualityLevels();

                // Apply preferred quality if specified
                if (config.preferredQuality !== undefined && config.preferredQuality >= 0) {
                    this.setQualityLevel(config.preferredQuality);
                }

                resolve();
            };

            const onError = (_: unknown, data: ErrorData): void => {
                if (data.fatal) {
                    this.hls?.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
                    this.hls?.off(Hls.Events.ERROR, onError);
                    reject(this.mapHlsError(data));
                }
            };

            if (this.hls !== null) {
                this.hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
                this.hls.on(Hls.Events.ERROR, onError);
            }
        });
    }

    getQualityLevels(): QualityLevel[] {
        return this.levels;
    }

    setQualityLevel(index: number): void {
        if (this.hls === null) return;

        if (index < 0) {
            // Auto quality
            this._manualLevelIndex = -1;
            this.hls.currentLevel = -1;
            this.hls.nextLevel = -1;
            logger.debug('ABR enabled (auto quality)');
        } else if (index < this.levels.length) {
            // Manual quality lock
            this._manualLevelIndex = index;
            this.hls.currentLevel = index;
            this.hls.nextLevel = index;
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

    getSubtitleTracks(): SubtitleTrack[] {
        return this.subtitleTracks;
    }

    setSubtitleTrack(trackId: string | null): void {
        if (this.hls === null) return;

        if (trackId === null) {
            this.hls.subtitleTrack = -1;
            this.currentSubtitleTrackId = null;
        } else {
            const index = this.subtitleTracks.findIndex(t => t.id === trackId);
            if (index !== -1) {
                this.hls.subtitleTrack = index;
                this.currentSubtitleTrackId = trackId;
            }
        }
    }

    onSubtitleTracksChanged(callback: SubtitleTracksCallback): Unsubscribe {
        this.subtitleCallbacks.push(callback);
        // Immediately invoke with current tracks if available
        if (this.subtitleTracks.length > 0) {
            callback(this.subtitleTracks);
        }
        return () => {
            const idx = this.subtitleCallbacks.indexOf(callback);
            if (idx >= 0) {
                this.subtitleCallbacks.splice(idx, 1);
            }
        };
    }

    getLiveInfo(): LiveStreamInfo | undefined {
        if (this.hls === null || this._video === null) return undefined;

        // Get the current level details
        const levelDetails = this.hls.levels[this.hls.currentLevel]?.details;
        if (!levelDetails) return undefined;

        // Check if live stream
        const isLive = levelDetails.live;
        if (!isLive) return undefined;

        // Live edge is the end of the sliding window
        const liveEdge = levelDetails.edge ?? this._video.duration;

        // Current latency from live edge
        const currentTime = this._video.currentTime;
        const latency = Math.max(0, liveEdge - currentTime);

        // DVR window - how far back we can seek from the live edge
        const dvrWindow = levelDetails.totalduration ?? 0;
        const hasDVR = dvrWindow > 30; // Consider DVR available if > 30s window

        // Target latency for low-latency mode
        const targetLatency = this.config.lowLatency
            ? (levelDetails.partTarget ?? levelDetails.targetduration ?? 3)
            : undefined;

        return {
            isLive,
            liveEdge,
            latency,
            hasDVR,
            dvrWindow,
            targetLatency,
        };
    }

    seekToLiveEdge(): void {
        if (this.hls === null || this._video === null) return;

        const liveInfo = this.getLiveInfo();
        if (liveInfo?.isLive) {
            // hls.js provides liveSyncPosition for optimal live position
            const liveSyncPosition = this.hls.liveSyncPosition;
            if (liveSyncPosition !== undefined && liveSyncPosition !== null) {
                this._video.currentTime = liveSyncPosition;
            } else {
                // Fallback to live edge minus small buffer
                this._video.currentTime = Math.max(0, liveInfo.liveEdge - 3);
            }
            logger.debug(`Seeking to live edge: ${this._video.currentTime}`);
        }
    }

    destroy(): void {
        if (this.destroyed) return;

        logger.debug('Destroying HLSAdapter');
        this.destroyed = true;

        if (this.hls !== null) {
            this.hls.destroy();
            this.hls = null;
        }

        this._video = null;
        this.levels = [];
        this.segmentCallbacks.length = 0;
        this.errorCallbacks.length = 0;
        this.subtitleCallbacks.length = 0;
        this.subtitleTracks = [];
        this.events.removeAllListeners();
    }

    /**
     * Build hls.js configuration with our custom settings.
     */
    private buildHlsConfig(): Partial<HlsConfig> {
        const isMobile = this.platform.isMobile || this.platform.isTablet;

        // Base configuration tuned for production
        const config: Partial<HlsConfig> = {
            // Debug mode
            debug: false,
            // render subtitles in browser
            renderTextTracksNatively: true,

            // Buffer settings (use our buffer manager limits)
            maxBufferLength: this.config.maxBufferLength ?? (isMobile ? 20 : 40),
            maxMaxBufferLength: this.config.maxBufferLength ?? (isMobile ? 30 : 60),
            maxBufferSize: isMobile ? 30 * 1000 * 1000 : 60 * 1000 * 1000, // 30MB mobile, 60MB desktop
            maxBufferHole: 0.5,

            // Start level
            startLevel: -1, // Auto (our ABR controller will override)

            // ABR settings
            abrEwmaDefaultEstimate: 1000000, // 1 Mbps default
            abrEwmaFastLive: 3.0,
            abrEwmaSlowLive: 9.0,
            abrEwmaFastVoD: 3.0,
            abrEwmaSlowVoD: 9.0,
            abrBandWidthFactor: isMobile ? 0.6 : 0.8,
            abrBandWidthUpFactor: isMobile ? 0.5 : 0.7,

            // Low latency (if enabled)
            lowLatencyMode: this.config.lowLatency ?? false,
            backBufferLength: isMobile ? 20 : 30,

            // Fragment loading
            fragLoadingTimeOut: 20000,
            fragLoadingMaxRetry: 4,
            fragLoadingRetryDelay: 1000,
            fragLoadingMaxRetryTimeout: 64000,

            // Manifest loading
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 3,
            manifestLoadingRetryDelay: 1000,

            // Level loading
            levelLoadingTimeOut: 10000,
            levelLoadingMaxRetry: 4,
            levelLoadingRetryDelay: 1000,

            // Streaming
            startFragPrefetch: true,
            testBandwidth: true,

            // Progressive loading
            progressive: true,

            // License for hls.js telemetry
            enableWorker: true,
            enableSoftwareAES: true,
        };

        // Apply custom headers if provided
        if (this.config.headers !== undefined) {
            config.xhrSetup = (xhr: XMLHttpRequest, _url: string): void => {
                for (const [key, value] of Object.entries(this.config.headers!)) {
                    xhr.setRequestHeader(key, value);
                }
            };
        }

        // Merge with user-provided hls.js config
        if (this.config.hlsConfig !== undefined) {
            Object.assign(config, this.config.hlsConfig);
        }

        return config;
    }

    /**
     * Setup hls.js event handlers.
     */
    private setupEventHandlers(): void {
        if (this.hls === null) return;

        // Fragment loaded - report timing for ABR
        this.hls.on(Hls.Events.FRAG_LOADED, (_, data: FragLoadedData) => {
            const stats = data.frag.stats;
            const timing: SegmentTiming = {
                bytes: stats.total,
                durationMs: stats.loading.end - stats.loading.start,
                segmentDuration: data.frag.duration,
            };

            for (const callback of this.segmentCallbacks) {
                try {
                    callback(timing);
                } catch (e) {
                    logger.error('Segment callback error:', e);
                }
            }
        });

        // Level switched
        this.hls.on(Hls.Events.LEVEL_SWITCHED, (_, data: LevelSwitchedData) => {
            this.currentLevelIndex = data.level;
            logger.debug(`Level switched to ${data.level}`);
        });

        // Levels updated (live stream)
        this.hls.on(Hls.Events.LEVEL_UPDATED, () => {
            this.buildQualityLevels();
        });

        // Subtitles updated
        this.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
            this.updateSubtitleTracks();
        });

        // Error handling
        this.hls.on(Hls.Events.ERROR, (_, data: ErrorData) => {
            const error = this.mapHlsError(data);

            // Handle recovery for non-fatal errors
            if (!data.fatal) {
                logger.warn(`Non-fatal HLS error: ${data.type} - ${data.details}`);
                return;
            }

            logger.error(`Fatal HLS error: ${data.type} - ${data.details}`);

            // Attempt recovery based on error type
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                this.handleMediaError();
                return;
            }

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                this.handleNetworkError();
                return;
            }

            // Emit error to callbacks
            for (const callback of this.errorCallbacks) {
                try {
                    callback(error);
                } catch (e) {
                    logger.error('Error callback error:', e);
                }
            }
        });
    }

    private updateSubtitleTracks(): void {
        if (this.hls === null) return;

        // Map hls.js tracks to our SubtitleTrack format
        // Note: hls.subtitleTracks might be undefined in some versions/contexts, so check existence
        const tracks = this.hls.subtitleTracks || [];
        logger.debug(`Raw subtitle tracks from hls.js: ${tracks.length} tracks`);

        this.subtitleTracks = tracks.map((track, index) => ({
            id: `hls-${index}`,
            label: track.name || `Track ${index + 1}`,
            language: track.lang || 'unknown',
            default: track.default,
            url: '' // HLS tracks are internal, no direct URL usually required for the UI manager unless we extract it
        }));

        logger.debug(`Mapped subtitle tracks: ${this.subtitleTracks.length} tracks`);
        logger.debug(`Subtitle tracks updated: ${this.subtitleTracks.length} tracks`);

        for (const callback of this.subtitleCallbacks) {
            try {
                callback(this.subtitleTracks);
            } catch (e) {
                logger.error('Subtitle callback error:', e);
            }
        }
    }

    /**
     * Build quality levels from hls.js levels.
     */
    private buildQualityLevels(): void {
        if (this.hls === null) return;

        const hlsLevels = this.hls.levels;

        this.levels = hlsLevels.map((level: Level, index: number) => ({
            index,
            bitrate: level.bitrate,
            width: level.width,
            height: level.height,
            codec: level.videoCodec ?? level.audioCodec ?? undefined,
            frameRate: level.frameRate ?? undefined,
            label: this.buildQualityLabel(level),
        }));

        // Sort by bitrate
        this.levels.sort((a, b) => a.bitrate - b.bitrate);

        logger.debug(`Quality levels built: ${this.levels.length} levels`);
    }

    /**
     * Build human-readable quality label.
     */
    private buildQualityLabel(level: Level): string {
        if (level.height > 0) {
            const p = level.height;
            const rate = level.frameRate ?? 0;

            if (p >= 2160) return rate > 30 ? '4K60' : '4K';
            if (p >= 1440) return rate > 30 ? '1440p60' : '1440p';
            if (p >= 1080) return rate > 30 ? '1080p60' : '1080p';
            if (p >= 720) return rate > 30 ? '720p60' : '720p';
            if (p >= 480) return '480p';
            if (p >= 360) return '360p';
            if (p >= 240) return '240p';
            return `${p}p`;
        }

        // Fallback to bitrate-based label
        const kbps = Math.round(level.bitrate / 1000);
        if (kbps >= 1000) {
            return `${(kbps / 1000).toFixed(1)} Mbps`;
        }
        return `${kbps} Kbps`;
    }

    /**
     * Map hls.js error to PlayerError.
     */
    private mapHlsError(data: ErrorData): PlayerError {
        const context = {
            type: data.type,
            details: data.details,
            fatal: data.fatal,
        };

        // Network errors
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR) {
                return createPlayerError(
                    ErrorCode.MANIFEST_LOAD_ERROR,
                    'Failed to load HLS manifest',
                    data.error ?? undefined,
                    context
                );
            }

            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                return createPlayerError(
                    ErrorCode.NETWORK_TIMEOUT,
                    'HLS manifest load timeout',
                    data.error ?? undefined,
                    context
                );
            }

            if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
                return createPlayerError(
                    ErrorCode.SEGMENT_MISSING,
                    'Failed to load HLS segment',
                    data.error ?? undefined,
                    context
                );
            }

            if (data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT) {
                return createPlayerError(
                    ErrorCode.NETWORK_TIMEOUT,
                    'HLS segment load timeout',
                    data.error ?? undefined,
                    context
                );
            }

            return createPlayerError(
                ErrorCode.NETWORK_HTTP_ERROR,
                `HLS network error: ${data.details}`,
                data.error ?? undefined,
                context
            );
        }

        // Media errors
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            if (data.details === Hls.ErrorDetails.BUFFER_APPEND_ERROR) {
                return createPlayerError(
                    ErrorCode.MSE_APPEND_ERROR,
                    'Failed to append HLS segment to buffer',
                    data.error ?? undefined,
                    context
                );
            }

            if (data.details === Hls.ErrorDetails.BUFFER_FULL_ERROR) {
                return createPlayerError(
                    ErrorCode.MSE_QUOTA_EXCEEDED,
                    'HLS buffer is full',
                    data.error ?? undefined,
                    context
                );
            }

            return createPlayerError(
                ErrorCode.DECODE_MEDIA_ERROR,
                `HLS media error: ${data.details}`,
                data.error ?? undefined,
                context
            );
        }

        // Manifest errors
        if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
            return createPlayerError(
                ErrorCode.MANIFEST_PARSE_ERROR,
                'Failed to parse HLS manifest',
                data.error ?? undefined,
                context
            );
        }

        // Generic error
        return createPlayerError(
            ErrorCode.UNKNOWN_ERROR,
            `HLS error: ${data.type} - ${data.details}`,
            data.error ?? undefined,
            context
        );
    }

    /**
     * Handle media error recovery.
     */
    private handleMediaError(): void {
        if (this.hls === null) return;

        logger.info('Attempting media error recovery');
        this.hls.recoverMediaError();
    }

    /**
     * Handle network error recovery.
     */
    private handleNetworkError(): void {
        if (this.hls === null) return;

        logger.info('Attempting network error recovery');
        this.hls.startLoad();
    }

    private assertNotDestroyed(): void {
        if (this.destroyed) {
            throw new Error('HLSAdapter has been destroyed');
        }
    }
}
