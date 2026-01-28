import {
    createLogger,
    createPlayerError,
    ErrorCode,
    type QualityLevel,
    type MediaSourceConfig,
    type PlayerError,
    type Unsubscribe,
} from '@aspect/shared';
import type { SegmentTiming } from '@aspect/player-core';
import type { SourceAdapter, SourceAdapterConfig, SegmentLoadedCallback, ErrorCallback } from './types';

const logger = createLogger('hls-native-adapter');

/**
 * Native HLS Adapter for Safari and iOS.
 *
 * Uses the browser's native HLS support instead of hls.js.
 * Required for:
 * - Safari (MSE is supported but native HLS is preferred)
 * - iOS (MSE is not supported on iOS Safari)
 */
export class HLSNativeAdapter implements SourceAdapter {
    readonly name = 'hls-native';
    readonly usesMSE = false;

    private readonly config: SourceAdapterConfig;
    private video: HTMLVideoElement | null = null;
    private levels: QualityLevel[] = [];
    private currentLevelIndex = 0;

    private readonly segmentCallbacks: SegmentLoadedCallback[] = [];
    private readonly errorCallbacks: ErrorCallback[] = [];
    private readonly boundHandlers: Array<() => void> = [];

    private destroyed = false;

    constructor(config: SourceAdapterConfig = {}) {
        this.config = config;
        logger.debug('HLSNativeAdapter created');
    }

    /**
     * Check if native HLS is supported.
     */
    static isSupported(): boolean {
        if (typeof document === 'undefined') return false;

        const video = document.createElement('video');
        return (
            video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
            video.canPlayType('application/x-mpegURL') !== ''
        );
    }

    async attach(video: HTMLVideoElement): Promise<void> {
        this.assertNotDestroyed();
        this.video = video;

        logger.debug('Attaching to video element (native HLS)');

        // Setup event handlers for native video
        this.setupEventHandlers();
    }

    async load(config: MediaSourceConfig): Promise<void> {
        this.assertNotDestroyed();

        if (this.video === null) {
            throw new Error('HLSNative adapter not attached');
        }

        logger.info(`Loading native HLS source: ${config.url.substring(0, 60)}...`);

        // For native HLS, we simply set the src
        this.video.src = config.url;

        // Set start position if specified
        if (config.startPosition !== undefined && config.startPosition > 0) {
            this.video.currentTime = config.startPosition;
        }

        // Wait for loadedmetadata
        return new Promise<void>((resolve, reject) => {
            if (this.video === null) {
                reject(new Error('Video element not available'));
                return;
            }

            const onLoaded = (): void => {
                this.video?.removeEventListener('loadedmetadata', onLoaded);
                this.video?.removeEventListener('error', onError);

                // Build quality levels from native video
                this.buildQualityLevels();

                resolve();
            };

            const onError = (): void => {
                this.video?.removeEventListener('loadedmetadata', onLoaded);
                this.video?.removeEventListener('error', onError);

                const error = this.video?.error;
                reject(this.mapVideoError(error));
            };

            this.video.addEventListener('loadedmetadata', onLoaded);
            this.video.addEventListener('error', onError);
        });
    }

    getQualityLevels(): QualityLevel[] {
        return this.levels;
    }

    setQualityLevel(_index: number): void {
        // Native HLS quality selection is limited on Safari
        // videoTracks and audioTracks can be used but quality selection is browser-controlled
        logger.debug('Quality selection limited for native HLS');
    }

    getCurrentQualityLevel(): number {
        return this.currentLevelIndex;
    }

    onSegmentLoaded(callback: SegmentLoadedCallback): Unsubscribe {
        // Native HLS doesn't provide segment-level events
        // We can simulate by tracking progress events
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

        logger.debug('Destroying HLSNativeAdapter');
        this.destroyed = true;

        // Remove event handlers
        for (const cleanup of this.boundHandlers) {
            cleanup();
        }
        this.boundHandlers.length = 0;

        if (this.video !== null) {
            this.video.removeAttribute('src');
            this.video.load();
        }

        this.video = null;
        this.levels = [];
        this.segmentCallbacks.length = 0;
        this.errorCallbacks.length = 0;
    }

