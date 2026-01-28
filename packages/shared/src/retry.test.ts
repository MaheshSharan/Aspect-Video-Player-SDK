import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    createRetryState,
    canRetry,
    calculateRetryDelay,
    executeWithRetry,
    type RetryPolicy,
} from './retry';

describe('Retry Logic', () => {
    describe('calculateRetryDelay', () => {
        it('calculates linear backoff correctly', () => {
            const policy: RetryPolicy = {
                maxAttempts: 3,
                baseDelayMs: 1000,
                maxDelayMs: 5000,
                exponential: false,
            };
            const state = createRetryState(policy);
            state.jitterFactor = 0; // Disable jitter for deterministic testing

            state.attempt = 0;
            expect(calculateRetryDelay(state)).toBe(1000);

            state.attempt = 1;
            expect(calculateRetryDelay(state)).toBe(1000);
        });

        it('calculates exponential backoff correctly', () => {
            const policy: RetryPolicy = {
                maxAttempts: 5,
                baseDelayMs: 1000,
                maxDelayMs: 10000,
                exponential: true,
            };
            const state = createRetryState(policy);
            state.jitterFactor = 0;

            state.attempt = 0;
            expect(calculateRetryDelay(state)).toBe(1000); // 1000 * 2^0

            state.attempt = 1;
            expect(calculateRetryDelay(state)).toBe(2000); // 1000 * 2^1

            state.attempt = 2;
            expect(calculateRetryDelay(state)).toBe(4000); // 1000 * 2^2
        });

        it('respects max delay cap', () => {
            const policy: RetryPolicy = {
                maxAttempts: 5,
                baseDelayMs: 1000,
                maxDelayMs: 2500,
                exponential: true,
            };
            const state = createRetryState(policy);
            state.jitterFactor = 0;

            state.attempt = 2; // Should be 4000 without cap
            expect(calculateRetryDelay(state)).toBe(2500);
        });
    });

    describe('executeWithRetry', () => {
        const policy: RetryPolicy = {
            maxAttempts: 3,
            baseDelayMs: 10,
            maxDelayMs: 100,
            exponential: false,
        };

        it('resolves immediately if operation succeeds', async () => {
            const operation = vi.fn().mockResolvedValue('success');
            const result = await executeWithRetry(operation, policy);

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('retries on failure and eventually succeeds', async () => {
            const operation = vi.fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockRejectedValueOnce(new Error('fail 2'))
                .mockResolvedValue('success');

            const result = await executeWithRetry(operation, policy);

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(3);
        });

        it('throws after exceeding max attempts', async () => {
            const operation = vi.fn().mockRejectedValue(new Error('fail'));

            // policy.maxAttempts is 3. 
            // Attempt 0 (initial) -> fail
            // Attempt 1 -> fail
            // Attempt 2 -> fail
            // Attempt 3 -> fail -> stop?
            // canRetry checks attempt < maxAttempts.
            // attempt starts at 0.
            // After 1st fail, attempt becomes 1. 1 < 3, continue.
            // After 2nd fail, attempt becomes 2. 2 < 3, continue.
            // After 3rd fail, attempt becomes 3. 3 < 3 is false. Stop.
            // So it runs 3 times total? 
            // Actually recordRetryAttempt increments attempt.
            // initial call: attempt 0. fail. record -> attempt=1. check canRetry(1 < 3). Retry.
            // retry 1: attempt 1. fail. record -> attempt=2. check canRetry(2 < 3). Retry.
            // retry 2: attempt 2. fail. record -> attempt=3. check canRetry(3 < 3). Fail.
            // So 3 calls total.

            await expect(executeWithRetry(operation, policy)).rejects.toThrow('fail');
            expect(operation).toHaveBeenCalledTimes(3);
        });
    });
});
