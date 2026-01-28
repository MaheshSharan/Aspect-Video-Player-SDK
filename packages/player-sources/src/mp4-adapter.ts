import {
    createLogger,
    createPlayerError,
    ErrorCode,
    type QualityLevel,
    type MediaSourceConfig,
    type PlayerError,
    type Unsubscribe,
} from 'aspect-player-shared';
import type { SegmentTiming } from 'aspect-player-core';
import type { SourceAdapter, SourceAdapterConfig, SegmentLoadedCallback, ErrorCallback } from './types';

const logger = createLogger('mp4-adapter');

/**
 * Progressive MP4 Adapter.
 *
 * Handles progressive MP4 playback using native video element.
 * Supports range requests for seeking.
 */
export class MP4Adapter implements SourceAdapter {
    readonly name = 'mp4';
    readonly usesMSE = false;

    private readonly config: SourceAdapterConfig;
    private video: HTMLVideoElement | null = null;
    private sourceUrl = '';

    private readonly segmentCallbacks: SegmentLoadedCallback[] = [];
    private readonly errorCallbacks: ErrorCallback[] = [];
    private readonly boundHandlers: Array<() => void> = [];

    private destroyed = false;

    constructor(config: SourceAdapterConfig = {}) {
        this.config = config;
        logger.debug('MP4Adapter created');
    }

    /**
     * Check if MP4 playback is supported.
     */
    static isSupported(): boolean {
        if (typeof document === 'undefined') return false;

        const video = document.createElement('video');
        return video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
    }

    async attach(video: HTMLVideoElement): Promise<void> {
        this.assertNotDestroyed();
        this.video = video;

        logger.debug('Attaching to video element (MP4)');

        this.setupEventHandlers();
    }

    async load(config: MediaSourceConfig): Promise<void> {
        this.assertNotDestroyed();

        if (this.video === null) {
            throw new Error('MP4 adapter not attached');
        }

        logger.info(`Loading MP4 source: ${config.url.substring(0, 60)}...`);

        this.sourceUrl = config.url;
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
        // Progressive MP4 has a single quality level
        if (this.video === null) return [];

        return [
            {
                index: 0,
                bitrate: 0, // Unknown for progressive
                width: this.video.videoWidth,
                height: this.video.videoHeight,
                codec: undefined,
                frameRate: undefined,
                label: 'Default',
            },
        ];
    }

    setQualityLevel(_index: number): void {
        // Progressive MP4 has no quality selection
        logger.debug('Quality selection not available for progressive MP4');
    }

    getCurrentQualityLevel(): number {
        return 0; // Always the single quality
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

        logger.debug('Destroying MP4Adapter');
        this.destroyed = true;

        for (const cleanup of this.boundHandlers) {
            cleanup();
        }
        this.boundHandlers.length = 0;

        if (this.video !== null) {
            this.video.removeAttribute('src');
            this.video.load();
        }

        this.video = null;
        this.sourceUrl = '';
        this.segmentCallbacks.length = 0;
        this.errorCallbacks.length = 0;
    }

    /**
     * Setup event handlers.
     */
    private setupEventHandlers(): void {
        if (this.video === null) return;

        // Error handling
        const onError = (): void => {
            const error = this.mapVideoError(this.video?.error);
            logger.error('MP4 error:', error.message);

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

        // Progress tracking for bandwidth estimation
        let lastProgressTime = performance.now();
        let lastBufferedEnd = 0;

        const onProgress = (): void => {
            const video = this.video;
            if (video === null) return;

            const buffered = video.buffered;
            if (buffered.length === 0) return;

            const currentBufferedEnd = buffered.end(buffered.length - 1);
            const now = performance.now();

            if (currentBufferedEnd > lastBufferedEnd) {
                const bufferGrowth = currentBufferedEnd - lastBufferedEnd;
                const timeElapsed = now - lastProgressTime;

                // Estimate bytes based on bitrate and buffer growth
                // This is an approximation since we don't know the actual bitrate
                const estimatedBitrate = 2000000; // Assume 2 Mbps average
                const estimatedBytes = Math.floor((bufferGrowth * estimatedBitrate) / 8);

                if (timeElapsed > 100 && estimatedBytes > 0) {
                    const timing: SegmentTiming = {
                        bytes: estimatedBytes,
                        durationMs: timeElapsed,
                        segmentDuration: bufferGrowth,
                    };

                    for (const callback of this.segmentCallbacks) {
                        try {
                            callback(timing);
                        } catch (e) {
                            logger.error('Segment callback error:', e);
                        }
                    }
                }

                lastBufferedEnd = currentBufferedEnd;
                lastProgressTime = now;
            }
        };

        this.video.addEventListener('progress', onProgress);
        this.boundHandlers.push(() => this.video?.removeEventListener('progress', onProgress));
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
            throw new Error('MP4Adapter has been destroyed');
        }
    }
}