    /**
     * Setup native video event handlers.
     */
    private setupEventHandlers(): void {
        if (this.video === null) return;

        // Error handling
        const onError = (): void => {
            const error = this.mapVideoError(this.video?.error);
            logger.error('Native HLS error:', error.message);

            for (const callback of this.errorCallbacks) {
                try {
                    callback(error);
                } catch (e) {
                    logger.error('Error callback error:', e);
                }
            }
        };

        this.video.addEventListener('error', onError);
        this.boundHandlers.push(() => this.video?.removeEventListener('error', onError));

        // Progress events - simulate segment timing
        let lastProgressTime = 0;
        let lastBytesLoaded = 0;

        const onProgress = (): void => {
            const video = this.video;
            if (video === null) return;

            const now = performance.now();
            const buffered = video.buffered;

            if (buffered.length > 0) {
                // Estimate bytes loaded based on duration buffered
                // This is a rough approximation since native HLS doesn't expose byte counts
                const bufferedEnd = buffered.end(buffered.length - 1);
                const duration = video.duration || 1;
                const estimatedTotalBytes = 1000000 * 60; // Assume ~1MB per minute (very rough)
                const estimatedBytesLoaded = Math.floor((bufferedEnd / duration) * estimatedTotalBytes);

                const bytesDelta = estimatedBytesLoaded - lastBytesLoaded;
                const timeDelta = now - lastProgressTime;

                if (bytesDelta > 0 && timeDelta > 100) {
                    const timing: SegmentTiming = {
                        bytes: bytesDelta,
                        durationMs: timeDelta,
                        segmentDuration: 2, // Assume ~2s segments
                    };

                    for (const callback of this.segmentCallbacks) {
                        try {
                            callback(timing);
                        } catch (e) {
                            logger.error('Segment callback error:', e);
                        }
                    }

                    lastBytesLoaded = estimatedBytesLoaded;
                    lastProgressTime = now;
                }
            }
        };

        this.video.addEventListener('progress', onProgress);
        this.boundHandlers.push(() => this.video?.removeEventListener('progress', onProgress));

        // Support for AirPlay
        if ('webkitPlaybackTargetAvailabilityChanged' in this.video) {
            const onAirplayAvailable = (e: Event): void => {
                const event = e as Event & { availability?: string };
                logger.debug(`AirPlay availability: ${event.availability}`);
            };

            (this.video as HTMLVideoElement & { addEventListener: (type: string, listener: EventListener) => void })
                .addEventListener('webkitplaybacktargetavailabilitychanged', onAirplayAvailable);

            this.boundHandlers.push(() =>
                (this.video as HTMLVideoElement & { removeEventListener: (type: string, listener: EventListener) => void })
                    ?.removeEventListener('webkitplaybacktargetavailabilitychanged', onAirplayAvailable)
            );
        }

        // Support for WebKit Presentation Mode (PiP on Safari)
        if ('webkitPresentationMode' in this.video) {
            const onPresentationModeChanged = (): void => {
                const mode = (this.video as HTMLVideoElement & { webkitPresentationMode?: string })?.webkitPresentationMode;
                logger.debug(`Presentation mode changed: ${mode}`);
            };

            (this.video as HTMLVideoElement & { addEventListener: (type: string, listener: EventListener) => void })
                .addEventListener('webkitpresentationmodechanged', onPresentationModeChanged);

            this.boundHandlers.push(() =>
                (this.video as HTMLVideoElement & { removeEventListener: (type: string, listener: EventListener) => void })
                    ?.removeEventListener('webkitpresentationmodechanged', onPresentationModeChanged)
            );
        }
    }

    /**
     * Build quality levels from native video.
     * Limited information available for native HLS.
     */
    private buildQualityLevels(): void {
        if (this.video === null) return;

        // Native HLS provides limited quality information
        // We can try to get video tracks but they may not expose quality details
        // videoTracks is a Safari-specific property
        const videoWithTracks = this.video as HTMLVideoElement & { videoTracks?: ArrayLike<unknown> };
        const videoTracks = videoWithTracks.videoTracks;

        if (videoTracks !== undefined && videoTracks.length > 0) {
            this.levels = Array.from(videoTracks).map((_, index) => ({
                index,
                bitrate: 0,
                width: this.video?.videoWidth ?? 0,
                height: this.video?.videoHeight ?? 0,
                codec: undefined,
                frameRate: undefined,
                label: `Quality ${index + 1}`,
            }));
        } else {
            // Fallback: single "Auto" quality
            this.levels = [
                {
                    index: 0,
                    bitrate: 0,
                    width: this.video.videoWidth,
                    height: this.video.videoHeight,
                    codec: undefined,
                    frameRate: undefined,
                    label: 'Auto',
                },
            ];
        }

        logger.debug(`Quality levels: ${this.levels.length} (native HLS limited)`);
    }

    /**
     * Map video element error to PlayerError.
     */
    private mapVideoError(error: MediaError | null | undefined): PlayerError {
        if (error === null || error === undefined) {
            return createPlayerError(ErrorCode.UNKNOWN_ERROR, 'Unknown video error');
        }

        switch (error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
                return createPlayerError(ErrorCode.NETWORK_ABORTED, 'Media playback aborted');

            case MediaError.MEDIA_ERR_NETWORK:
                return createPlayerError(ErrorCode.NETWORK_HTTP_ERROR, 'Network error during playback');

            case MediaError.MEDIA_ERR_DECODE:
                return createPlayerError(ErrorCode.DECODE_MEDIA_ERROR, 'Media decode error');

            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                return createPlayerError(ErrorCode.CODEC_NOT_SUPPORTED, 'Media source not supported');

            default:
                return createPlayerError(ErrorCode.UNKNOWN_ERROR, error.message || 'Unknown video error');
        }
    }

    private assertNotDestroyed(): void {
        if (this.destroyed) {
            throw new Error('HLSNativeAdapter has been destroyed');
        }
    }
}
