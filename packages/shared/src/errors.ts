import {
    ErrorCategory,
    ErrorSeverity,
    type ErrorCategoryValue,
    type ErrorSeverityValue,
    type PlayerError,
} from './types';

/**
 * Error code definitions.
 * Format: [CATEGORY]_[SUBCATEGORY]_[DESCRIPTION]
 */
export const ErrorCode = {
    // Network errors
    NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
    NETWORK_OFFLINE: 'NETWORK_OFFLINE',
    NETWORK_DNS_FAILURE: 'NETWORK_DNS_FAILURE',
    NETWORK_CONNECTION_REFUSED: 'NETWORK_CONNECTION_REFUSED',
    NETWORK_HTTP_ERROR: 'NETWORK_HTTP_ERROR',
    NETWORK_CORS: 'NETWORK_CORS',
    NETWORK_ABORTED: 'NETWORK_ABORTED',

    // Segment errors
    SEGMENT_PARSE_ERROR: 'SEGMENT_PARSE_ERROR',
    SEGMENT_INVALID_DATA: 'SEGMENT_INVALID_DATA',
    SEGMENT_MISSING: 'SEGMENT_MISSING',
    SEGMENT_RANGE_ERROR: 'SEGMENT_RANGE_ERROR',

    // Decode errors
    DECODE_VIDEO_ERROR: 'DECODE_VIDEO_ERROR',
    DECODE_AUDIO_ERROR: 'DECODE_AUDIO_ERROR',
    DECODE_MEDIA_ERROR: 'DECODE_MEDIA_ERROR',

    // MediaSource errors
    MSE_CREATE_ERROR: 'MSE_CREATE_ERROR',
    MSE_SOURCE_BUFFER_ERROR: 'MSE_SOURCE_BUFFER_ERROR',
    MSE_APPEND_ERROR: 'MSE_APPEND_ERROR',
    MSE_REMOVE_ERROR: 'MSE_REMOVE_ERROR',
    MSE_END_OF_STREAM_ERROR: 'MSE_END_OF_STREAM_ERROR',
    MSE_QUOTA_EXCEEDED: 'MSE_QUOTA_EXCEEDED',

    // Compatibility errors
    CODEC_NOT_SUPPORTED: 'CODEC_NOT_SUPPORTED',
    MSE_NOT_SUPPORTED: 'MSE_NOT_SUPPORTED',
    HLS_NOT_SUPPORTED: 'HLS_NOT_SUPPORTED',
    DASH_NOT_SUPPORTED: 'DASH_NOT_SUPPORTED',
    BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',

    // Manifest errors
    MANIFEST_PARSE_ERROR: 'MANIFEST_PARSE_ERROR',
    MANIFEST_LOAD_ERROR: 'MANIFEST_LOAD_ERROR',
    MANIFEST_INVALID: 'MANIFEST_INVALID',

    // Key system / DRM errors (extension points only)
    KEY_SYSTEM_ERROR: 'KEY_SYSTEM_ERROR',
    KEY_SESSION_ERROR: 'KEY_SESSION_ERROR',
    LICENSE_ERROR: 'LICENSE_ERROR',

    // Player errors
    PLAYER_LOAD_ERROR: 'PLAYER_LOAD_ERROR',
    PLAYER_STATE_ERROR: 'PLAYER_STATE_ERROR',
    PLAYER_DESTROYED: 'PLAYER_DESTROYED',

    // Unknown
    UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Map error codes to their categories and default severities.
 */
const ERROR_METADATA: Record<ErrorCodeValue, { category: ErrorCategoryValue; severity: ErrorSeverityValue; recoverable: boolean }> = {
    // Network errors - transient and recoverable
    [ErrorCode.NETWORK_TIMEOUT]: { category: ErrorCategory.NETWORK_TRANSIENT, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.NETWORK_OFFLINE]: { category: ErrorCategory.NETWORK_TRANSIENT, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.NETWORK_DNS_FAILURE]: { category: ErrorCategory.NETWORK_TRANSIENT, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.NETWORK_CONNECTION_REFUSED]: { category: ErrorCategory.NETWORK_TRANSIENT, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.NETWORK_HTTP_ERROR]: { category: ErrorCategory.NETWORK_TRANSIENT, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.NETWORK_CORS]: { category: ErrorCategory.FATAL_INCOMPATIBILITY, severity: ErrorSeverity.FATAL, recoverable: false },
    [ErrorCode.NETWORK_ABORTED]: { category: ErrorCategory.NETWORK_TRANSIENT, severity: ErrorSeverity.WARN, recoverable: true },

    // Segment errors
    [ErrorCode.SEGMENT_PARSE_ERROR]: { category: ErrorCategory.SEGMENT_CORRUPTION, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.SEGMENT_INVALID_DATA]: { category: ErrorCategory.SEGMENT_CORRUPTION, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.SEGMENT_MISSING]: { category: ErrorCategory.NETWORK_TRANSIENT, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.SEGMENT_RANGE_ERROR]: { category: ErrorCategory.SEGMENT_CORRUPTION, severity: ErrorSeverity.ERROR, recoverable: true },

    // Decode errors
    [ErrorCode.DECODE_VIDEO_ERROR]: { category: ErrorCategory.DECODE_FAILURE, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.DECODE_AUDIO_ERROR]: { category: ErrorCategory.DECODE_FAILURE, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.DECODE_MEDIA_ERROR]: { category: ErrorCategory.DECODE_FAILURE, severity: ErrorSeverity.ERROR, recoverable: true },

    // MediaSource errors
    [ErrorCode.MSE_CREATE_ERROR]: { category: ErrorCategory.MEDIASOURCE_FAILURE, severity: ErrorSeverity.FATAL, recoverable: false },
    [ErrorCode.MSE_SOURCE_BUFFER_ERROR]: { category: ErrorCategory.MEDIASOURCE_FAILURE, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.MSE_APPEND_ERROR]: { category: ErrorCategory.MEDIASOURCE_FAILURE, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.MSE_REMOVE_ERROR]: { category: ErrorCategory.MEDIASOURCE_FAILURE, severity: ErrorSeverity.WARN, recoverable: true },
    [ErrorCode.MSE_END_OF_STREAM_ERROR]: { category: ErrorCategory.MEDIASOURCE_FAILURE, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.MSE_QUOTA_EXCEEDED]: { category: ErrorCategory.MEDIASOURCE_FAILURE, severity: ErrorSeverity.ERROR, recoverable: true },

    // Compatibility errors - fatal
    [ErrorCode.CODEC_NOT_SUPPORTED]: { category: ErrorCategory.FATAL_INCOMPATIBILITY, severity: ErrorSeverity.FATAL, recoverable: false },
    [ErrorCode.MSE_NOT_SUPPORTED]: { category: ErrorCategory.FATAL_INCOMPATIBILITY, severity: ErrorSeverity.FATAL, recoverable: false },
    [ErrorCode.HLS_NOT_SUPPORTED]: { category: ErrorCategory.FATAL_INCOMPATIBILITY, severity: ErrorSeverity.FATAL, recoverable: false },
    [ErrorCode.DASH_NOT_SUPPORTED]: { category: ErrorCategory.FATAL_INCOMPATIBILITY, severity: ErrorSeverity.FATAL, recoverable: false },
    [ErrorCode.BROWSER_NOT_SUPPORTED]: { category: ErrorCategory.FATAL_INCOMPATIBILITY, severity: ErrorSeverity.FATAL, recoverable: false },

    // Manifest errors
    [ErrorCode.MANIFEST_PARSE_ERROR]: { category: ErrorCategory.SEGMENT_CORRUPTION, severity: ErrorSeverity.FATAL, recoverable: false },
    [ErrorCode.MANIFEST_LOAD_ERROR]: { category: ErrorCategory.NETWORK_TRANSIENT, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.MANIFEST_INVALID]: { category: ErrorCategory.FATAL_INCOMPATIBILITY, severity: ErrorSeverity.FATAL, recoverable: false },

    // Key system errors
    [ErrorCode.KEY_SYSTEM_ERROR]: { category: ErrorCategory.KEY_SYSTEM, severity: ErrorSeverity.FATAL, recoverable: false },
    [ErrorCode.KEY_SESSION_ERROR]: { category: ErrorCategory.KEY_SYSTEM, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.LICENSE_ERROR]: { category: ErrorCategory.KEY_SYSTEM, severity: ErrorSeverity.FATAL, recoverable: false },

    // Player errors
    [ErrorCode.PLAYER_LOAD_ERROR]: { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.PLAYER_STATE_ERROR]: { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.ERROR, recoverable: true },
    [ErrorCode.PLAYER_DESTROYED]: { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.WARN, recoverable: false },

    // Unknown
    [ErrorCode.UNKNOWN_ERROR]: { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.ERROR, recoverable: true },
};

/**
 * Create a PlayerError from error code and message.
 *
 * @param code - Error code
 * @param message - Human-readable error message
 * @param cause - Original error if wrapping
 * @param context - Additional context data
 * @returns PlayerError object
 */
export function createPlayerError(
    code: ErrorCodeValue,
    message: string,
    cause?: Error,
    context?: Record<string, unknown>
): PlayerError {
    const metadata = ERROR_METADATA[code];

    const error: PlayerError = {
        code,
        message,
        category: metadata.category,
        severity: metadata.severity,
        recoverable: metadata.recoverable,
        retryCount: 0,
        ...(cause !== undefined && { cause }),
        ...(context !== undefined && { context }),
    };

    return error;
}

/**
 * Create a PlayerError with updated retry count.
 *
 * @param error - Original error
 * @param retryCount - New retry count
 * @returns New PlayerError with updated retry count
 */
export function withRetryCount(error: PlayerError, retryCount: number): PlayerError {
    return {
        ...error,
        retryCount,
    };
}

/**
 * Check if error is fatal (player must stop).
 *
 * @param error - PlayerError to check
 * @returns True if error is fatal
 */
export function isFatalError(error: PlayerError): boolean {
    return error.severity === ErrorSeverity.FATAL;
}

/**
 * Check if error should be retried.
 *
 * @param error - PlayerError to check
 * @param maxRetries - Maximum retry attempts for this error's category
 * @returns True if error should be retried
 */
export function shouldRetryError(error: PlayerError, maxRetries: number): boolean {
    if (!error.recoverable) {
        return false;
    }

    return error.retryCount < maxRetries;
}

/**
 * Classify a native Error or DOMException into an error code.
 *
 * @param error - Native error to classify
 * @returns Appropriate error code
 */
export function classifyNativeError(error: Error): ErrorCodeValue {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors
    if (name === 'typeerror' && message.includes('network')) {
        return ErrorCode.NETWORK_OFFLINE;
    }
    if (name === 'aborterror' || message.includes('abort')) {
        return ErrorCode.NETWORK_ABORTED;
    }
    if (message.includes('timeout')) {
        return ErrorCode.NETWORK_TIMEOUT;
    }
    if (message.includes('cors') || message.includes('cross-origin')) {
        return ErrorCode.NETWORK_CORS;
    }

    // MediaSource / SourceBuffer errors
    if (name === 'quotaexceedederror' || message.includes('quota')) {
        return ErrorCode.MSE_QUOTA_EXCEEDED;
    }
    if (name === 'invalidstateerror' && message.includes('sourcebuffer')) {
        return ErrorCode.MSE_SOURCE_BUFFER_ERROR;
    }

    // Decode errors (from video element error events)
    if (message.includes('decode') || message.includes('decoder')) {
        return ErrorCode.DECODE_MEDIA_ERROR;
    }

    // Codec errors
    if (message.includes('codec') && message.includes('not supported')) {
        return ErrorCode.CODEC_NOT_SUPPORTED;
    }

    return ErrorCode.UNKNOWN_ERROR;
}

/**
 * Classify an HTTP status code into an error code.
 *
 * @param status - HTTP status code
 * @returns Appropriate error code
 */
export function classifyHttpError(status: number): ErrorCodeValue {
    if (status === 0) {
        return ErrorCode.NETWORK_OFFLINE;
    }
    if (status === 403 || status === 401) {
        return ErrorCode.NETWORK_CORS; // Often CORS manifests as 403/401
    }
    if (status === 404) {
        return ErrorCode.SEGMENT_MISSING;
    }
    if (status >= 500) {
        return ErrorCode.NETWORK_HTTP_ERROR;
    }
    if (status >= 400) {
        return ErrorCode.NETWORK_HTTP_ERROR;
    }

    return ErrorCode.UNKNOWN_ERROR;
}

/**
 * Format a PlayerError for logging.
 *
 * @param error - PlayerError to format
 * @returns Formatted string
 */
export function formatPlayerError(error: PlayerError): string {
    const parts = [
        `[${error.code}]`,
        error.message,
        `(category: ${error.category}, severity: ${error.severity})`,
    ];

    if (error.retryCount > 0) {
        parts.push(`[retry: ${error.retryCount}]`);
    }

    return parts.join(' ');
}
