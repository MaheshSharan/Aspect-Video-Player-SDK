import {
    PlayerState,
    type PlayerStateValue,
    type MediaSourceConfig,
    type QualityLevel,
    type PlayerError,
    type PlayerConfig,
    type Unsubscribe,
    EventEmitter,
    createLogger,
    createPlayerError,
    ErrorCode,
    clamp,
    sleep,
    type SubtitleTrack,
} from 'aspect-player-shared';

import type {
    PlayerEngine,
    PlayerEventMap,
    PlayerEventHandler,
    PlayerSnapshot,
    EngineConfig,
} from './types';

import { PlayerStateMachine } from './state-machine';
import { VideoController } from './video-controller';
import { BufferManager } from './buffer-manager';
import { ABRController, type SegmentTiming } from './abr-controller';
import { ErrorController, RecoveryAction, shouldInterruptPlayback, getUserErrorMessage } from './error-controller';

const logger = createLogger('player-engine');

/**
 * Source adapter interface for HLS/DASH/MP4 sources.
 * Implemented by player-sources package.
 */
export interface SourceAdapter {
    /** Adapter name for logging */
    readonly name: string;

    /** Attach to video element */
    attach(video: HTMLVideoElement): Promise<void>;

    /** Load the source */
    load(config: MediaSourceConfig): Promise<void>;

    /** Get available quality levels */
    getQualityLevels(): QualityLevel[];

    /** Set quality level (-1 for auto) */
    setQualityLevel(index: number): void;

    /** Get current quality level index */
    getCurrentQualityLevel(): number;

    /** Register segment timing for ABR */
    onSegmentLoaded(callback: (timing: SegmentTiming) => void): Unsubscribe;

    /** Register error handler */
    onError(callback: (error: PlayerError) => void): Unsubscribe;

    /** Get available subtitle tracks */
    getSubtitleTracks(): SubtitleTrack[];

    /** Set subtitle track */
    setSubtitleTrack(trackId: string | null): void;

    /** Register subtitle tracks changed callback */
    onSubtitleTracksChanged(callback: (tracks: SubtitleTrack[]) => void): Unsubscribe;

    /** Destroy the adapter */
    destroy(): void;
}

/**
 * Factory function to create source adapters.
 */
export type SourceAdapterFactory = (config: MediaSourceConfig) => SourceAdapter | null;

/**
 * Core player engine implementation.
 */
export class CorePlayerEngine implements PlayerEngine {
    private readonly config: PlayerConfig;
    private readonly video: HTMLVideoElement;
    private readonly videoController: VideoController;
    private readonly stateMachine: PlayerStateMachine;
    private readonly bufferManager: BufferManager;
    private readonly abrController: ABRController;
    private readonly errorController: ErrorController;
    private readonly events = new EventEmitter<PlayerEventMap>();

    private sourceAdapterFactory: SourceAdapterFactory | null = null;
    private sourceAdapter: SourceAdapter | null = null;
    private currentSource: MediaSourceConfig | null = null;

    private subtitleTracks: SubtitleTrack[] = [];
    private currentSubtitleTrack: SubtitleTrack | null = null;

    private readonly subscriptions: Unsubscribe[] = [];
    private destroyed = false;
    private loadId = 0; // Tracks current load operation to abort stale loads

    constructor(engineConfig: EngineConfig) {
        this.config = engineConfig;
        this.video = engineConfig.videoElement;

        this.videoController = new VideoController(this.video);
        this.stateMachine = new PlayerStateMachine();
        this.bufferManager = new BufferManager({
            maxBufferLength: engineConfig.maxBufferLength,
            targetBufferLength: engineConfig.targetBufferLength,
        });
        this.abrController = new ABRController(engineConfig.abr);
        this.errorController = new ErrorController();

        this.setupEventBindings();
        this.applyInitialConfig();

        logger.info('CorePlayerEngine created');
    }

    /**
     * Register a source adapter factory.
     * This is called by player-sources package to register adapters.
     */
    registerSourceAdapterFactory(factory: SourceAdapterFactory): void {
        this.sourceAdapterFactory = factory;
    }

    // ============================================
    // PlayerEngine interface implementation
    // ============================================

