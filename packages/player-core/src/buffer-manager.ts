import {
    EventEmitter,
    createLogger,
    detectPlatform,
    type Unsubscribe,
    type BufferInfo,
    type BufferRange,
    throttle,
} from '@aspect/shared';

const logger = createLogger('buffer-manager');

/**
 * Buffer manager configuration.
 */
export interface BufferManagerConfig {
    /** Maximum forward buffer in seconds (overrides platform default) */
    maxBufferLength?: number;
    /** Target forward buffer in seconds */
    targetBufferLength?: number;
    /** Minimum buffer before requesting more data */
    minBufferLength?: number;
    /** Buffer behind playhead to keep in seconds */
    backBufferLength?: number;
}

/**
 * Buffer manager events.
 */
export interface BufferManagerEvents {
    /** Buffer state updated */
    bufferupdate: BufferInfo;
    /** Buffer is low, need more data */
    bufferlow: { forwardBuffer: number };
    /** Buffer is sufficient */
    buffersufficient: void;
    /** Buffer eviction performed */
    bufferevicted: { start: number; end: number };
}

/**
 * Platform-aware buffer limits.
 */
const PLATFORM_BUFFER_LIMITS = {
    mobile: {
        maxBuffer: 20,       // 20 seconds on mobile
        targetBuffer: 15,
        minBuffer: 5,
        backBuffer: 20,
    },
    desktop: {
        maxBuffer: 40,       // 40 seconds on desktop
        targetBuffer: 30,
        minBuffer: 10,
        backBuffer: 30,
    },
} as const;

/**
 * Buffer manager handles buffer health monitoring, eviction,
 * and buffer target management with platform-aware limits.
 */
export class BufferManager {
    private readonly config: Required<BufferManagerConfig>;
    private readonly events = new EventEmitter<BufferManagerEvents>();
    private readonly isMobile: boolean;

    private currentTime = 0;
    private bufferedRanges: BufferRange[] = [];
    private isPageVisible = true;
    private destroyed = false;

    private readonly throttledUpdate: () => void;

