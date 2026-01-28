import { ErrorCategory, type ErrorCategoryValue } from './types';

/**
 * Retry state for tracking retry attempts.
 */
export interface RetryState {
    /** Current attempt number (0 = initial attempt) */
    attempt: number;
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Base delay in milliseconds */
    baseDelayMs: number;
    /** Maximum delay in milliseconds */
    maxDelayMs: number;
    /** Whether to use exponential backoff */
    exponential: boolean;
    /** Jitter factor (0-1) to add randomness */
    jitterFactor: number;
    /** Last error that occurred */
    lastError: Error | null;
    /** Timestamp of last attempt */
    lastAttemptTime: number;
}

/**
 * Retry policy configuration per error category.
 */
export interface RetryPolicy {
    /** Maximum retry attempts */
    maxAttempts: number;
    /** Base delay between retries in ms */
    baseDelayMs: number;
    /** Maximum delay between retries in ms */
    maxDelayMs: number;
    /** Whether to use exponential backoff */
    exponential: boolean;
}

/**
 * Default retry policies by error category.
 * These are production-tuned values based on real-world streaming behavior.
 */
export const DEFAULT_RETRY_POLICIES: Record<ErrorCategoryValue, RetryPolicy> = {
    [ErrorCategory.NETWORK_TRANSIENT]: {
        maxAttempts: 5,
        baseDelayMs: 1000,
        maxDelayMs: 16000,
        exponential: true,
    },
    [ErrorCategory.SEGMENT_CORRUPTION]: {
        maxAttempts: 2,
        baseDelayMs: 0,
        maxDelayMs: 0,
        exponential: false,
    },
    [ErrorCategory.DECODE_FAILURE]: {
        maxAttempts: 1,
        baseDelayMs: 0,
        maxDelayMs: 0,
        exponential: false,
    },
    [ErrorCategory.MEDIASOURCE_FAILURE]: {
        maxAttempts: 2,
        baseDelayMs: 1000,
        maxDelayMs: 2000,
        exponential: false,
    },
    [ErrorCategory.FATAL_INCOMPATIBILITY]: {
        maxAttempts: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        exponential: false,
    },
    [ErrorCategory.KEY_SYSTEM]: {
        maxAttempts: 1,
        baseDelayMs: 1000,
        maxDelayMs: 1000,
        exponential: false,
    },
    [ErrorCategory.UNKNOWN]: {
        maxAttempts: 2,
        baseDelayMs: 1000,
        maxDelayMs: 4000,
        exponential: true,
    },
};

/**
 * Create initial retry state from policy.
 *
 * @param policy - Retry policy to use
 * @returns Initial retry state
 */
export function createRetryState(policy: RetryPolicy): RetryState {
    return {
        attempt: 0,
        maxAttempts: policy.maxAttempts,
        baseDelayMs: policy.baseDelayMs,
        maxDelayMs: policy.maxDelayMs,
        exponential: policy.exponential,
        jitterFactor: 0.2, // 20% jitter by default
        lastError: null,
        lastAttemptTime: 0,
    };
}

/**
 * Check if retry is allowed based on current state.
 *
 * @param state - Current retry state
 * @returns True if retry is allowed
 */
export function canRetry(state: RetryState): boolean {
    return state.attempt < state.maxAttempts;
}

/**
 * Calculate delay before next retry attempt.
 * Uses exponential backoff with jitter if configured.
 *
 * @param state - Current retry state
 * @returns Delay in milliseconds before next retry
 */
export function calculateRetryDelay(state: RetryState): number {
    if (state.baseDelayMs === 0) {
        return 0;
    }

    let delay: number;

    if (state.exponential) {
        // Exponential backoff: baseDelay * 2^attempt
        delay = state.baseDelayMs * Math.pow(2, state.attempt);
    } else {
        delay = state.baseDelayMs;
    }

    // Apply maximum cap
    delay = Math.min(delay, state.maxDelayMs);

    // Apply jitter to prevent thundering herd
    if (state.jitterFactor > 0) {
        const jitter = delay * state.jitterFactor * Math.random();
        delay = delay + jitter;
    }

    return Math.round(delay);
}

/**
 * Record a retry attempt.
 *
 * @param state - Current retry state (mutated)
 * @param error - Error that caused the retry
 */
export function recordRetryAttempt(state: RetryState, error: Error): void {
    state.attempt += 1;
    state.lastError = error;
    state.lastAttemptTime = Date.now();
}

/**
 * Reset retry state for a new operation.
 *
 * @param state - Retry state to reset (mutated)
 */
export function resetRetryState(state: RetryState): void {
    state.attempt = 0;
    state.lastError = null;
    state.lastAttemptTime = 0;
}

/**
 * Get retry policy for an error category.
 *
 * @param category - Error category
 * @param customPolicies - Optional custom policies to override defaults
 * @returns Retry policy
 */
export function getRetryPolicy(
    category: ErrorCategoryValue,
    customPolicies?: Partial<Record<ErrorCategoryValue, Partial<RetryPolicy>>>
): RetryPolicy {
    const defaultPolicy = DEFAULT_RETRY_POLICIES[category];
    const customPolicy = customPolicies?.[category];

    if (customPolicy === undefined) {
        return defaultPolicy;
    }

    return {
        ...defaultPolicy,
        ...customPolicy,
    };
}

/**
 * Execute an async operation with retry logic.
 *
 * @param operation - Async operation to execute
 * @param policy - Retry policy
 * @param shouldRetry - Optional function to determine if specific error should be retried
 * @returns Promise resolving to operation result
 */
export async function executeWithRetry<T>(
    operation: () => Promise<T>,
    policy: RetryPolicy,
    shouldRetry?: (error: Error, state: RetryState) => boolean
): Promise<T> {
    const state = createRetryState(policy);

    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            return await operation();
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            recordRetryAttempt(state, err);

            if (!canRetry(state)) {
                throw err;
            }

            if (shouldRetry !== undefined && !shouldRetry(err, state)) {
                throw err;
            }

            const delay = calculateRetryDelay(state);
            if (delay > 0) {
                await sleep(delay);
            }
        }
    }
}

/**
 * Sleep for specified duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise that rejects after specified duration.
 *
 * @param ms - Timeout duration in milliseconds
 * @param message - Error message for timeout
 * @returns Promise that rejects after duration
 */
export function timeout(ms: number, message?: string): Promise<never> {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(message ?? `Operation timed out after ${ms}ms`));
        }, ms);
    });
}

/**
 * Race an operation against a timeout.
 *
 * @param operation - Promise to race
 * @param ms - Timeout duration in milliseconds
 * @param message - Error message for timeout
 * @returns Operation result or timeout error
 */
export function withTimeout<T>(operation: Promise<T>, ms: number, message?: string): Promise<T> {
    return Promise.race([operation, timeout(ms, message)]);
}
