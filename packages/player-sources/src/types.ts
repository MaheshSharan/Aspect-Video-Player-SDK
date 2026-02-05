import type { QualityLevel, MediaSourceConfig, PlayerError, Unsubscribe, SubtitleTrack } from 'aspect-player-shared';
import type { SegmentTiming } from 'aspect-player-core';

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
     * Get available subtitle tracks.
     */
    getSubtitleTracks(): SubtitleTrack[];

    /**
     * Set subtitle track.
     * null for off/none
     */
    setSubtitleTrack(trackId: string | null): void;

    /**
     * Register callback for segment load timing (for ABR).
     */
    onSegmentLoaded(callback: (timing: SegmentTiming) => void): Unsubscribe;

    /**
     * Register callback for errors.
     */
    onError(callback: (error: PlayerError) => void): Unsubscribe;

    /**
     * Register callback for subtitle track updates.
     */
    onSubtitleTracksChanged(callback: (tracks: SubtitleTrack[]) => void): Unsubscribe;

    /**
     * Get live stream information.
     * Returns undefined for non-live streams.
     */
    getLiveInfo(): LiveStreamInfo | undefined;

    /**
     * Seek to the live edge.
     * Only applicable for live streams with DVR.
     */
    seekToLiveEdge(): void;

    /**
     * Destroy the adapter and release resources.
     */
    destroy(): void;
}

/**
 * Live stream information from the adapter.
 */
export interface LiveStreamInfo {
    /** Whether this is a live stream */
    readonly isLive: boolean;
    /** Live edge position in seconds (current live point) */
    readonly liveEdge: number;
    /** Current latency from live edge in seconds */
    readonly latency: number;
    /** Whether DVR (seekback) is available */
    readonly hasDVR: boolean;
    /** DVR window size in seconds (how far back you can seek) */
    readonly dvrWindow: number;
    /** Target latency in seconds (for low-latency modes) */
    readonly targetLatency?: number;
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
export type SubtitleTracksCallback = (tracks: SubtitleTrack[]) => void;
