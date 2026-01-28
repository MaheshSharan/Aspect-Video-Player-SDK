import type { PlayerEngine, PlayerSnapshot } from 'aspect-player-core';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Unsubscribe } from 'aspect-player-shared';
import type { UIComponent, PlayerUIConfig } from './types';
import { CSS_CLASSES } from './types';
import { injectStyles } from './inject-styles';
import {
    PlayButton,
    SeekBar,
    TimeDisplay,
    VolumeControl,
    FullscreenButton,
    PiPButton,
    SkipBackButton,
    SkipForwardButton,
    TitleDisplay,
    SubtitleButton,
} from './controls';
import { QualitySelector, SpeedSelector, LoadingSpinner, ErrorOverlay } from './menus';
import { SubtitleManager } from './subtitles';
import { ThumbnailManager } from './thumbnail-preview';

/**
 * Player UI orchestrates all UI components and connects them to the player engine.
 */
export class PlayerUI {
    private readonly config: PlayerUIConfig;
    private readonly engine: PlayerEngine;
    private readonly components: UIComponent[] = [];
    private readonly subscriptions: Unsubscribe[] = [];

    private container: HTMLDivElement | null = null;
    private controlsBar: HTMLDivElement | null = null;
    private titleDisplay: TitleDisplay | null = null;
    private subtitleManager: SubtitleManager | null = null;
    private thumbnailManager: ThumbnailManager | null = null;
    private autohideTimeout: ReturnType<typeof setTimeout> | null = null;
    private isControlsVisible = true;
    private destroyed = false;

    constructor(engine: PlayerEngine, config: PlayerUIConfig) {
        // Auto-inject CSS styles on first instantiation
        injectStyles();

        this.engine = engine;
        this.config = {
            autohide: config.autohide ?? true,
            autohideDelay: config.autohideDelay ?? 3000,
            showQualitySelector: config.showQualitySelector ?? true,
            showSpeedSelector: config.showSpeedSelector ?? true,
            showPiP: config.showPiP ?? true,
            classPrefix: config.classPrefix ?? '',
            ...config,
        };

        this.build();
        this.bindEvents();
        this.scheduleAutohide();
    }

    /**
     * Get the UI container element.
     */
    getContainer(): HTMLElement | null {
        return this.container;
    }

    /**
     * Show the controls.
     */
    showControls(): void {
        this.isControlsVisible = true;
        this.updateControlsVisibility();
        this.scheduleAutohide();
    }

    /**
     * Hide the controls.
     */
    hideControls(): void {
        this.isControlsVisible = false;
        this.updateControlsVisibility();
    }

    /**
     * Set the displayed title and optional episode info.
     */
    setTitle(title: string, episodeInfo?: string): void {
        this.titleDisplay?.setTitle(title, episodeInfo);
    }

    /**
     * Destroy the UI and cleanup resources.
     */
    destroy(): void {
        if (this.destroyed) return;

        this.destroyed = true;

        // Cleanup autohide
        if (this.autohideTimeout !== null) {
            clearTimeout(this.autohideTimeout);
        }

        // Cleanup subscriptions
        for (const unsub of this.subscriptions) {
            unsub();
        }

        // Cleanup keyboard listener
        document.removeEventListener('keydown', this.handleKeyDown);

        // Destroy components
        for (const component of this.components) {
            component.destroy();
        }

        // Destroy managers
        this.subtitleManager?.destroy();
        this.thumbnailManager?.destroy();

        // Remove container
        this.container?.remove();
        this.container = null;
        this.controlsBar = null;
    }