    constructor(config: BufferManagerConfig = {}) {
        const platform = detectPlatform();
        this.isMobile = platform.isMobile || platform.isTablet;

        const platformLimits = this.isMobile
            ? PLATFORM_BUFFER_LIMITS.mobile
            : PLATFORM_BUFFER_LIMITS.desktop;

        this.config = {
            maxBufferLength: config.maxBufferLength ?? platformLimits.maxBuffer,
            targetBufferLength: config.targetBufferLength ?? platformLimits.targetBuffer,
            minBufferLength: config.minBufferLength ?? platformLimits.minBuffer,
            backBufferLength: config.backBufferLength ?? platformLimits.backBuffer,
        };

        logger.info(
            `BufferManager created (mobile: ${this.isMobile}, max: ${this.config.maxBufferLength}s)`
        );

        // Throttle buffer updates to avoid excessive events
        this.throttledUpdate = throttle(() => this.emitBufferUpdate(), 250);

        // Listen for page visibility changes
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
        }
    }

    /**
     * Update buffer state from TimeRanges.
     *
     * @param currentTime - Current playback position
     * @param buffered - TimeRanges from video/SourceBuffer
     */
    updateBuffer(currentTime: number, buffered: TimeRanges): void {
        if (this.destroyed) return;

        this.currentTime = currentTime;
        this.bufferedRanges = this.timeRangesToArray(buffered);

        this.throttledUpdate();
        this.checkBufferHealth();
    }

    /**
     * Get current buffer info.
     */
    getBufferInfo(): BufferInfo {
        const forwardBuffer = this.calculateForwardBuffer();
        const backwardBuffer = this.calculateBackwardBuffer();

        return {
            ranges: this.bufferedRanges,
            currentTime: this.currentTime,
            forwardBuffer,
            backwardBuffer,
            targetBuffer: this.getEffectiveTargetBuffer(),
            maxBuffer: this.getEffectiveMaxBuffer(),
        };
    }

    /**
     * Check if we should request more data.
     */
    needsMoreData(): boolean {
        const forwardBuffer = this.calculateForwardBuffer();
        return forwardBuffer < this.getEffectiveTargetBuffer();
    }

    /**
     * Check if buffer is critically low.
     */
    isBufferCritical(): boolean {
        const forwardBuffer = this.calculateForwardBuffer();
        return forwardBuffer < this.config.minBufferLength;
    }

    /**
     * Check if we have enough buffer to append more data.
     * Returns false if we're already at max buffer.
     */
    canAppendMore(): boolean {
        const forwardBuffer = this.calculateForwardBuffer();
        return forwardBuffer < this.getEffectiveMaxBuffer();
    }

    /**
     * Calculate eviction ranges for buffer cleanup.
     * Returns ranges that should be removed.
     */
    getEvictionRanges(): Array<{ start: number; end: number }> {
        const evictions: Array<{ start: number; end: number }> = [];
        const safeBackBuffer = this.currentTime - this.config.backBufferLength;

        for (const range of this.bufferedRanges) {
            // Evict data too far behind playhead
            if (range.end < safeBackBuffer) {
                evictions.push({ start: range.start, end: range.end });
                continue;
            }

            // Evict partial range behind playhead
            if (range.start < safeBackBuffer && range.end >= safeBackBuffer) {
                evictions.push({ start: range.start, end: safeBackBuffer });
            }

            // Check for excess forward buffer
            const maxBufferEnd = this.currentTime + this.getEffectiveMaxBuffer();
            if (range.end > maxBufferEnd && range.start < maxBufferEnd) {
                evictions.push({ start: maxBufferEnd, end: range.end });
            }
        }

        return evictions;
    }

    /**
     * Get effective max buffer considering page visibility.
     */
    getEffectiveMaxBuffer(): number {
        // Reduce buffer when page is hidden to save memory
        if (!this.isPageVisible) {
            return Math.min(this.config.maxBufferLength, 10);
        }
        return this.config.maxBufferLength;
    }

    /**
     * Get effective target buffer considering page visibility.
     */
    getEffectiveTargetBuffer(): number {
        if (!this.isPageVisible) {
            return Math.min(this.config.targetBufferLength, 8);
        }
        return this.config.targetBufferLength;
    }

    /**
     * Subscribe to buffer manager events.
     */
    on<E extends keyof BufferManagerEvents>(
        event: E,
        handler: (payload: BufferManagerEvents[E]) => void
    ): Unsubscribe {
        return this.events.on(event, handler);
    }

    /**
     * Destroy the buffer manager.
     */
    destroy(): void {
        if (this.destroyed) return;

        logger.debug('Destroying BufferManager');
        this.destroyed = true;

        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }

        this.events.removeAllListeners();
    }

    private calculateForwardBuffer(): number {
        for (const range of this.bufferedRanges) {
            if (this.currentTime >= range.start && this.currentTime <= range.end) {
                return range.end - this.currentTime;
            }
        }
        return 0;
    }

    private calculateBackwardBuffer(): number {
        for (const range of this.bufferedRanges) {
            if (this.currentTime >= range.start && this.currentTime <= range.end) {
                return this.currentTime - range.start;
            }
        }
        return 0;
    }

    private timeRangesToArray(ranges: TimeRanges): BufferRange[] {
        const result: BufferRange[] = [];
        for (let i = 0; i < ranges.length; i++) {
            result.push({
                start: ranges.start(i),
                end: ranges.end(i),
            });
        }
        return result;
    }

    private checkBufferHealth(): void {
        const forwardBuffer = this.calculateForwardBuffer();

        if (forwardBuffer < this.config.minBufferLength) {
            this.events.emit('bufferlow', { forwardBuffer });
        } else if (forwardBuffer >= this.getEffectiveTargetBuffer()) {
            this.events.emit('buffersufficient', undefined);
        }
    }

    private emitBufferUpdate(): void {
        if (this.destroyed) return;
        this.events.emit('bufferupdate', this.getBufferInfo());
    }

    private handleVisibilityChange = (): void => {
        const wasVisible = this.isPageVisible;
        this.isPageVisible = document.visibilityState === 'visible';

        if (wasVisible !== this.isPageVisible) {
            logger.debug(`Page visibility changed: ${this.isPageVisible ? 'visible' : 'hidden'}`);
            this.throttledUpdate();
        }
    };
    /**
     * Reset buffer state.
     */
    reset(): void {
        this.currentTime = 0;
        this.bufferedRanges = [];
        this.throttledUpdate();
    }
}
