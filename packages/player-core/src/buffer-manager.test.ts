import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BufferManager, type BufferManagerConfig } from './buffer-manager';

// Mock dependencies
vi.mock('@aspect/shared', async () => {
    const actual = await vi.importActual('@aspect/shared');
    return {
        ...actual,
        detectPlatform: () => ({ isMobile: false, isTablet: false }),
        createLogger: () => ({
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }),
    };
});

describe('BufferManager', () => {
    let bufferManager: BufferManager;

    afterEach(() => {
        if (bufferManager) {
            bufferManager.destroy();
        }
    });

    it('initializes with default desktop limits', () => {
        bufferManager = new BufferManager();
        const info = bufferManager.getBufferInfo();
        expect(info.maxBuffer).toBe(40);
        expect(info.targetBuffer).toBe(30);
    });

    it('respects custom config', () => {
        const config: BufferManagerConfig = {
            maxBufferLength: 60,
            targetBufferLength: 50,
        };
        bufferManager = new BufferManager(config);
        const info = bufferManager.getBufferInfo();
        expect(info.maxBuffer).toBe(60);
        expect(info.targetBuffer).toBe(50);
    });

    it('calculates forward buffer correctly', () => {
        bufferManager = new BufferManager();

        // Mock buffered ranges: [0, 10], [20, 30]
        const mockBuffered = {
            length: 2,
            start: (i: number) => (i === 0 ? 0 : 20),
            end: (i: number) => (i === 0 ? 10 : 30),
        } as TimeRanges;

        // Current time 5 (inside first range)
        bufferManager.updateBuffer(5, mockBuffered);
        let info = bufferManager.getBufferInfo();
        expect(info.forwardBuffer).toBe(5); // 10 - 5

        // Current time 25 (inside second range)
        bufferManager.updateBuffer(25, mockBuffered);
        info = bufferManager.getBufferInfo();
        expect(info.forwardBuffer).toBe(5); // 30 - 25

        // Current time 15 (gap)
        bufferManager.updateBuffer(15, mockBuffered);
        info = bufferManager.getBufferInfo();
        expect(info.forwardBuffer).toBe(0);
    });

    it('detects low buffer', () => {
        bufferManager = new BufferManager({ minBufferLength: 10 });
        const onLowBuffer = vi.fn();
        bufferManager.on('bufferlow', onLowBuffer);

        const mockBuffered = {
            length: 1,
            start: () => 0,
            end: () => 5,
        } as unknown as TimeRanges;

        bufferManager.updateBuffer(0, mockBuffered);
        // Forward buffer 5 < min 10
        expect(onLowBuffer).toHaveBeenCalledWith({ forwardBuffer: 5 });
    });

    it('identifies eviction ranges', () => {
        bufferManager = new BufferManager({
            backBufferLength: 10,
            maxBufferLength: 20,
        });

        // Current time 100
        // Buffered: [0, 80] (old), [90, 130] (current + future)
        // Back buffer limit: 100 - 10 = 90
        // Forward buffer limit: 100 + 20 = 120

        // Expected eviction:
        // [0, 80] -> ranges completely behind 90 -> Evict [0, 80]
        // [90, 130] -> starts at 90 (safe), ends at 130 (> 120). 
        // Should evict [120, 130].

        const mockBuffered = {
            length: 2,
            start: (i: number) => (i === 0 ? 0 : 90),
            end: (i: number) => (i === 0 ? 80 : 130),
        } as unknown as TimeRanges;

        bufferManager.updateBuffer(100, mockBuffered);
        const evictions = bufferManager.getEvictionRanges();

        // Expect eviction of old buffer
        expect(evictions).toContainEqual({ start: 0, end: 80 });

        // Expect eviction of excess forward buffer
        expect(evictions).toContainEqual({ start: 120, end: 130 });
    });
});