    private build(): void {
        const prefix = this.config.classPrefix ?? '';

        // Create main container
        this.container = document.createElement('div');
        this.container.className = `${prefix}${CSS_CLASSES.CONTAINER}`;

        // Create overlays
        const spinner = new LoadingSpinner(this.config);
        this.components.push(spinner);
        this.container.appendChild(spinner.render());

        const error = new ErrorOverlay(this.config, () => this.handleRetry());
        this.components.push(error);
        this.container.appendChild(error.render());

        // Create controls bar
        this.controlsBar = document.createElement('div');
        this.controlsBar.className = `${prefix}${CSS_CLASSES.CONTROLS}`;

        // ==================================================
        // Top row: Seek bar + Time display
        // ==================================================
        const topRow = document.createElement('div');
        topRow.className = `${prefix}${CSS_CLASSES.CONTROLS_ROW}`;

        const seekBar = new SeekBar(this.config, (pos) => this.engine.seek(pos));
        this.components.push(seekBar);
        topRow.appendChild(seekBar.render());

        const timeDisplay = new TimeDisplay(this.config);
        this.components.push(timeDisplay);
        topRow.appendChild(timeDisplay.render());

        // ==================================================
        // Bottom row: Netflix-style control bar
        // Layout: [LEFT] [CENTER] [RIGHT]
        // ==================================================
        const bottomRow = document.createElement('div');
        bottomRow.className = `${prefix}${CSS_CLASSES.CONTROLS_ROW} ${prefix}player-controls__row--bottom`;

        // --- LEFT GROUP ---
        // Play | Skip Back | Skip Forward | Volume
        const leftGroup = document.createElement('div');
        leftGroup.className = `${prefix}${CSS_CLASSES.CONTROLS_LEFT}`;

        // Play button
        const playBtn = new PlayButton(this.config, () => this.handlePlayPause());
        this.components.push(playBtn);
        leftGroup.appendChild(playBtn.render());

        // Skip Back button (10 seconds)
        const skipBackBtn = new SkipBackButton(this.config, () => this.handleSkipBack(), 10);
        this.components.push(skipBackBtn);
        leftGroup.appendChild(skipBackBtn.render());

        // Skip Forward button (10 seconds)
        const skipForwardBtn = new SkipForwardButton(this.config, () => this.handleSkipForward(), 10);
        this.components.push(skipForwardBtn);
        leftGroup.appendChild(skipForwardBtn.render());

        // Volume control
        const volumeCtrl = new VolumeControl(
            this.config,
            (vol) => this.engine.setVolume(vol),
            (muted) => this.engine.setMuted(muted)
        );
        this.components.push(volumeCtrl);
        leftGroup.appendChild(volumeCtrl.render());

        bottomRow.appendChild(leftGroup);

        // --- CENTER GROUP ---
        // Title display
        const centerGroup = document.createElement('div');
        centerGroup.className = `${prefix}${CSS_CLASSES.CONTROLS_CENTER}`;

        const title = this.config.title ?? '';
        const episodeInfo = this.config.episodeInfo ?? '';
        this.titleDisplay = new TitleDisplay(this.config, title, episodeInfo);
        this.components.push(this.titleDisplay);
        centerGroup.appendChild(this.titleDisplay.render());

        bottomRow.appendChild(centerGroup);

        // --- RIGHT GROUP ---
        // Quality | Subtitles | Speed | PiP | Fullscreen
        const rightGroup = document.createElement('div');
        rightGroup.className = `${prefix}${CSS_CLASSES.CONTROLS_RIGHT}`;

        // Quality selector (optional)
        if (this.config.showQualitySelector) {
            const qualitySelector = new QualitySelector(
                this.config,
                (index) => this.engine.setQuality(index)
            );
            this.components.push(qualitySelector);
            rightGroup.appendChild(qualitySelector.render());
        }

        // Subtitle button (only shown if showSubtitles is explicitly true)
        if (this.config.showSubtitles === true) {
            const subtitleBtn = new SubtitleButton(this.config, () => this.handleSubtitles());
            this.components.push(subtitleBtn);
            rightGroup.appendChild(subtitleBtn.render());
        }

        // Speed selector (optional)
        if (this.config.showSpeedSelector) {
            const speedSelector = new SpeedSelector(this.config, (rate) =>
                this.engine.setPlaybackRate(rate)
            );
            this.components.push(speedSelector);
            rightGroup.appendChild(speedSelector.render());
        }

        // PiP button (optional)
        if (this.config.showPiP && document.pictureInPictureEnabled) {
            const pipBtn = new PiPButton(this.config, () => this.handlePiP());
            this.components.push(pipBtn);
            rightGroup.appendChild(pipBtn.render());
        }

        // Fullscreen button
        const fullscreenBtn = new FullscreenButton(this.config, () => this.handleFullscreen());
        this.components.push(fullscreenBtn);
        rightGroup.appendChild(fullscreenBtn.render());

        bottomRow.appendChild(rightGroup);

        // Assemble controls bar
        this.controlsBar.appendChild(topRow);
        this.controlsBar.appendChild(bottomRow);
        this.container.appendChild(this.controlsBar);

        // Initialize subtitle manager and overlay
        if (this.config.subtitleTracks && this.config.subtitleTracks.length > 0) {
            this.subtitleManager = new SubtitleManager(this.config);
            this.subtitleManager.createOverlay(this.container);
            this.subtitleManager.setTracks(this.config.subtitleTracks.map(t => ({
                id: t.id,
                label: t.label,
                language: t.language,
                url: t.url,
                default: t.default,
            })));
        }

        // Initialize thumbnail manager
        if (this.config.thumbnailTrack) {
            this.thumbnailManager = new ThumbnailManager(this.config);
            void this.thumbnailManager.load(this.config.thumbnailTrack);
        }

        // Append to config container
        this.config.container.appendChild(this.container);
    }

