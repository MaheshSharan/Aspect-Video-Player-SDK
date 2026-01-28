// Types
export type {
    MediaSourceConfig,
    QualityLevel,
    BufferRange,
    BufferInfo,
    PlaybackTiming,
    PlayerError,
    ABRState,
    PlatformInfo,
    PlayerConfig,
    ABRConfig,
    RetryConfig,
    Unsubscribe,
    VideoElementAdapter,
    TimeRangesLike,
} from './types';

export {
    PlayerState,
    type PlayerStateValue,
    MediaSourceType,
    type MediaSourceTypeValue,
    ErrorCategory,
    type ErrorCategoryValue,
    ErrorSeverity,
    type ErrorSeverityValue,
    ABRMode,
    type ABRModeValue,
} from './types';

// Events
export { EventEmitter, createDeferred, type EventHandler, type Deferred } from './events';

// Logging
export {
    Logger,
    createLogger,
    LogLevel,
    type LogLevelValue,
    type LoggerConfig,
    type LogEntry,
    type LogHandler,
} from './logger';

// Platform detection
export {
    detectPlatform,
    resetPlatformCache,
    isCodecSupported,
    getSupportedVideoCodecs,
    getSupportedAudioCodecs,
    CommonCodecs,
} from './platform';

// Retry utilities
export {
    createRetryState,
    canRetry,
    calculateRetryDelay,
    recordRetryAttempt,
    resetRetryState,
    getRetryPolicy,
    executeWithRetry,
    sleep,
    timeout,
    withTimeout,
    DEFAULT_RETRY_POLICIES,
    type RetryState,
    type RetryPolicy,
} from './retry';

// Error utilities
export {
    ErrorCode,
    type ErrorCodeValue,
    createPlayerError,
    withRetryCount,
    isFatalError,
    shouldRetryError,
    classifyNativeError,
    classifyHttpError,
    formatPlayerError,
} from './errors';

// General utilities
export {
    clamp,
    formatTime,
    parseTime,
    formatBytes,
    formatBitrate,
    debounce,
    throttle,
    generateId,
    isDefined,
    assert,
    assertNever,
    deepFreeze,
    omit,
    pick,
} from './utils';
