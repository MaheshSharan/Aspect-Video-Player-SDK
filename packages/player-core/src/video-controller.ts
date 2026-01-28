import {
    EventEmitter,
    createLogger,
    type VideoElementAdapter,
    type Unsubscribe,
    clamp,
} from 'aspect-player-shared';

const logger = createLogger('video-controller');

/**
 * Events emitted by the video controller.
 */
export interface VideoControllerEvents {
    play: void;
    pause: void;
    playing: void;
    waiting: void;
    canplay: void;
    canplaythrough: void;
    ended: void;
    timeupdate: { currentTime: number; duration: number };
    durationchange: { duration: number };
    seeking: { target: number };
    seeked: { position: number };
    volumechange: { volume: number; muted: boolean };
    ratechange: { rate: number };
    error: { error: MediaError | null };
    loadedmetadata: { duration: number; videoWidth: number; videoHeight: number };
    loadeddata: void;
    progress: { buffered: TimeRanges };
    stalled: void;
    suspend: void;
    emptied: void;
}

/**
 * Video controller wraps the HTMLVideoElement and provides
 * a clean interface for the player engine.
 */
export class VideoController implements VideoElementAdapter {
    private readonly video: HTMLVideoElement;
    private readonly events = new EventEmitter<VideoControllerEvents>();
    private readonly boundHandlers = new Map<string, EventListener>();
    private destroyed = false;

    constructor(videoElement: HTMLVideoElement) {
        this.video = videoElement;
        this.attachEventListeners();
        logger.debug('VideoController created');
    }

    // ============================================
    // VideoElementAdapter implementation
    // ============================================

    get currentTime(): number {
        return this.video.currentTime;
    }

    get duration(): number {
        return this.video.duration;
    }

    get paused(): boolean {
        return this.video.paused;
    }

    get ended(): boolean {
        return this.video.ended;
    }

    get readyState(): number {
        return this.video.readyState;
    }

    get buffered(): TimeRanges {
        return this.video.buffered;
    }

    get volume(): number {
        return this.video.volume;
    }

    get muted(): boolean {
        return this.video.muted;
    }

    get playbackRate(): number {
        return this.video.playbackRate;
    }

    get videoWidth(): number {
        return this.video.videoWidth;
    }

    get videoHeight(): number {
        return this.video.videoHeight;
    }

    async play(): Promise<void> {
        this.assertNotDestroyed();
        logger.debug('play() called');
        await this.video.play();
    }

    pause(): void {
        this.assertNotDestroyed();
        logger.debug('pause() called');
        this.video.pause();
    }

    load(): void {
        this.assertNotDestroyed();
        logger.debug('load() called');
        this.video.load();
    }

    setCurrentTime(time: number): void {
        this.assertNotDestroyed();
        const clampedTime = clamp(time, 0, this.duration || Infinity);
        logger.debug(`setCurrentTime: ${clampedTime}`);
        this.video.currentTime = clampedTime;
    }

    setVolume(volume: number): void {
        this.assertNotDestroyed();
        const clampedVolume = clamp(volume, 0, 1);
        logger.debug(`setVolume: ${clampedVolume}`);
        this.video.volume = clampedVolume;
    }

    setMuted(muted: boolean): void {
        this.assertNotDestroyed();
        logger.debug(`setMuted: ${muted}`);
        this.video.muted = muted;
    }

    setPlaybackRate(rate: number): void {
        this.assertNotDestroyed();
        const clampedRate = clamp(rate, 0.25, 4);
        logger.debug(`setPlaybackRate: ${clampedRate}`);
        this.video.playbackRate = clampedRate;
    }

    setSrc(src: string): void {
        this.assertNotDestroyed();
        logger.debug(`setSrc: ${src.substring(0, 50)}...`);
        this.video.src = src;
    }

    getSrc(): string {
        return this.video.src;
    }

    addEventListener<K extends keyof HTMLVideoElementEventMap>(
        type: K,
        listener: (ev: HTMLVideoElementEventMap[K]) => void
    ): void {
        this.video.addEventListener(type, listener as EventListener);
    }

    removeEventListener<K extends keyof HTMLVideoElementEventMap>(
        type: K,
        listener: (ev: HTMLVideoElementEventMap[K]) => void
    ): void {
        this.video.removeEventListener(type, listener as EventListener);
    }

    // ============================================
    // Extended video controller methods
    // ============================================

    /**
     * Get the underlying video element.
     * Use with caution - prefer the abstracted methods.
     */
    getVideoElement(): HTMLVideoElement {
        return this.video;
    }

    /**
     * Subscribe to video controller events.
     */
    on<E extends keyof VideoControllerEvents>(
        event: E,
        handler: (payload: VideoControllerEvents[E]) => void
    ): Unsubscribe {
        return this.events.on(event, handler);
    }