    private bindEvents(): void {
        // Listen for player events and update UI
        this.subscriptions.push(
            this.engine.on('statechange', () => this.updateComponents())
        );

        this.subscriptions.push(
            this.engine.on('timeupdate', () => this.updateComponents())
        );

        this.subscriptions.push(
            this.engine.on('bufferupdate', () => this.updateComponents())
        );

        this.subscriptions.push(
            this.engine.on('qualitylevels', () => this.updateComponents())
        );

        this.subscriptions.push(
            this.engine.on('qualitychange', () => this.updateComponents())
        );

        this.subscriptions.push(
            this.engine.on('volumechange', () => this.updateComponents())
        );

        this.subscriptions.push(
            this.engine.on('ratechange', () => this.updateComponents())
        );

        this.subscriptions.push(
            this.engine.on('error', () => this.updateComponents())
        );

        // Mouse events for autohide
        this.container?.addEventListener('mousemove', this.handleMouseMove);
        this.container?.addEventListener('mouseleave', this.handleMouseLeave);
        this.container?.addEventListener('click', this.handleClick);

        // Touch events
        this.container?.addEventListener('touchstart', this.handleTouchStart);

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        // Only handle if player container is focused or video is playing
        if (!this.container?.contains(document.activeElement) &&
            document.activeElement !== document.body) {
            return;
        }

        const snapshot = this.engine.getSnapshot();

        switch (e.key) {
            case ' ':
            case 'k':
                // Space or K: Play/Pause
                e.preventDefault();
                this.handlePlayPause();
                this.showControls();
                break;

            case 'm':
            case 'M':
                // M: Toggle mute
                e.preventDefault();
                this.engine.setMuted(!snapshot.muted);
                this.showControls();
                break;

            case 'ArrowLeft':
                // Left arrow: Seek back 10s
                e.preventDefault();
                this.handleSkipBack();
                this.showControls();
                break;

            case 'ArrowRight':
                // Right arrow: Seek forward 10s
                e.preventDefault();
                this.handleSkipForward();
                this.showControls();
                break;

            case 'ArrowUp':
                // Up arrow: Volume up 10%
                e.preventDefault();
                this.engine.setVolume(Math.min(1, snapshot.volume + 0.1));
                this.showControls();
                break;

            case 'ArrowDown':
                // Down arrow: Volume down 10%
                e.preventDefault();
                this.engine.setVolume(Math.max(0, snapshot.volume - 0.1));
                this.showControls();
                break;

            case 'f':
            case 'F':
                // F: Toggle fullscreen
                e.preventDefault();
                this.handleFullscreen();
                this.showControls();
                break;

            case 'j':
            case 'J':
                // J: Seek back 10s (YouTube style)
                e.preventDefault();
                this.handleSkipBack();
                this.showControls();
                break;

            case 'l':
            case 'L':
                // L: Seek forward 10s (YouTube style)
                e.preventDefault();
                this.handleSkipForward();
                this.showControls();
                break;
        }
    };

