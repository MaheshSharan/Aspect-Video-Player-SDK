import type { PlayerEngine, PlayerSnapshot } from 'aspect-player-core';
import type { MediaSourceConfig, PlayerConfig, QualityLevel } from 'aspect-player-shared';

/**
 * Player ref interface for imperative control.
 */
export interface PlayerRef {
    /** Get the underlying player engine */
    getEngine(): PlayerEngine | null;

    /** Load a media source */
    load(source: MediaSourceConfig): Promise<void>;

    /** Start playback */
    play(): Promise<void>;

    /** Pause playback */
    pause(): void;

    /** Seek to position in seconds */
    seek(seconds: number): void;

    /** Set volume (0-1) */
    setVolume(volume: number): void;

    /** Set muted state */
    setMuted(muted: boolean): void;

    /** Set playback rate */
    setPlaybackRate(rate: number): void;

    /** Set quality level (-1 for auto) */
    setQuality(levelIndex: number): void;

    /** Request fullscreen */
    requestFullscreen(): Promise<void>;

    /** Exit fullscreen */
    exitFullscreen(): Promise<void>;

    /** Request PiP */
    requestPiP(): Promise<void>;

    /** Exit PiP */
    exitPiP(): Promise<void>;

    /** Destroy the player */
    destroy(): void;
}

/**
 * Player component props.
 */
export interface AspectPlayerProps {
    /** Media source to load */
    source?: MediaSourceConfig;

    /** Whether to autoplay */
    autoplay?: boolean;

    /** Whether to start muted */
    muted?: boolean;

    /** Initial volume (0-1) */
    volume?: number;

    /** Whether to loop playback */
    loop?: boolean;

    /** Enable debug logging */
    debug?: boolean;

    /** Player configuration overrides */
    config?: Partial<PlayerConfig>;

    /** Show built-in UI controls */
    controls?: boolean;

    /** Video title to display in player controls */
    title?: string;

    /** Episode info for TV shows (e.g., "S1 E1") */
    episodeInfo?: string;

    /** Poster image URL */
    poster?: string;

    /** Available subtitle tracks */
    subtitleTracks?: Array<{
        id: string;
        label: string;
        language: string;
        url: string;
        default?: boolean;
    }>;

    /** URL to thumbnail VTT sprite sheet for seek preview */
    thumbnailTrack?: string;

    /** CSS class name */
    className?: string;

    /** Inline styles */
    style?: React.CSSProperties;

    /** Optional ref for imperative control */
    playerRef?: React.RefObject<PlayerRef>;

    // Event handlers
    onReady?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    onBufferUpdate?: (forwardBuffer: number) => void;
    onQualityChange?: (level: QualityLevel, auto: boolean) => void;
    onError?: (error: Error) => void;
    onStateChange?: (state: string) => void;
    onVolumeChange?: (volume: number, muted: boolean) => void;
    onFullscreenChange?: (fullscreen: boolean) => void;
}

/**
 * Player context value.
 */
export interface PlayerContextValue {
    /** Player engine instance */
    engine: PlayerEngine | null;

    /** Current player snapshot */
    snapshot: PlayerSnapshot | null;

    /** Whether player is ready */
    isReady: boolean;

    /** Whether player is loading */
    isLoading: boolean;

    /** Current error if any */
    error: Error | null;
}

/**
 * usePlayer hook options.
 */
export interface UsePlayerOptions {
    /** Player configuration */
    config?: Partial<PlayerConfig>;

    /** Enable debug mode */
    debug?: boolean;
}

/**
 * usePlayer hook return value.
 */
export interface UsePlayerReturn {
    /** Ref to attach to video element */
    videoRef: React.RefObject<HTMLVideoElement>;

    /** Player engine instance */
    engine: PlayerEngine | null;

    /** Current player snapshot */
    snapshot: PlayerSnapshot | null;

    /** Whether player is ready */
    isReady: boolean;

    /** Load a media source */
    load: (source: MediaSourceConfig) => Promise<void>;

    /** Play */
    play: () => Promise<void>;

    /** Pause */
    pause: () => void;

    /** Seek to position */
    seek: (seconds: number) => void;

    /** Set volume */
    setVolume: (volume: number) => void;

    /** Set muted */
    setMuted: (muted: boolean) => void;

    /** Set quality */
    setQuality: (index: number) => void;

    /** Destroy player */
    destroy: () => void;
}
