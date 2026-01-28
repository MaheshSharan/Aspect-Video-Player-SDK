import {
    EventEmitter,
    createLogger,
    type PlayerError,
    type ErrorCategoryValue,
    type Unsubscribe,
    ErrorCategory,
    ErrorSeverity,
    getRetryPolicy,
    createRetryState,
    canRetry,
    calculateRetryDelay,
    recordRetryAttempt,
    resetRetryState,
    isFatalError,
    formatPlayerError,
    type RetryState,
    type RetryPolicy,
} from '@aspect/shared';

const logger = createLogger('error-controller');

/**
 * Error controller events.
 */
export interface ErrorControllerEvents {
    /** Error occurred */
    error: PlayerError;
    /** Recovery attempt started */
    recovery: { error: PlayerError; attempt: number; maxAttempts: number };
    /** Recovery succeeded */
    recovered: { error: PlayerError };
    /** Recovery failed (fatal) */
    fatal: PlayerError;
}

/**
 * Recovery action to take for an error.
 */
export const RecoveryAction = {
    /** Retry the failed operation */
    RETRY: 'retry',
    /** Skip to next segment */
    SKIP_SEGMENT: 'skip_segment',
    /** Fall back to lower quality */
    QUALITY_FALLBACK: 'quality_fallback',
    /** Reinitialize the source */
    REINIT_SOURCE: 'reinit_source',
    /** No recovery possible */
    NONE: 'none',
} as const;

export type RecoveryActionValue = (typeof RecoveryAction)[keyof typeof RecoveryAction];

/**
 * Recovery strategy for an error.
 */
export interface RecoveryStrategy {
    action: RecoveryActionValue;
    delayMs: number;
    context?: Record<string, unknown>;
}

/**
 * Error controller handles error classification, recovery strategies,
 * and retry logic for the player.
 */
export class ErrorController {
    private readonly events = new EventEmitter<ErrorControllerEvents>();
    private readonly retryStates = new Map<string, RetryState>();
    private readonly customPolicies: Partial<Record<ErrorCategoryValue, Partial<RetryPolicy>>>;

    private lastError: PlayerError | null = null;
    private destroyed = false;

    constructor(customPolicies?: Partial<Record<ErrorCategoryValue, Partial<RetryPolicy>>>) {
        this.customPolicies = customPolicies ?? {};
        logger.debug('ErrorController created');
    }

    /**
     * Handle an error and determine recovery strategy.
     *
     * @param error - The error that occurred
     * @returns Recovery strategy to execute
     */
    handleError(error: PlayerError): RecoveryStrategy {
        if (this.destroyed) {
            return { action: RecoveryAction.NONE, delayMs: 0 };
        }

        this.lastError = error;
        logger.warn(formatPlayerError(error));

        this.events.emit('error', error);

        // Fatal errors have no recovery
        if (isFatalError(error)) {
            logger.error('Fatal error, no recovery possible');
            this.events.emit('fatal', error);
            return { action: RecoveryAction.NONE, delayMs: 0 };
        }

        // Get or create retry state for this error
        const retryKey = this.getRetryKey(error);
        let retryState = this.retryStates.get(retryKey);

        if (retryState === undefined) {
            const policy = getRetryPolicy(error.category, this.customPolicies);
            retryState = createRetryState(policy);
            this.retryStates.set(retryKey, retryState);
        }

        // Check if we can retry
        if (!canRetry(retryState)) {
            logger.error(`Max retries exceeded for ${error.code}`);
            this.events.emit('fatal', error);
            return { action: RecoveryAction.NONE, delayMs: 0 };
        }

        // Record this attempt
        recordRetryAttempt(retryState, error.cause ?? new Error(error.message));
        const delay = calculateRetryDelay(retryState);

        this.events.emit('recovery', {
            error,
            attempt: retryState.attempt,
            maxAttempts: retryState.maxAttempts,
        });

        // Determine recovery action based on error category
        const action = this.getRecoveryAction(error);

        logger.info(
            `Recovery strategy: ${action} after ${delay}ms (attempt ${retryState.attempt}/${retryState.maxAttempts})`
        );

        return {
            action,
            delayMs: delay,
            context: { attempt: retryState.attempt },
        };
    }

