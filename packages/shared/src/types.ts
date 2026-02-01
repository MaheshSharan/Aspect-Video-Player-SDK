/**
 * Player state machine states.
 * Represents the current lifecycle state of the player.
 */
export const PlayerState = {
    /** Initial state before any source is loaded */
    IDLE: 'idle',
    /** Source is being loaded and parsed */
    LOADING: 'loading',
    /** Source is loaded and ready to play */
    READY: 'ready',
    /** Playback is active */
    PLAYING: 'playing',
    /** Playback is paused */
    PAUSED: 'paused',
    /** Playback is stalled waiting for buffer */
    BUFFERING: 'buffering',
    /** Playback has reached the end of the source */
    ENDED: 'ended',
    /** Fatal error occurred, player cannot continue */
    ERROR: 'error',
} as const;

export type PlayerStateValue = (typeof PlayerState)[keyof typeof PlayerState];

/**
 * Supported media source types.
 */
export const MediaSourceType = {
    HLS: 'hls',
    DASH: 'dash',
    MP4: 'mp4',
} as const;

export type MediaSourceTypeValue = (typeof MediaSourceType)[keyof typeof MediaSourceType];

/**
 * Configuration for loading a media source.
 */
export interface MediaSourceConfig {
    /** URL of the media source */
    readonly url: string;
    /** Type of the media source. If not provided, will be auto-detected */
    readonly type?: MediaSourceTypeValue;
    /** Preferred initial quality index. -1 for auto */
    readonly preferredQuality?: number;
    /** Start position in seconds */
    readonly startPosition?: number;
    /** Custom headers for segment requests */
    readonly headers?: Readonly<Record<string, string>>;
    /** Whether to preload without playing */
    readonly preload?: boolean;
    /** External subtitle tracks */
    readonly subtitleTracks?: readonly SubtitleTrack[];
}

/**
 * Represents a quality level/variant available in the stream.
 */
export interface QualityLevel {
    /** Index in the quality levels array */
    readonly index: number;
    /** Bitrate in bits per second */
    readonly bitrate: number;
    /** Video width in pixels */
    readonly width: number;
    /** Video height in pixels */
    readonly height: number;
    /** Codec string (e.g., 'avc1.4d401f') */
    readonly codec: string | undefined;
    /** Frame rate (if available) */
    readonly frameRate: number | undefined;
    /** Human-readable label */
    readonly label: string;
}

/**
 * Text track (subtitles/captions) information.
 */
export interface SubtitleTrack {
    /** Unique identifier */
    readonly id: string;
    /** Language code (e.g., 'en', 'es') */
    readonly language: string;
    /** Human-readable label */
    readonly label: string;
    /** Source URL (optional, for external tracks) */
    readonly url?: string;
    /** Whether this is the default track */
    readonly default?: boolean;
}

/**
 * Buffer range information.
 */
export interface BufferRange {
    /** Start time in seconds */
    readonly start: number;
    /** End time in seconds */
    readonly end: number;
}

/**
 * Comprehensive buffer state information.
 */
export interface BufferInfo {
    /** All buffered ranges */
    readonly ranges: readonly BufferRange[];
    /** Current playhead position in seconds */
    readonly currentTime: number;
    /** Amount buffered ahead of playhead in seconds */
    readonly forwardBuffer: number;
    /** Amount buffered behind playhead in seconds */
    readonly backwardBuffer: number;
    /** Target buffer level in seconds */
    readonly targetBuffer: number;
    /** Maximum allowed buffer in seconds (platform-dependent) */
    readonly maxBuffer: number;
}

/**
 * Playback timing information.
 */
export interface PlaybackTiming {
    /** Current playback position in seconds */
    readonly currentTime: number;
    /** Total duration in seconds (may be Infinity for live) */
    readonly duration: number;
    /** Whether this is a live stream */
    readonly isLive: boolean;
    /** Live edge position for live streams */
    readonly liveEdge: number | undefined;
    /** Latency from live edge in seconds */
    readonly liveLatency: number | undefined;
}

/**
 * Error classification for recovery strategies.
 */
export const ErrorCategory = {
    /** Transient network issues (timeout, DNS, etc.) */
    NETWORK_TRANSIENT: 'network_transient',
    /** Segment data corruption or parsing failure */
    SEGMENT_CORRUPTION: 'segment_corruption',
    /** Video decoder failure */
    DECODE_FAILURE: 'decode_failure',
    /** MediaSource API failure */
    MEDIASOURCE_FAILURE: 'mediasource_failure',
    /** Fatal incompatibility (unsupported codec, etc.) */
    FATAL_INCOMPATIBILITY: 'fatal_incompatibility',
    /** Key system or DRM-related error */
    KEY_SYSTEM: 'key_system',
    /** Unknown or unclassified error */
    UNKNOWN: 'unknown',
} as const;

export type ErrorCategoryValue = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/**
 * Error severity levels.
 */
export const ErrorSeverity = {
    /** Warning - operation can continue */
    WARN: 'warn',
    /** Error - operation failed but recovery possible */
    ERROR: 'error',
    /** Fatal - player must stop */
    FATAL: 'fatal',
} as const;

export type ErrorSeverityValue = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

/**
 * Structured player error with classification and context.
 */
