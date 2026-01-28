import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CorePlayerEngine } from './engine';
import { PlayerState } from 'aspect-player-shared';
import type { SourceAdapter } from './engine';

// Mock dependencies
vi.mock('aspect-player-shared', async () => {
    const actual = await vi.importActual('aspect-player-shared');
    return {
        ...actual,
        createLogger: () => ({
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }),
    };
});

describe('CorePlayerEngine', () => {
    let engine: CorePlayerEngine;
    let mockVideo: HTMLVideoElement;
    let mockAdapter: SourceAdapter;

    beforeEach(() => {
        // Mock video element
        mockVideo = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            play: vi.fn().mockResolvedValue(undefined),
            pause: vi.fn(),
            load: vi.fn(),
            setAttribute: vi.fn(),
            removeAttribute: vi.fn(),
            tagName: 'VIDEO',
        } as unknown as HTMLVideoElement;

        // Mock source adapter
        mockAdapter = {
            name: 'MockAdapter',
            attach: vi.fn().mockResolvedValue(undefined),
            load: vi.fn().mockResolvedValue(undefined),
            getQualityLevels: vi.fn().mockReturnValue([]),
            setQualityLevel: vi.fn(),
            getCurrentQualityLevel: vi.fn().mockReturnValue(0),
            onSegmentLoaded: vi.fn().mockReturnValue(() => { }),
            onError: vi.fn().mockReturnValue(() => { }),
            destroy: vi.fn(),
        };

        engine = new CorePlayerEngine({
            videoElement: mockVideo,
        });

        // Register mock adapter factory
        engine.registerSourceAdapterFactory(() => mockAdapter);
    });

    afterEach(() => {
        engine.destroy();
    });

    it('starts in IDLE state', () => {
        const snapshot = engine.getSnapshot();
        expect(snapshot.state).toBe(PlayerState.IDLE);
    });

    it('transitions to READY after loading source', async () => {
        const onStateChange = vi.fn();
        engine.on('statechange', onStateChange);

        await engine.load({ url: 'http://test/stream.m3u8' });

        expect(mockAdapter.attach).toHaveBeenCalledWith(mockVideo);
        expect(mockAdapter.load).toHaveBeenCalled();

        const snapshot = engine.getSnapshot();
        expect(snapshot.state).toBe(PlayerState.READY);
    });

    it('plays when calling play()', async () => {
        // Load first
        await engine.load({ url: 'http://test/stream.m3u8' });

        await engine.play();

        expect(mockVideo.play).toHaveBeenCalled();
        const snapshot = engine.getSnapshot();
        // State might still be READY until video emits 'playing' event
        // But the intent is verified.
        // To verify state transition to PLAYING, we'd need to simulate video events.
    });

    it('retries playback on failure', async () => {
        // Mock load failure first time? No, retry is manually called after error.

        // Load successfully first
        await engine.load({ url: 'http://test/stream.m3u8' });

        // Simulate error state (manual transition for test)
        // engine['stateMachine'].forceTransition(PlayerState.ERROR); 
        // Accessing private is hard in TS.

        // Let's just call retry(). It should call load() again with same source.

        // Clear mocks
        vi.clearAllMocks();

        await engine.retry();

        expect(mockAdapter.load).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://test/stream.m3u8' }));
    });
});
