import {
    type PlayerStateValue,
    type MediaSourceConfig,
    type QualityLevel,
    type BufferInfo,
    type PlaybackTiming,
    type ABRState,
    type PlayerError,
    type PlayerConfig,
    type Unsubscribe,
} from '@aspect/shared';

/**
 * Player event map for type-safe event handling.
 */
export interface PlayerEventMap {
    /** Player state changed */
    statechange: { state: PlayerStateValue; previousState: PlayerStateValue };

    /** Playback time updated */
    timeupdate: PlaybackTiming;

    /** Duration changed (e.g., live stream update) */
    durationchange: { duration: number };

    /** Buffer state updated */
    bufferupdate: BufferInfo;

    /** Quality levels available */
    qualitylevels: { levels: readonly QualityLevel[] };

    /** Quality level changed */
    qualitychange: { level: QualityLevel; auto: boolean };

    /** ABR state updated */
    abrupdate: ABRState;

    /** Playback rate changed */
    ratechange: { rate: number };

    /** Volume changed */
    volumechange: { volume: number; muted: boolean };

    /** Seeking started */
    seeking: { target: number };

    /** Seek completed */
    seeked: { position: number };

    /** Waiting for data */
    waiting: void;

    /** Playback can continue */
    canplay: void;

    /** Playback reached end */
    ended: void;

    /** Error occurred */
    error: PlayerError;

    /** Source loaded and ready */
    loaded: { source: MediaSourceConfig };

    /** Player destroyed */
    destroyed: void;

    /** Fullscreen state changed */
    fullscreenchange: { fullscreen: boolean };

    /** Picture-in-Picture state changed */
    pipchange: { active: boolean };
}

/**
 * Event handler type for player events.
 */
export type PlayerEventHandler<E extends keyof PlayerEventMap> = (payload: PlayerEventMap[E]) => void;

/**
 * Read-only snapshot of player state.
 */
export interface PlayerSnapshot {
    readonly state: PlayerStateValue;
    readonly currentTime: number;
    readonly duration: number;
    readonly buffered: BufferInfo;
    readonly volume: number;
    readonly muted: boolean;
    readonly playbackRate: number;
    readonly isLive: boolean;
    readonly qualityLevels: readonly QualityLevel[];
    readonly currentQuality: QualityLevel | undefined;
    readonly abrEnabled: boolean;
    readonly error: PlayerError | undefined;
}

/**
 * Core player engine interface.
 * All implementations must satisfy this contract.
 */
export interface PlayerEngine {
    /**
     * Load a media source.
     * Transitions: IDLE -> LOADING -> READY
     *
     * @param source - Media source configuration
     * @returns Promise that resolves when source is ready to play
     */
    load(source: MediaSourceConfig): Promise<void>;

    /**
     * Retry loading the current source.
     * Useful for recovering from fatal errors.
     */
    retry(): Promise<void>;

    /**
     * Start or resume playback.
     * Transitions: READY/PAUSED -> PLAYING
     *
     * @returns Promise that resolves when playback starts
     */
    play(): Promise<void>;

    /**
     * Pause playback.
     * Transitions: PLAYING -> PAUSED
     */
    pause(): void;

    /**
     * Seek to a position.
     *
     * @param seconds - Target position in seconds
     */
    seek(seconds: number): void;

    /**
     * Destroy the player and release all resources.
     * Player cannot be used after this.
     */
    destroy(): void;

    /**
     * Get current player state snapshot.
     *
     * @returns Current state snapshot
     */
    getSnapshot(): PlayerSnapshot;

    /**
     * Subscribe to player events.
     *
     * @param event - Event name
     * @param handler - Event handler
     * @returns Unsubscribe function
     */
    on<E extends keyof PlayerEventMap>(event: E, handler: PlayerEventHandler<E>): Unsubscribe;

    /**
     * Subscribe to player event once.
     *
     * @param event - Event name
     * @param handler - Event handler
     * @returns Unsubscribe function
     */
    once<E extends keyof PlayerEventMap>(event: E, handler: PlayerEventHandler<E>): Unsubscribe;

    /**
     * Unsubscribe from player events.
     *
     * @param event - Event name
     * @param handler - Event handler to remove
     */
    off<E extends keyof PlayerEventMap>(event: E, handler: PlayerEventHandler<E>): void;

    // Volume control
    setVolume(volume: number): void;
    setMuted(muted: boolean): void;

    // Playback rate
    setPlaybackRate(rate: number): void;

    // Quality control
    setQuality(levelIndex: number): void;
    setAutoQuality(enabled: boolean): void;

    // Picture-in-Picture
    requestPictureInPicture(): Promise<void>;
    exitPictureInPicture(): Promise<void>;

    // Fullscreen
    requestFullscreen(): Promise<void>;
    exitFullscreen(): Promise<void>;
}

/**
 * Configuration required to create a player engine.
 */
export interface EngineConfig extends PlayerConfig {
    /** Video element to use for playback */
    videoElement: HTMLVideoElement;
}
