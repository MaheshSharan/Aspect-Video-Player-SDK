/**
 * Clamp a value between min and max.
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Format seconds as HH:MM:SS or MM:SS.
 *
 * @param seconds - Duration in seconds
 * @param forceHours - Always show hours even if zero
 * @returns Formatted time string
 */
export function formatTime(seconds: number, forceHours = false): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return forceHours ? '00:00:00' : '00:00';
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts: string[] = [];

    if (h > 0 || forceHours) {
        parts.push(h.toString().padStart(2, '0'));
    }

    parts.push(m.toString().padStart(2, '0'));
    parts.push(s.toString().padStart(2, '0'));

    return parts.join(':');
}

/**
 * Parse a time string into seconds.
 *
 * @param time - Time string (HH:MM:SS or MM:SS)
 * @returns Duration in seconds
 */
export function parseTime(time: string): number {
    const parts = time.split(':').map((p) => parseInt(p, 10));

    if (parts.length === 3) {
        const [h, m, s] = parts;
        if (h !== undefined && m !== undefined && s !== undefined) {
            return h * 3600 + m * 60 + s;
        }
    }

    if (parts.length === 2) {
        const [m, s] = parts;
        if (m !== undefined && s !== undefined) {
            return m * 60 + s;
        }
    }

    return 0;
}

/**
 * Format bytes as human-readable string.
 *
 * @param bytes - Number of bytes
 * @param decimals - Decimal places
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = sizes[i];

    if (size === undefined) {
        return bytes.toFixed(decimals) + ' Bytes';
    }

    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + size;
}

/**
 * Format bitrate as human-readable string.
 *
 * @param bitrate - Bitrate in bits per second
 * @returns Formatted string (e.g., "5.2 Mbps")
 */
export function formatBitrate(bitrate: number): string {
    if (bitrate >= 1_000_000) {
        return (bitrate / 1_000_000).toFixed(1) + ' Mbps';
    }
    if (bitrate >= 1_000) {
        return (bitrate / 1_000).toFixed(0) + ' Kbps';
    }
    return bitrate.toFixed(0) + ' bps';
}

/**
 * Debounce a function.
 *
 * @param fn - Function to debounce
 * @param ms - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
    fn: T,
    ms: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, ms);
    };
}

/**
 * Throttle a function.
 *
 * @param fn - Function to throttle
 * @param ms - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
    fn: T,
    ms: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        const now = Date.now();
        const elapsed = now - lastCall;

        if (elapsed >= ms) {
            lastCall = now;
            fn(...args);
        } else if (timeoutId === null) {
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                timeoutId = null;
                fn(...args);
            }, ms - elapsed);
        }
    };
}

/**
 * Generate a unique ID.
 *
 * @param prefix - Optional prefix
 * @returns Unique ID string
 */
export function generateId(prefix = 'id'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Check if value is defined (not null or undefined).
 *
 * @param value - Value to check
 * @returns True if defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
    return value !== undefined && value !== null;
}

/**
 * Assert that a condition is true.
 * Throws an error if the condition is false.
 *
 * @param condition - Condition to check
 * @param message - Error message if assertion fails
 */
export function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

/**
 * Assert that a value is never (exhaustive check).
 * Useful for switch statements.
 *
 * @param value - Value that should be never
 * @param message - Error message
 */
export function assertNever(value: never, message?: string): never {
    throw new Error(message ?? `Unexpected value: ${String(value)}`);
}

/**
 * Deep freeze an object (make it immutable).
 *
 * @param obj - Object to freeze
 * @returns Frozen object
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
    const propNames = Object.getOwnPropertyNames(obj) as (keyof T)[];

    for (const name of propNames) {
        const value = obj[name];
        if (value !== null && typeof value === 'object') {
            deepFreeze(value);
        }
    }

    return Object.freeze(obj);
}

/**
 * Create a shallow copy of an object with some properties omitted.
 *
 * @param obj - Source object
 * @param keys - Keys to omit
 * @returns New object without specified keys
 */
export function omit<T extends object, K extends keyof T>(
    obj: T,
    keys: readonly K[]
): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result;
}

/**
 * Create a shallow copy of an object with only specified properties.
 *
 * @param obj - Source object
 * @param keys - Keys to pick
 * @returns New object with only specified keys
 */
export function pick<T extends object, K extends keyof T>(
    obj: T,
    keys: readonly K[]
): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}