    /**
     * Check if video has enough data to start playback.
     */
    canStartPlayback(): boolean {
        return this.video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
    }

    /**
     * Check if video has enough data for uninterrupted playback.
     */
    hasEnoughData(): boolean {
        return this.video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA;
    }

    /**
     * Get time ranges as a simple array.
     */
    getBufferedRanges(): Array<{ start: number; end: number }> {
        const ranges: Array<{ start: number; end: number }> = [];
        const buffered = this.video.buffered;

        for (let i = 0; i < buffered.length; i++) {
            ranges.push({
                start: buffered.start(i),
                end: buffered.end(i),
            });
        }

        return ranges;
    }

    /**
     * Get the buffered time ahead of current position.
     */
    getForwardBuffer(): number {
        const currentTime = this.video.currentTime;
        const buffered = this.video.buffered;

        for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);

            if (currentTime >= start && currentTime <= end) {
                return end - currentTime;
            }
        }

        return 0;
    }

    /**
     * Reset the video element state.
     */
    reset(): void {
        this.assertNotDestroyed();
        logger.debug('reset() called');

        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
    }

    /**
     * Destroy the controller and remove event listeners.
     */
    destroy(): void {
        if (this.destroyed) {
            return;
        }

        logger.debug('destroy() called');
        this.destroyed = true;

        this.detachEventListeners();
        this.events.removeAllListeners();

        // Clean up video element without assertion
        logger.debug('resetting video state in destroy');
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
    }

    private attachEventListeners(): void {
        const eventHandlers: Array<{
            event: keyof HTMLVideoElementEventMap;
            handler: () => void;
        }> = [
                { event: 'play', handler: () => this.events.emit('play', undefined) },
                { event: 'pause', handler: () => this.events.emit('pause', undefined) },
                { event: 'playing', handler: () => this.events.emit('playing', undefined) },
                { event: 'waiting', handler: () => this.events.emit('waiting', undefined) },
                { event: 'canplay', handler: () => this.events.emit('canplay', undefined) },
                { event: 'canplaythrough', handler: () => this.events.emit('canplaythrough', undefined) },
                { event: 'ended', handler: () => this.events.emit('ended', undefined) },
                { event: 'stalled', handler: () => this.events.emit('stalled', undefined) },
                { event: 'suspend', handler: () => this.events.emit('suspend', undefined) },
                { event: 'emptied', handler: () => this.events.emit('emptied', undefined) },
                { event: 'loadeddata', handler: () => this.events.emit('loadeddata', undefined) },
                {
                    event: 'timeupdate',
                    handler: () =>
                        this.events.emit('timeupdate', {
                            currentTime: this.video.currentTime,
                            duration: this.video.duration,
                        }),
                },
                {
                    event: 'durationchange',
                    handler: () =>
                        this.events.emit('durationchange', {
                            duration: this.video.duration,
                        }),
                },
                {
                    event: 'seeking',
                    handler: () =>
                        this.events.emit('seeking', {
                            target: this.video.currentTime,
                        }),
                },
                {
                    event: 'seeked',
                    handler: () =>
                        this.events.emit('seeked', {
                            position: this.video.currentTime,
                        }),
                },
                {
                    event: 'volumechange',
                    handler: () =>
                        this.events.emit('volumechange', {
                            volume: this.video.volume,
                            muted: this.video.muted,
                        }),
                },
                {
                    event: 'ratechange',
                    handler: () =>
                        this.events.emit('ratechange', {
                            rate: this.video.playbackRate,
                        }),
                },
                {
                    event: 'error',
                    handler: () =>
                        this.events.emit('error', {
                            error: this.video.error,
                        }),
                },
                {
                    event: 'loadedmetadata',
                    handler: () =>
                        this.events.emit('loadedmetadata', {
                            duration: this.video.duration,
                            videoWidth: this.video.videoWidth,
                            videoHeight: this.video.videoHeight,
                        }),
                },
                {
                    event: 'progress',
                    handler: () =>
                        this.events.emit('progress', {
                            buffered: this.video.buffered,
                        }),
                },
            ];

        for (const { event, handler } of eventHandlers) {
            const listener = handler as EventListener;
            this.boundHandlers.set(event, listener);
            this.video.addEventListener(event, listener);
        }
    }

    private detachEventListeners(): void {
        for (const [event, handler] of this.boundHandlers) {
            this.video.removeEventListener(event, handler);
        }
        this.boundHandlers.clear();
    }

    private assertNotDestroyed(): void {
        if (this.destroyed) {
            throw new Error('VideoController has been destroyed');
        }
    }
}