export interface PlayerError {
    /** Unique error code for identification */
    readonly code: string;
    /** Human-readable error message */
    readonly message: string;
    /** Error category for recovery strategy selection */
    readonly category: ErrorCategoryValue;
    /** Error severity level */
    readonly severity: ErrorSeverityValue;
    /** Whether this error is recoverable */
    readonly recoverable: boolean;
    /** Number of retries attempted */
    readonly retryCount: number;
    /** Original error if wrapping another error */
    readonly cause?: Error;
    /** Additional context data */
    readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * ABR (Adaptive Bitrate) mode.
 */
export const ABRMode = {
    /** Automatic quality selection */
    AUTO: 'auto',
    /** Manual quality lock */
    MANUAL: 'manual',
} as const;

export type ABRModeValue = (typeof ABRMode)[keyof typeof ABRMode];

/**
 * ABR state information.
 */
export interface ABRState {
    /** Current ABR mode */
    readonly mode: ABRModeValue;
    /** Currently selected quality level */
    readonly currentLevel: QualityLevel | undefined;
    /** All available quality levels */
    readonly levels: readonly QualityLevel[];
    /** Estimated bandwidth in bits per second */
    readonly estimatedBandwidth: number;
    /** Whether currently switching quality */
    readonly switching: boolean;
}

/**
 * Platform detection result.
 */
export interface PlatformInfo {
    /** Browser family */
    readonly browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';
    /** Browser version */
    readonly browserVersion: string;
    /** Operating system */
    readonly os: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown';
    /** Whether running on mobile device */
    readonly isMobile: boolean;
    /** Whether running on tablet */
    readonly isTablet: boolean;
    /** Whether MSE is supported */
    readonly supportsMSE: boolean;
    /** Whether native HLS is supported */
    readonly supportsNativeHLS: boolean;
    /** Whether PiP is supported */
    readonly supportsPiP: boolean;
    /** Whether fullscreen API is supported */
    readonly supportsFullscreen: boolean;
    /** Whether AirPlay is supported */
    readonly supportsAirPlay: boolean;
}

/**
 * Player configuration options.
 */
export interface PlayerConfig {
    /** Whether to enable debug logging */
    readonly debug?: boolean;
    /** Maximum buffer ahead in seconds (overrides platform default) */
    readonly maxBufferLength?: number;
    /** Target buffer length in seconds */
    readonly targetBufferLength?: number;
    /** Whether to start muted */
    readonly muted?: boolean;
    /** Initial volume (0-1) */
    readonly volume?: number;
    /** Whether to attempt autoplay */
    readonly autoplay?: boolean;
    /** Whether to loop playback */
    readonly loop?: boolean;
    /** ABR configuration */
    readonly abr?: ABRConfig;
    /** Retry configuration */
    readonly retry?: RetryConfig;
}

/**
 * ABR-specific configuration.
 */
export interface ABRConfig {
    /** Initial quality selection strategy */
    readonly startLevel?: 'auto' | 'lowest' | 'highest' | number;
    /** Bandwidth estimation safety factor (0-1) */
    readonly bandwidthSafetyFactor?: number;
    /** Minimum buffer before quality upgrade in seconds */
    readonly upgradeBufferThreshold?: number;
    /** Maximum buffer before quality downgrade in seconds */
    readonly downgradeBufferThreshold?: number;
    /** Whether to bias toward stability on mobile */
    readonly mobileStabilityBias?: boolean;
}

/**
 * Retry-specific configuration.
 */
export interface RetryConfig {
    /** Maximum retry attempts for network errors */
    readonly maxNetworkRetries?: number;
    /** Base delay between retries in milliseconds */
    readonly retryDelayMs?: number;
    /** Maximum retry delay in milliseconds */
    readonly maxRetryDelayMs?: number;
    /** Whether to use exponential backoff */
    readonly exponentialBackoff?: boolean;
}

/**
 * Function that unsubscribes from an event.
 */
export type Unsubscribe = () => void;

/**
 * Video element abstraction interface.
 * Allows the core engine to be tested without a real video element.
 */
export interface VideoElementAdapter {
    readonly currentTime: number;
    readonly duration: number;
    readonly paused: boolean;
    readonly ended: boolean;
    readonly readyState: number;
    readonly buffered: TimeRanges;
    readonly volume: number;
    readonly muted: boolean;
    readonly playbackRate: number;
    readonly videoWidth: number;
    readonly videoHeight: number;

    play(): Promise<void>;
    pause(): void;
    load(): void;
    setCurrentTime(time: number): void;
    setVolume(volume: number): void;
    setMuted(muted: boolean): void;
    setPlaybackRate(rate: number): void;
    setSrc(src: string): void;
    getSrc(): string;

    addEventListener<K extends keyof HTMLVideoElementEventMap>(
        type: K,
        listener: (ev: HTMLVideoElementEventMap[K]) => void
    ): void;
    removeEventListener<K extends keyof HTMLVideoElementEventMap>(
        type: K,
        listener: (ev: HTMLVideoElementEventMap[K]) => void
    ): void;
}

/**
 * TimeRanges-like interface for buffer information.
 */
export interface TimeRangesLike {
    readonly length: number;
    start(index: number): number;
    end(index: number): number;
}