    private updateComponents(): void {
        if (this.destroyed) return;

        const snapshot = this.engine.getSnapshot();

        for (const component of this.components) {
            component.update(snapshot);
        }

        // Update subtitles
        this.subtitleManager?.update(snapshot);
    }

    private updateControlsVisibility(): void {
        if (this.controlsBar === null) return;

        const prefix = this.config.classPrefix ?? '';

        if (this.isControlsVisible) {
            this.controlsBar.classList.remove(`${prefix}${CSS_CLASSES.CONTROLS_HIDDEN}`);
        } else {
            this.controlsBar.classList.add(`${prefix}${CSS_CLASSES.CONTROLS_HIDDEN}`);
        }
    }

    private scheduleAutohide(): void {
        if (!this.config.autohide) return;

        if (this.autohideTimeout !== null) {
            clearTimeout(this.autohideTimeout);
        }

        this.autohideTimeout = setTimeout(() => {
            const snapshot = this.engine.getSnapshot();
            // Only hide if playing
            if (snapshot.state === 'playing') {
                this.hideControls();
            }
        }, this.config.autohideDelay);
    }

    private handlePlayPause(): void {
        const snapshot = this.engine.getSnapshot();

        if (snapshot.state === 'playing') {
            this.engine.pause();
        } else {
            void this.engine.play();
        }
    }

    private handleFullscreen(): void {
        if (document.fullscreenElement !== null) {
            void this.engine.exitFullscreen();
        } else {
            void this.engine.requestFullscreen();
        }
    }

    private handlePiP(): void {
        if (document.pictureInPictureElement !== null) {
            void this.engine.exitPictureInPicture();
        } else {
            void this.engine.requestPictureInPicture();
        }
    }

    private handleRetry(): void {
        // Attempt to reload the current source
        const snapshot = this.engine.getSnapshot();
        if (snapshot.state === 'error') {
            void this.engine.retry();
        }
    }

    private handleSkipBack(): void {
        const snapshot = this.engine.getSnapshot();
        const newTime = Math.max(0, snapshot.currentTime - 10);
        this.engine.seek(newTime);
    }

    private handleSkipForward(): void {
        const snapshot = this.engine.getSnapshot();
        const newTime = Math.min(snapshot.duration, snapshot.currentTime + 10);
        this.engine.seek(newTime);
    }

    private handleSubtitles(): void {
        if (this.subtitleManager === null) return;

        // Toggle subtitles on/off
        this.subtitleManager.toggle();
    }


    private handleMouseMove = (): void => {
        this.showControls();
    };

    private handleMouseLeave = (): void => {
        const snapshot = this.engine.getSnapshot();
        if (snapshot.state === 'playing') {
            this.hideControls();
        }
    };

    private handleClick = (): void => {
        this.showControls();
    };

    private handleTouchStart = (): void => {
        if (this.isControlsVisible) {
            const snapshot = this.engine.getSnapshot();
            if (snapshot.state === 'playing') {
                this.hideControls();
            }
        } else {
            this.showControls();
        }
    };
}

/**
 * Create a player UI instance.
 *
 * @param engine - Player engine to control
 * @param config - UI configuration
 * @returns PlayerUI instance
 */
export function createPlayerUI(engine: PlayerEngine, config: PlayerUIConfig): PlayerUI {
    return new PlayerUI(engine, config);
}