    /**
     * Mark recovery as successful for an error type.
     */
    markRecovered(error: PlayerError): void {
        const retryKey = this.getRetryKey(error);
        const retryState = this.retryStates.get(retryKey);

        if (retryState !== undefined) {
            resetRetryState(retryState);
            logger.debug(`Recovery successful for ${error.code}`);
            this.events.emit('recovered', { error });
        }
    }

    /**
     * Clear all retry states (e.g., on source change).
     */
    clearRetryStates(): void {
        this.retryStates.clear();
        this.lastError = null;
        logger.debug('Retry states cleared');
    }

    /**
     * Get the last error that occurred.
     */
    getLastError(): PlayerError | null {
        return this.lastError;
    }

    /**
     * Check if there's an active fatal error.
     */
    hasFatalError(): boolean {
        return this.lastError !== null && isFatalError(this.lastError);
    }

    /**
     * Subscribe to error controller events.
     */
    on<E extends keyof ErrorControllerEvents>(
        event: E,
        handler: (payload: ErrorControllerEvents[E]) => void
    ): Unsubscribe {
        return this.events.on(event, handler);
    }

    /**
     * Destroy the error controller.
     */
    destroy(): void {
        if (this.destroyed) return;

        logger.debug('Destroying ErrorController');
        this.destroyed = true;
        this.retryStates.clear();
        this.events.removeAllListeners();
    }

    /**
     * Determine the appropriate recovery action for an error.
     */
    private getRecoveryAction(error: PlayerError): RecoveryActionValue {
        switch (error.category) {
            case ErrorCategory.NETWORK_TRANSIENT:
                return RecoveryAction.RETRY;

            case ErrorCategory.SEGMENT_CORRUPTION: {
                // First try retry, then skip
                const retryKey = this.getRetryKey(error);
                const state = this.retryStates.get(retryKey);
                if (state !== undefined && state.attempt > 1) {
                    return RecoveryAction.SKIP_SEGMENT;
                }
                return RecoveryAction.RETRY;
            }

            case ErrorCategory.DECODE_FAILURE:
                return RecoveryAction.QUALITY_FALLBACK;

            case ErrorCategory.MEDIASOURCE_FAILURE:
                return RecoveryAction.REINIT_SOURCE;

            case ErrorCategory.KEY_SYSTEM:
                // DRM errors typically need full reinit
                return RecoveryAction.REINIT_SOURCE;

            case ErrorCategory.FATAL_INCOMPATIBILITY:
                return RecoveryAction.NONE;

            case ErrorCategory.UNKNOWN:
            default:
                return RecoveryAction.RETRY;
        }
    }

    /**
     * Generate a key for tracking retry state across similar errors.
     */
    private getRetryKey(error: PlayerError): string {
        // Group errors by code and category for retry tracking
        return `${error.category}:${error.code}`;
    }
}

/**
 * Helper to determine if an error should interrupt playback.
 *
 * @param error - PlayerError to check
 * @returns True if playback should be interrupted
 */
export function shouldInterruptPlayback(error: PlayerError): boolean {
    // Fatal errors always interrupt
    if (error.severity === ErrorSeverity.FATAL) {
        return true;
    }

    // MSE failures typically require interruption
    if (error.category === ErrorCategory.MEDIASOURCE_FAILURE) {
        return true;
    }

    // Key system errors interrupt
    if (error.category === ErrorCategory.KEY_SYSTEM) {
        return true;
    }

    return false;
}

/**
 * Get user-facing error message for display.
 *
 * @param error - PlayerError
 * @returns Human-readable error message
 */
export function getUserErrorMessage(error: PlayerError): string {
    switch (error.category) {
        case ErrorCategory.NETWORK_TRANSIENT:
            return 'Connection error. Please check your internet connection.';

        case ErrorCategory.SEGMENT_CORRUPTION:
            return 'Video data error. Attempting to recover...';

        case ErrorCategory.DECODE_FAILURE:
            return 'Playback error. Switching to a different quality...';

        case ErrorCategory.MEDIASOURCE_FAILURE:
            return 'Player error. Reloading video...';

        case ErrorCategory.FATAL_INCOMPATIBILITY:
            return 'This video format is not supported by your browser.';

        case ErrorCategory.KEY_SYSTEM:
            return 'Content protection error. Please try again.';

        case ErrorCategory.UNKNOWN:
        default:
            return 'An unexpected error occurred. Please try again.';
    }
}