    async load(source: MediaSourceConfig): Promise<void> {
        this.assertNotDestroyed();
        logger.info(`Loading source: ${source.url.substring(0, 60)}...`);

        // Increment load ID to abort any pending load
        const currentLoadId = ++this.loadId;

        // Reset if already loaded
        if (this.currentSource !== null) {
            await this.reset();
        }

        // Check if load was superseded
        if (currentLoadId !== this.loadId) {
            logger.debug('Load aborted - superseded by newer load');
            return;
        }

        try {
            this.stateMachine.transitionTo(PlayerState.LOADING, 'load');
            this.emitStateChange(PlayerState.LOADING, PlayerState.IDLE);

            // Initialize source adapter
            const adapterFactory = this.sourceAdapterFactory;
            if (adapterFactory === null) {
                throw createPlayerError(ErrorCode.UNKNOWN_ERROR, 'No source adapter factory registered');
            }

            const adapter = adapterFactory(source);
            if (adapter === null) {
                throw createPlayerError(ErrorCode.PLAYER_LOAD_ERROR, 'No supported adapter found for source');
            }

            this.sourceAdapter = adapter;
            this.currentSource = source;

            try {
                await adapter.attach(this.video);

                // Setup ABR callback
                this.subscriptions.push(
                    adapter.onSegmentLoaded((timing) => {
                        this.abrController.recordSegmentTiming(timing);
                    })
                );

                // Setup error handler
                this.subscriptions.push(
                    adapter.onError((error) => {
                        void this.handleError(error);
                    })
                );

                await adapter.load(source);

                this.bufferManager.reset();
                this.abrController.reset();

                // Setup subtitle handler
                this.subscriptions.push(
                    adapter.onSubtitleTracksChanged((tracks) => {
                        console.log('[CorePlayerEngine] Received subtitle tracks from adapter:', tracks);
                        this.subtitleTracks = tracks;
                        this.events.emit('subtitletracks', { tracks });
                    })
                );

                // Initial subtitle tracks (if any already loaded or synchronous)
                this.subtitleTracks = adapter.getSubtitleTracks();
                if (this.subtitleTracks.length > 0) {
                    console.log('[CorePlayerEngine] Initial subtitle tracks found:', this.subtitleTracks);
                    this.events.emit('subtitletracks', { tracks: this.subtitleTracks });
                }

            } catch (error) {
                void this.handleError(this.wrapError(error));
                throw error;
            }

            // Set quality levels
            const levels = adapter.getQualityLevels();
            this.abrController.setLevels(levels);
            this.events.emit('qualitylevels', { levels });

            // Transition to ready
            this.stateMachine.transitionTo(PlayerState.READY, 'loaded');
            this.emitStateChange(PlayerState.READY, PlayerState.LOADING);

            this.events.emit('loaded', { source });

            // Handle autoplay
            if (this.config.autoplay === true) {
                await this.play();
            }
        } catch (error) {
            const playerError = this.wrapError(error);
            this.stateMachine.forceTransition(PlayerState.ERROR);
            this.emitStateChange(PlayerState.ERROR, PlayerState.LOADING);
            this.events.emit('error', playerError);
            throw playerError;
        }
    }


    async retry(): Promise<void> {
        if (this.currentSource === null) {
            return;
        }

        logger.info('Retrying playback of current source');
        await this.load(this.currentSource);
    }

    async play(): Promise<void> {
        this.assertNotDestroyed();
        logger.debug('play() called');

        if (!this.stateMachine.isPlayable() && !this.stateMachine.isPlaying()) {
            throw createPlayerError(
                ErrorCode.PLAYER_STATE_ERROR,
                `Cannot play in state: ${this.stateMachine.getState()}`
            );
        }

        try {
            await this.videoController.play();
        } catch (error) {
            // Handle autoplay blocking
            if (error instanceof DOMException && error.name === 'NotAllowedError') {
                logger.warn('Autoplay blocked, muting and retrying');
                this.videoController.setMuted(true);
                await this.videoController.play();
            } else {
                throw error;
            }
        }
    }

    pause(): void {
        this.assertNotDestroyed();
        logger.debug('pause() called');

        if (this.stateMachine.isPlaying() || this.stateMachine.getState() === PlayerState.BUFFERING) {
            this.videoController.pause();
        }
    }

