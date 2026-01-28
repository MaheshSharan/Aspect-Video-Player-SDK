import type { QualityLevel, MediaSourceConfig, PlayerError, Unsubscribe } from '@aspect/shared';
import type { SegmentTiming } from '@aspect/player-core';

/**
 * Source adapter interface.
 * Implemented by each source type (HLS, DASH, MP4).
 */
export interface SourceAdapter {
    /** Adapter name for logging */
    readonly name: string;

    /** Whether this adapter uses MSE */
    readonly usesMSE: boolean;

    /**
     * Attach to video element.
     * For MSE-based adapters: creates MediaSource, attaches to video
     * For native adapters: sets video.src directly
     */
    attach(video: HTMLVideoElement): Promise<void>;

    /**
     * Load the source.
     * For HLS: parses manifest, starts initial segment loading
     * For DASH: parses MPD, starts initial segment loading
     * For MP4: begins progressive download
     */
    load(config: MediaSourceConfig): Promise<void>;

    /**
     * Get available quality levels.
     */
    getQualityLevels(): QualityLevel[];

    /**
     * Set quality level.
     * -1 for auto, >= 0 for specific level index
     */
    setQualityLevel(index: number): void;

    /**
     * Get current quality level index.
     */
    getCurrentQualityLevel(): number;

    /**
     * Register callback for segment load timing (for ABR).
     */
    onSegmentLoaded(callback: (timing: SegmentTiming) => void): Unsubscribe;

    /**
     * Register callback for errors.
     */
    onError(callback: (error: PlayerError) => void): Unsubscribe;

    /**
     * Destroy the adapter and release resources.
     */
    destroy(): void;
}

/**
 * Source adapter configuration.
 */
export interface SourceAdapterConfig {
    /** Enable debug mode */
    debug?: boolean;
    /** Custom headers for requests */
    headers?: Record<string, string>;
    /** Maximum buffer length in seconds */
    maxBufferLength?: number;
    /** Target buffer length in seconds */
    targetBufferLength?: number;
}

/**
 * Callback types for adapters.
 */
export type SegmentLoadedCallback = (timing: SegmentTiming) => void;
export type ErrorCallback = (error: PlayerError) => void;