    seek(seconds: number): void {
        this.assertNotDestroyed();
        logger.debug(`seek(${seconds}) called`);

        const duration = this.videoController.duration;
        const clampedTime = clamp(seconds, 0, Number.isFinite(duration) ? duration : Infinity);

        this.events.emit('seeking', { target: clampedTime });
        this.videoController.setCurrentTime(clampedTime);
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }

        logger.info('Destroying CorePlayerEngine');
        this.destroyed = true;

        // Cleanup subscriptions
        for (const unsub of this.subscriptions) {
            unsub();
        }
        this.subscriptions.length = 0;

        // Destroy components
        this.sourceAdapter?.destroy();
        this.sourceAdapter = null;

        this.videoController.destroy();
        this.bufferManager.destroy();
        this.abrController.destroy();
        this.errorController.destroy();

        this.events.emit('destroyed', undefined);
        this.events.removeAllListeners();
    }

    getSnapshot(): PlayerSnapshot {
        return {
            state: this.stateMachine.getState(),
            currentTime: this.videoController.currentTime,
            duration: this.videoController.duration,
            buffered: this.bufferManager.getBufferInfo(),
            volume: this.videoController.volume,
            muted: this.videoController.muted,
            playbackRate: this.videoController.playbackRate,
            isLive: this.isLiveStream(),
            qualityLevels: this.abrController.getState().levels,
            currentQuality: this.abrController.getState().currentLevel,
            abrEnabled: this.abrController.getState().mode === 'auto',
            error: this.errorController.getLastError() ?? undefined,
            subtitleTracks: this.subtitleTracks,
            currentSubtitleTrack: this.currentSubtitleTrack,
        };
    }

    on<E extends keyof PlayerEventMap>(event: E, handler: PlayerEventHandler<E>): Unsubscribe {
        return this.events.on(event, handler as (payload: PlayerEventMap[E]) => void);
    }

    once<E extends keyof PlayerEventMap>(event: E, handler: PlayerEventHandler<E>): Unsubscribe {
        return this.events.once(event, handler as (payload: PlayerEventMap[E]) => void);
    }

    off<E extends keyof PlayerEventMap>(event: E, handler: PlayerEventHandler<E>): void {
        this.events.off(event, handler as (payload: PlayerEventMap[E]) => void);
    }

    setVolume(volume: number): void {
        this.assertNotDestroyed();
        this.videoController.setVolume(clamp(volume, 0, 1));
    }

    setMuted(muted: boolean): void {
        this.assertNotDestroyed();
        this.videoController.setMuted(muted);
    }

    setPlaybackRate(rate: number): void {
        this.assertNotDestroyed();
        this.videoController.setPlaybackRate(clamp(rate, 0.25, 4));
    }

    setQuality(levelIndex: number): void {
        this.assertNotDestroyed();

        if (levelIndex < 0) {
            this.abrController.setAutoLevel();
        } else {
            this.abrController.setManualLevel(levelIndex);
        }

        this.sourceAdapter?.setQualityLevel(levelIndex);
    }

    setSubtitleTrack(trackId: string | null): void {
        this.assertNotDestroyed();

        // Find track object
        if (trackId === null) {
            this.currentSubtitleTrack = null;
        } else {
            const track = this.subtitleTracks.find(t => t.id === trackId);
            if (track) {
                this.currentSubtitleTrack = track;
            } else {
                logger.warn(`Subtitle track not found: ${trackId}`);
                return;
            }
        }

        this.sourceAdapter?.setSubtitleTrack(trackId);
        this.events.emit('subtitletrackchange', { trackId });
    }

    setAutoQuality(enabled: boolean): void {
        this.assertNotDestroyed();

        if (enabled) {
            this.abrController.setAutoLevel();
            this.sourceAdapter?.setQualityLevel(-1);
        }
    }

    async requestPictureInPicture(): Promise<void> {
        this.assertNotDestroyed();

        if (!document.pictureInPictureEnabled) {
            throw new Error('Picture-in-Picture not supported');
        }

        await this.video.requestPictureInPicture();
    }

    async exitPictureInPicture(): Promise<void> {
        if (document.pictureInPictureElement === this.video) {
            await document.exitPictureInPicture();
        }
    }

    async requestFullscreen(): Promise<void> {
        this.assertNotDestroyed();

        const container = this.video.parentElement ?? this.video;

        if (container.requestFullscreen !== undefined) {
            await container.requestFullscreen();
        } else if ('webkitRequestFullscreen' in container) {
            await (container as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        }
    }

    async exitFullscreen(): Promise<void> {
        if (document.fullscreenElement !== null) {
            await document.exitFullscreen();
        } else if ('webkitExitFullscreen' in document) {
            await (document as Document & { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
        }
    }

    // ============================================
    // Private methods
    // ============================================

    private setupEventBindings(): void {
        // Video controller events
        this.subscriptions.push(
            this.videoController.on('playing', () => {
                if (this.stateMachine.canTransitionTo(PlayerState.PLAYING)) {
                    const prev = this.stateMachine.getState();
                    this.stateMachine.transitionTo(PlayerState.PLAYING, 'play');
                    this.emitStateChange(PlayerState.PLAYING, prev);
                }
            })
        );

        this.subscriptions.push(
            this.videoController.on('pause', () => {
                if (this.stateMachine.canTransitionTo(PlayerState.PAUSED)) {
                    const prev = this.stateMachine.getState();
                    this.stateMachine.transitionTo(PlayerState.PAUSED, 'pause');
                    this.emitStateChange(PlayerState.PAUSED, prev);
                }
            })
        );

        this.subscriptions.push(
            this.videoController.on('waiting', () => {
                if (this.stateMachine.canTransitionTo(PlayerState.BUFFERING)) {
                    const prev = this.stateMachine.getState();
                    this.stateMachine.transitionTo(PlayerState.BUFFERING, 'stall');
                    this.emitStateChange(PlayerState.BUFFERING, prev);
                    this.events.emit('waiting', undefined);
                }
            })
        );

        this.subscriptions.push(
            this.videoController.on('canplay', () => {
                if (this.stateMachine.getState() === PlayerState.BUFFERING) {
                    const prev = this.stateMachine.getState();
                    this.stateMachine.transitionTo(PlayerState.PLAYING, 'resume');
                    this.emitStateChange(PlayerState.PLAYING, prev);
                }
                this.events.emit('canplay', undefined);
            })
        );

        this.subscriptions.push(
            this.videoController.on('ended', () => {
                if (this.stateMachine.canTransitionTo(PlayerState.ENDED)) {
                    const prev = this.stateMachine.getState();
                    this.stateMachine.transitionTo(PlayerState.ENDED, 'end');
                    this.emitStateChange(PlayerState.ENDED, prev);
                    this.events.emit('ended', undefined);
                }
            })
        );

        this.subscriptions.push(
            this.videoController.on('timeupdate', ({ currentTime, duration }) => {
                this.bufferManager.updateBuffer(currentTime, this.video.buffered);
                this.abrController.updateBufferState(this.bufferManager.getBufferInfo().forwardBuffer);

                this.events.emit('timeupdate', {
                    currentTime,
                    duration,
                    isLive: this.isLiveStream(),
                    liveEdge: undefined,
                    liveLatency: undefined,
                });
            })
        );

        this.subscriptions.push(
            this.videoController.on('durationchange', ({ duration }) => {
                this.events.emit('durationchange', { duration });
            })
        );

        this.subscriptions.push(
            this.videoController.on('seeked', ({ position }) => {
                this.events.emit('seeked', { position });
            })
        );

        this.subscriptions.push(
            this.videoController.on('volumechange', ({ volume, muted }) => {
                this.events.emit('volumechange', { volume, muted });
            })
        );

        this.subscriptions.push(
            this.videoController.on('ratechange', ({ rate }) => {
                this.events.emit('ratechange', { rate });
            })
        );

        this.subscriptions.push(
            this.videoController.on('error', ({ error }) => {
                if (error !== null) {
                    void this.handleError(
                        createPlayerError(ErrorCode.DECODE_MEDIA_ERROR, error.message)
                    );
                }
            })
        );

        // Buffer manager events
        this.subscriptions.push(
            this.bufferManager.on('bufferupdate', (info) => {
                this.events.emit('bufferupdate', info);
            })
        );

        // ABR controller events
        this.subscriptions.push(
            this.abrController.on('qualitychange', ({ level, auto }) => {
                this.events.emit('qualitychange', { level, auto });
            })
        );

        this.subscriptions.push(
            this.abrController.on('stateupdate', (state) => {
                this.events.emit('abrupdate', state);
            })
        );

        // Fullscreen events
        if (typeof document !== 'undefined') {
            const handleFullscreen = (): void => {
                const isFullscreen = document.fullscreenElement !== null ||
                    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement !== undefined;
                this.events.emit('fullscreenchange', { fullscreen: isFullscreen });
            };

            document.addEventListener('fullscreenchange', handleFullscreen);
            document.addEventListener('webkitfullscreenchange', handleFullscreen);

            this.subscriptions.push(() => {
                document.removeEventListener('fullscreenchange', handleFullscreen);
                document.removeEventListener('webkitfullscreenchange', handleFullscreen);
            });
        }

        // PiP events
        this.video.addEventListener('enterpictureinpicture', () => {
            this.events.emit('pipchange', { active: true });
        });

        this.video.addEventListener('leavepictureinpicture', () => {
            this.events.emit('pipchange', { active: false });
        });
    }

    private applyInitialConfig(): void {
        if (this.config.volume !== undefined) {
            this.videoController.setVolume(this.config.volume);
        }

        if (this.config.muted === true) {
            this.videoController.setMuted(true);
        }

        if (this.config.loop === true) {
            this.video.loop = true;
        }
    }

    private async handleError(error: PlayerError): Promise<void> {
        logger.error('Error occurred:', error.message);

        const strategy = this.errorController.handleError(error);

        if (strategy.action === RecoveryAction.NONE) {
            // Fatal error
            if (shouldInterruptPlayback(error)) {
                this.stateMachine.forceTransition(PlayerState.ERROR);
                this.emitStateChange(PlayerState.ERROR, this.stateMachine.getState());
            }
            this.events.emit('error', error);
            return;
        }

        // Wait for delay
        if (strategy.delayMs > 0) {
            await sleep(strategy.delayMs);
        }

        // Execute recovery
        switch (strategy.action) {
            case RecoveryAction.RETRY:
                // The source adapter handles retry internally
                break;

            case RecoveryAction.SKIP_SEGMENT:
                // Source adapter should skip to next segment
                break;

            case RecoveryAction.QUALITY_FALLBACK:
                this.abrController.updateDroppedFrames(Infinity); // Force quality drop
                break;

            case RecoveryAction.REINIT_SOURCE:
                if (this.currentSource !== null) {
                    await this.reset();
                    await this.load(this.currentSource);
                }
                break;
        }
    }

    private wrapError(error: unknown): PlayerError {
        if (this.isPlayerError(error)) {
            return error;
        }

        if (error instanceof Error) {
            return createPlayerError(ErrorCode.UNKNOWN_ERROR, error.message, error);
        }

        return createPlayerError(ErrorCode.UNKNOWN_ERROR, String(error));
    }

    private isPlayerError(error: unknown): error is PlayerError {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            'category' in error &&
            'severity' in error
        );
    }

    private async reset(): Promise<void> {
        logger.debug('Resetting player');

        this.sourceAdapter?.destroy();
        this.sourceAdapter = null;

        this.videoController.reset();
        this.abrController.reset();
        this.errorController.clearRetryStates();

        this.stateMachine.reset();
    }

    private isLiveStream(): boolean {
        const duration = this.videoController.duration;
        // Only consider it live if duration is actually Infinity (live stream)
        // NaN means metadata hasn't loaded yet - not a live stream
        return duration === Infinity;
    }

    private emitStateChange(state: PlayerStateValue, previousState: PlayerStateValue): void {
        this.events.emit('statechange', { state, previousState });
    }

    private assertNotDestroyed(): void {
        if (this.destroyed) {
            throw createPlayerError(ErrorCode.PLAYER_DESTROYED, 'Player has been destroyed');
        }
    }
}

export { getUserErrorMessage };
