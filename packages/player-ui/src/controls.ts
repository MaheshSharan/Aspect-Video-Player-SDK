import type { UIComponent, PlayerUIConfig } from './types';
import type { PlayerSnapshot } from 'aspect-player-core';
import { CSS_CLASSES } from './types';
import { formatTime } from 'aspect-player-shared';

/**
 * Play/Pause button component.
 */
export class PlayButton implements UIComponent {
    readonly name = 'play-button';

    private element: HTMLButtonElement | null = null;
    private isPlaying = false;
    private readonly onClick: () => void;

    constructor(private readonly config: PlayerUIConfig, onClick: () => void) {
        this.onClick = onClick;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';
        this.element = document.createElement('button');
        this.element.className = `${prefix}${CSS_CLASSES.BUTTON} ${prefix}${CSS_CLASSES.BUTTON_PLAY}`;
        this.element.setAttribute('aria-label', 'Play');
        this.element.setAttribute('type', 'button');
        this.element.innerHTML = this.getPlayIcon();
        this.element.addEventListener('click', this.handleClick);
        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        if (this.element === null) return;

        const prefix = this.config.classPrefix ?? '';
        const playing = snapshot.state === 'playing';

        if (playing !== this.isPlaying) {
            this.isPlaying = playing;
            this.element.className = `${prefix}${CSS_CLASSES.BUTTON} ${prefix}${playing ? CSS_CLASSES.BUTTON_PAUSE : CSS_CLASSES.BUTTON_PLAY}`;
            this.element.innerHTML = playing ? this.getPauseIcon() : this.getPlayIcon();
            this.element.setAttribute('aria-label', playing ? 'Pause' : 'Play');
            this.element.setAttribute('aria-pressed', String(playing));
        }
    }

    destroy(): void {
        this.element?.removeEventListener('click', this.handleClick);
        this.element = null;
    }

    private handleClick = (): void => {
        this.onClick();
    };

    private getPlayIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    }

    private getPauseIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    }
}

/**
 * Seek bar component with preview tooltip.
 */
export class SeekBar implements UIComponent {
    readonly name = 'seek-bar';

    private element: HTMLDivElement | null = null;
    private track: HTMLDivElement | null = null;
    private fill: HTMLDivElement | null = null;
    private buffer: HTMLDivElement | null = null;
    private thumb: HTMLDivElement | null = null;
    private preview: HTMLDivElement | null = null;
    private previewTime: HTMLSpanElement | null = null;
    private previewThumbnail: HTMLDivElement | null = null;

    private duration = 0;
    private currentTime = 0;
    private isDragging = false;

    private readonly onSeek: (position: number) => void;

    constructor(private readonly config: PlayerUIConfig, onSeek: (position: number) => void) {
        this.onSeek = onSeek;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}${CSS_CLASSES.SLIDER} ${prefix}${CSS_CLASSES.SLIDER_SEEK}`;
        this.element.setAttribute('role', 'slider');
        this.element.setAttribute('aria-label', 'Seek');
        this.element.setAttribute('aria-valuemin', '0');
        this.element.setAttribute('aria-valuemax', '100');
        this.element.setAttribute('aria-valuenow', '0');
        this.element.setAttribute('aria-valuetext', '0:00 of 0:00');
        this.element.tabIndex = 0;

        this.track = document.createElement('div');
        this.track.className = `${prefix}${CSS_CLASSES.SLIDER_TRACK}`;

        this.buffer = document.createElement('div');
        this.buffer.className = `${prefix}${CSS_CLASSES.SLIDER_BUFFER}`;

        this.fill = document.createElement('div');
        this.fill.className = `${prefix}${CSS_CLASSES.SLIDER_FILL}`;

        this.thumb = document.createElement('div');
        this.thumb.className = `${prefix}${CSS_CLASSES.SLIDER_THUMB}`;

        // Preview tooltip
        this.preview = document.createElement('div');
        this.preview.className = `${prefix}player-preview`;
        this.preview.style.display = 'none';

        this.previewThumbnail = document.createElement('div');
        this.previewThumbnail.className = `${prefix}player-preview__thumbnail`;

        this.previewTime = document.createElement('span');
        this.previewTime.className = `${prefix}player-preview__time`;

        this.preview.appendChild(this.previewThumbnail);
        this.preview.appendChild(this.previewTime);

        this.track.appendChild(this.buffer);
        this.track.appendChild(this.fill);
        this.track.appendChild(this.thumb);
        this.element.appendChild(this.track);
        this.element.appendChild(this.preview);

        this.element.addEventListener('mousedown', this.handleMouseDown);
        this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.element.addEventListener('keydown', this.handleKeyDown);
        this.element.addEventListener('mousemove', this.handlePreviewMove);
        this.element.addEventListener('mouseleave', this.handlePreviewHide);

        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        if (this.isDragging) return;

        this.duration = snapshot.duration;
        this.currentTime = snapshot.currentTime;

        const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        const bufferProgress = snapshot.buffered.forwardBuffer > 0
            ? ((this.currentTime + snapshot.buffered.forwardBuffer) / this.duration) * 100
            : 0;

        if (this.fill !== null) {
            this.fill.style.width = `${progress}%`;
        }

        if (this.buffer !== null) {
            this.buffer.style.width = `${Math.min(bufferProgress, 100)}%`;
        }

        if (this.thumb !== null) {
            this.thumb.style.left = `${progress}%`;
        }

        this.element?.setAttribute('aria-valuenow', String(Math.round(progress)));
        this.element?.setAttribute('aria-valuetext', `${this.formatTime(this.currentTime)} of ${this.formatTime(this.duration)}`);
    }

    destroy(): void {
        this.element?.removeEventListener('mousedown', this.handleMouseDown);
        this.element?.removeEventListener('touchstart', this.handleTouchStart);
        this.element?.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        this.element = null;
    }

    private handleMouseDown = (e: MouseEvent): void => {
        e.preventDefault();
        this.isDragging = true;
        this.updatePosition(e.clientX);

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
    };

    private handleMouseMove = (e: MouseEvent): void => {
        if (!this.isDragging) return;
        this.updatePosition(e.clientX);
    };

    private handleMouseUp = (e: MouseEvent): void => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.updatePosition(e.clientX);
        this.emitSeek();

        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    };

    private handleTouchStart = (e: TouchEvent): void => {
        e.preventDefault();
        this.isDragging = true;

        const touch = e.touches[0];
        if (touch !== undefined) {
            this.updatePosition(touch.clientX);
        }

        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd);
    };

    private handleTouchMove = (e: TouchEvent): void => {
        if (!this.isDragging) return;
        e.preventDefault();

        const touch = e.touches[0];
        if (touch !== undefined) {
            this.updatePosition(touch.clientX);
        }
    };

    private handleTouchEnd = (): void => {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.emitSeek();

        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
    };

    private handleKeyDown = (e: KeyboardEvent): void => {
        const step = this.duration * 0.01; // 1% step

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.currentTime = Math.max(0, this.currentTime - step);
                this.emitSeek();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.currentTime = Math.min(this.duration, this.currentTime + step);
                this.emitSeek();
                break;
        }
    };

    private handlePreviewMove = (e: MouseEvent): void => {
        if (this.element === null || this.preview === null || this.previewTime === null) return;
        if (this.duration === 0) return;

        const rect = this.element.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * this.duration;

        // Update time display
        this.previewTime.textContent = this.formatTime(time);

        // Position preview tooltip
        const previewWidth = this.preview.offsetWidth || 80;
        const leftPos = Math.max(0, Math.min(rect.width - previewWidth, (e.clientX - rect.left) - previewWidth / 2));
        this.preview.style.left = `${leftPos}px`;
        this.preview.style.display = 'flex';
    };

    private handlePreviewHide = (): void => {
        if (this.preview !== null) {
            this.preview.style.display = 'none';
        }
    };

    private updatePosition(clientX: number): void {
        if (this.element === null) return;

        const rect = this.element.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        this.currentTime = percent * this.duration;

        if (this.fill !== null) {
            this.fill.style.width = `${percent * 100}%`;
        }

        if (this.thumb !== null) {
            this.thumb.style.left = `${percent * 100}%`;
        }
    }

    private emitSeek(): void {
        this.onSeek(this.currentTime);
    }

    private formatTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
}

/**
 * Time display component.
 */
export class TimeDisplay implements UIComponent {
    readonly name = 'time-display';

    private element: HTMLDivElement | null = null;
    private currentTimeEl: HTMLSpanElement | null = null;
    private durationEl: HTMLSpanElement | null = null;

    constructor(private readonly config: PlayerUIConfig) { }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}${CSS_CLASSES.TIME}`;
        this.element.setAttribute('role', 'timer');
        this.element.setAttribute('aria-live', 'off');
        this.element.setAttribute('aria-atomic', 'true');

        this.currentTimeEl = document.createElement('span');
        this.currentTimeEl.className = `${prefix}${CSS_CLASSES.TIME_CURRENT}`;
        this.currentTimeEl.textContent = '0:00';

        const separator = document.createElement('span');
        separator.className = `${prefix}${CSS_CLASSES.TIME_SEPARATOR}`;
        separator.textContent = ' / ';

        this.durationEl = document.createElement('span');
        this.durationEl.className = `${prefix}${CSS_CLASSES.TIME_DURATION}`;
        this.durationEl.textContent = '0:00';

        this.element.appendChild(this.currentTimeEl);
        this.element.appendChild(separator);
        this.element.appendChild(this.durationEl);

        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        if (this.currentTimeEl !== null) {
            this.currentTimeEl.textContent = formatTime(snapshot.currentTime);
        }

        if (this.durationEl !== null) {
            if (snapshot.isLive) {
                // For live streams, show time behind live edge if available
                if (snapshot.liveLatency !== undefined && snapshot.liveLatency > 5) {
                    this.durationEl.textContent = `-${formatTime(snapshot.liveLatency)}`;
                } else {
                    this.durationEl.textContent = 'LIVE';
                }
            } else if (!Number.isFinite(snapshot.duration) || snapshot.duration === 0) {
                // Duration not loaded yet
                this.durationEl.textContent = '--:--';
            } else {
                this.durationEl.textContent = formatTime(snapshot.duration);
            }
        }
    }

    destroy(): void {
        this.element = null;
    }
}

/**
 * Live indicator component.
 * Shows a red "LIVE" badge that can be clicked to seek to live edge.
 */
export class LiveIndicator implements UIComponent {
    readonly name = 'live-indicator';

    private element: HTMLButtonElement | null = null;
    private isLive = false;
    private isAtLiveEdge = true;
    private readonly onSeekToLive: () => void;

    constructor(private readonly config: PlayerUIConfig, onSeekToLive: () => void) {
        this.onSeekToLive = onSeekToLive;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';
        this.element = document.createElement('button');
        this.element.className = `${prefix}${CSS_CLASSES.LIVE_INDICATOR}`;
        this.element.setAttribute('aria-label', 'Go to live');
        this.element.setAttribute('type', 'button');
        this.element.style.display = 'none'; // Hidden by default

        const dot = document.createElement('span');
        dot.className = `${prefix}${CSS_CLASSES.LIVE_DOT}`;

        const text = document.createElement('span');
        text.className = `${prefix}${CSS_CLASSES.LIVE_TEXT}`;
        text.textContent = 'LIVE';

        this.element.appendChild(dot);
        this.element.appendChild(text);
        this.element.addEventListener('click', this.handleClick);

        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        if (this.element === null) return;

        const prefix = this.config.classPrefix ?? '';
        const wasLive = this.isLive;
        this.isLive = snapshot.isLive;

        // Show/hide based on live state
        this.element.style.display = this.isLive ? 'flex' : 'none';

        if (!this.isLive) return;

        // Determine if we're at live edge (within 10 seconds)
        const latency = snapshot.liveLatency ?? 0;
        const atLiveEdge = latency < 10;

        if (atLiveEdge !== this.isAtLiveEdge || wasLive !== this.isLive) {
            this.isAtLiveEdge = atLiveEdge;

            // Update visual state
            this.element.classList.toggle(`${prefix}${CSS_CLASSES.LIVE_BEHIND}`, !atLiveEdge);
            this.element.setAttribute('aria-label', atLiveEdge ? 'Watching live' : 'Go to live');
            this.element.setAttribute('aria-pressed', String(atLiveEdge));

            // Disable button if already at live edge
            this.element.disabled = atLiveEdge;
        }
    }

    private handleClick = (): void => {
        if (!this.isAtLiveEdge) {
            this.onSeekToLive();
        }
    };

    destroy(): void {
        this.element?.removeEventListener('click', this.handleClick);
        this.element = null;
    }
}

/**
 * Volume control component.
 */
export class VolumeControl implements UIComponent {
    readonly name = 'volume-control';

    private element: HTMLDivElement | null = null;
    private muteButton: HTMLButtonElement | null = null;
    private slider: HTMLInputElement | null = null;
    private isMuted = false;
    private volume = 1;

    private readonly onVolumeChange: (volume: number) => void;
    private readonly onMuteToggle: (muted: boolean) => void;

    constructor(
        private readonly config: PlayerUIConfig,
        onVolumeChange: (volume: number) => void,
        onMuteToggle: (muted: boolean) => void
    ) {
        this.onVolumeChange = onVolumeChange;
        this.onMuteToggle = onMuteToggle;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}${CSS_CLASSES.VOLUME_GROUP}`;

        this.muteButton = document.createElement('button');
        this.muteButton.className = `${prefix}${CSS_CLASSES.BUTTON}`;
        this.muteButton.setAttribute('aria-label', 'Mute');
        this.muteButton.setAttribute('type', 'button');
        this.muteButton.innerHTML = this.getVolumeIcon(1);
        this.muteButton.addEventListener('click', this.handleMuteClick);

        this.slider = document.createElement('input');
        this.slider.type = 'range';
        this.slider.min = '0';
        this.slider.max = '1';
        this.slider.step = '0.01';
        this.slider.value = '1';
        this.slider.className = `${prefix}${CSS_CLASSES.SLIDER} ${prefix}${CSS_CLASSES.SLIDER_VOLUME}`;
        this.slider.setAttribute('aria-label', 'Volume');
        this.slider.setAttribute('aria-valuetext', '100%');
        this.slider.addEventListener('input', this.handleSliderInput);

        this.element.appendChild(this.muteButton);
        this.element.appendChild(this.slider);

        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        this.volume = snapshot.volume;
        this.isMuted = snapshot.muted;

        if (this.slider !== null) {
            this.slider.value = String(this.volume);
            this.slider.setAttribute('aria-valuetext', `${Math.round(this.volume * 100)}%`);
        }

        if (this.muteButton !== null) {
            this.muteButton.innerHTML = this.getVolumeIcon(this.isMuted ? 0 : this.volume);
            this.muteButton.setAttribute('aria-label', this.isMuted ? 'Unmute' : 'Mute');
            this.muteButton.setAttribute('aria-pressed', String(this.isMuted));
        }
    }

    destroy(): void {
        this.muteButton?.removeEventListener('click', this.handleMuteClick);
        this.slider?.removeEventListener('input', this.handleSliderInput);
        this.element = null;
    }

    private handleMuteClick = (): void => {
        this.onMuteToggle(!this.isMuted);
    };

    private handleSliderInput = (): void => {
        if (this.slider !== null) {
            this.onVolumeChange(parseFloat(this.slider.value));
        }
    };

    private getVolumeIcon(volume: number): string {
        if (volume === 0) {
            return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
        }
        if (volume < 0.5) {
            return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>`;
        }
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    }
}

/**
 * Fullscreen button component.
 */
export class FullscreenButton implements UIComponent {
    readonly name = 'fullscreen-button';

    private element: HTMLButtonElement | null = null;
    private isFullscreen = false;
    private readonly onClick: () => void;

    constructor(private readonly config: PlayerUIConfig, onClick: () => void) {
        this.onClick = onClick;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('button');
        this.element.className = `${prefix}${CSS_CLASSES.BUTTON} ${prefix}${CSS_CLASSES.BUTTON_FULLSCREEN}`;
        this.element.setAttribute('aria-label', 'Fullscreen');
        this.element.setAttribute('type', 'button');
        this.element.innerHTML = this.getEnterIcon();
        this.element.addEventListener('click', this.handleClick);

        return this.element;
    }

    update(_snapshot: PlayerSnapshot): void {
        const isFullscreen = document.fullscreenElement !== null;

        if (isFullscreen !== this.isFullscreen) {
            this.isFullscreen = isFullscreen;
            if (this.element !== null) {
                this.element.innerHTML = isFullscreen ? this.getExitIcon() : this.getEnterIcon();
                this.element.setAttribute('aria-label', isFullscreen ? 'Exit fullscreen' : 'Fullscreen');
                this.element.setAttribute('aria-pressed', String(isFullscreen));
            }
        }
    }

    destroy(): void {
        this.element?.removeEventListener('click', this.handleClick);
        this.element = null;
    }

    private handleClick = (): void => {
        this.onClick();
    };

    private getEnterIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
    }

    private getExitIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
    }
}

/**
 * PiP button component.
 */
export class PiPButton implements UIComponent {
    readonly name = 'pip-button';

    private element: HTMLButtonElement | null = null;
    private isActive = false;
    private readonly onClick: () => void;

    constructor(private readonly config: PlayerUIConfig, onClick: () => void) {
        this.onClick = onClick;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('button');
        this.element.className = `${prefix}${CSS_CLASSES.BUTTON} ${prefix}${CSS_CLASSES.BUTTON_PIP}`;
        this.element.setAttribute('aria-label', 'Picture in Picture');
        this.element.setAttribute('type', 'button');
        this.element.innerHTML = this.getIcon();
        this.element.addEventListener('click', this.handleClick);

        return this.element;
    }

    update(_snapshot: PlayerSnapshot): void {
        const isActive = document.pictureInPictureElement !== null;

        if (isActive !== this.isActive) {
            this.isActive = isActive;
            if (this.element !== null) {
                this.element.setAttribute('aria-label', isActive ? 'Exit Picture in Picture' : 'Picture in Picture');
                this.element.setAttribute('aria-pressed', String(isActive));
            }
        }
    }

    destroy(): void {
        this.element?.removeEventListener('click', this.handleClick);
        this.element = null;
    }

    private handleClick = (): void => {
        this.onClick();
    };

    private getIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/></svg>`;
    }
}

/**
 * Skip Back button component (10 seconds).
 */
export class SkipBackButton implements UIComponent {
    readonly name = 'skip-back-button';

    private element: HTMLButtonElement | null = null;
    private readonly onClick: () => void;
    private readonly skipSeconds: number;

    constructor(
        private readonly config: PlayerUIConfig,
        onClick: () => void,
        skipSeconds: number = 10
    ) {
        this.onClick = onClick;
        this.skipSeconds = skipSeconds;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('button');
        this.element.className = `${prefix}${CSS_CLASSES.BUTTON} ${prefix}${CSS_CLASSES.BUTTON_SKIP_BACK}`;
        this.element.setAttribute('aria-label', `Skip back ${this.skipSeconds} seconds`);
        this.element.setAttribute('type', 'button');
        this.element.innerHTML = this.getIcon();
        this.element.addEventListener('click', this.handleClick);

        return this.element;
    }

    update(_snapshot: PlayerSnapshot): void {
        // No state-dependent updates needed
    }

    destroy(): void {
        this.element?.removeEventListener('click', this.handleClick);
        this.element = null;
    }

    private handleClick = (): void => {
        this.onClick();
    };

    private getIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
            <text x="12" y="14.5" text-anchor="middle" font-size="7" font-weight="bold" font-family="sans-serif" fill="currentColor">${this.skipSeconds}</text>
        </svg>`;
    }
}

/**
 * Skip Forward button component (10 seconds).
 */
export class SkipForwardButton implements UIComponent {
    readonly name = 'skip-forward-button';

    private element: HTMLButtonElement | null = null;
    private readonly onClick: () => void;
    private readonly skipSeconds: number;

    constructor(
        private readonly config: PlayerUIConfig,
        onClick: () => void,
        skipSeconds: number = 10
    ) {
        this.onClick = onClick;
        this.skipSeconds = skipSeconds;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('button');
        this.element.className = `${prefix}${CSS_CLASSES.BUTTON} ${prefix}${CSS_CLASSES.BUTTON_SKIP_FORWARD}`;
        this.element.setAttribute('aria-label', `Skip forward ${this.skipSeconds} seconds`);
        this.element.setAttribute('type', 'button');
        this.element.innerHTML = this.getIcon();
        this.element.addEventListener('click', this.handleClick);

        return this.element;
    }

    update(_snapshot: PlayerSnapshot): void {
        // No state-dependent updates needed
    }

    destroy(): void {
        this.element?.removeEventListener('click', this.handleClick);
        this.element = null;
    }

    private handleClick = (): void => {
        this.onClick();
    };

    private getIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
            <text x="12" y="14.5" text-anchor="middle" font-size="7" font-weight="bold" font-family="sans-serif" fill="currentColor">${this.skipSeconds}</text>
        </svg>`;
    }
}

/**
 * Title display component (shows video title and episode info).
 */
export class TitleDisplay implements UIComponent {
    readonly name = 'title-display';

    private element: HTMLDivElement | null = null;
    private titleEl: HTMLSpanElement | null = null;
    private episodeEl: HTMLSpanElement | null = null;
    private title: string;
    private episodeInfo: string;

    constructor(
        private readonly config: PlayerUIConfig,
        title: string = '',
        episodeInfo: string = ''
    ) {
        this.title = title;
        this.episodeInfo = episodeInfo;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}${CSS_CLASSES.TITLE}`;

        this.titleEl = document.createElement('span');
        this.titleEl.className = `${prefix}player-title__text`;
        this.titleEl.textContent = this.title;

        this.episodeEl = document.createElement('span');
        this.episodeEl.className = `${prefix}${CSS_CLASSES.TITLE_EPISODE}`;
        this.episodeEl.textContent = this.episodeInfo;

        this.element.appendChild(this.titleEl);
        if (this.episodeInfo) {
            this.element.appendChild(this.episodeEl);
        }

        return this.element;
    }

    update(_snapshot: PlayerSnapshot): void {
        // Title doesn't change during playback
    }

    /**
     * Update the displayed title.
     */
    setTitle(title: string, episodeInfo?: string): void {
        this.title = title;
        if (episodeInfo !== undefined) {
            this.episodeInfo = episodeInfo;
        }

        if (this.titleEl !== null) {
            this.titleEl.textContent = this.title;
        }

        if (this.episodeEl !== null) {
            this.episodeEl.textContent = this.episodeInfo;
            this.episodeEl.style.display = this.episodeInfo ? '' : 'none';
        }
    }

    destroy(): void {
        this.element = null;
        this.titleEl = null;
        this.episodeEl = null;
    }
}

/**
 * Big center play button overlay (shown when paused).
 */
export class BigPlayButton implements UIComponent {
    readonly name = 'big-play-button';

    private element: HTMLButtonElement | null = null;
    private readonly onClick: () => void;

    constructor(private readonly config: PlayerUIConfig, onClick: () => void) {
        this.onClick = onClick;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';
        this.element = document.createElement('button');
        this.element.className = `${prefix}player-big-play`;
        this.element.setAttribute('aria-label', 'Play');
        this.element.setAttribute('type', 'button');

        const circle = document.createElement('span');
        circle.className = `${prefix}player-big-play__circle`;
        circle.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        this.element.appendChild(circle);

        this.element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onClick();
        });

        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        if (!this.element) return;
        const prefix = this.config.classPrefix ?? '';
        const hide = snapshot.state === 'playing' || snapshot.state === 'buffering';
        this.element.classList.toggle(`${prefix}player-big-play--hidden`, hide);
    }

    destroy(): void {
        this.element = null;
    }
}

/**
 * Double-tap seek handler for mobile.
 * Listens for rapid taps on left/right side of video container.
 */
export class DoubleTapSeek implements UIComponent {
    readonly name = 'double-tap-seek';

    private container: HTMLDivElement | null = null;
    private leftRipple: HTMLDivElement | null = null;
    private rightRipple: HTMLDivElement | null = null;
    private lastTap = 0;
    private lastSide: 'left' | 'right' | null = null;
    private hideTimer: number | null = null;

    private readonly onSeek: (delta: number) => void;
    private readonly seekSeconds: number;

    constructor(
        private readonly config: PlayerUIConfig,
        onSeek: (delta: number) => void,
        seekSeconds = 10
    ) {
        this.onSeek = onSeek;
        this.seekSeconds = seekSeconds;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.container = document.createElement('div');
        this.container.style.cssText = 'position:absolute;inset:0;z-index:6;pointer-events:none;';

        // Left ripple
        this.leftRipple = document.createElement('div');
        this.leftRipple.className = `${prefix}player-seek-ripple ${prefix}player-seek-ripple--left`;
        this.leftRipple.innerHTML = `<span class="${prefix}player-seek-ripple__text">−${this.seekSeconds}s</span>`;

        // Right ripple
        this.rightRipple = document.createElement('div');
        this.rightRipple.className = `${prefix}player-seek-ripple ${prefix}player-seek-ripple--right`;
        this.rightRipple.innerHTML = `<span class="${prefix}player-seek-ripple__text">+${this.seekSeconds}s</span>`;

        this.container.appendChild(this.leftRipple);
        this.container.appendChild(this.rightRipple);

        return this.container;
    }

    /**
     * Call this from the parent's touch handler.
     * Returns true if the tap was consumed as a double-tap seek.
     */
    handleTap(clientX: number, containerRect: DOMRect): boolean {
        const now = Date.now();
        const halfW = containerRect.width / 2;
        const relX = clientX - containerRect.left;
        const side: 'left' | 'right' = relX < halfW ? 'left' : 'right';

        if (now - this.lastTap < 350 && this.lastSide === side) {
            const delta = side === 'left' ? -this.seekSeconds : this.seekSeconds;
            this.onSeek(delta);
            this.showRipple(side);
            this.lastTap = 0;
            this.lastSide = null;
            return true;
        }

        this.lastTap = now;
        this.lastSide = side;
        return false;
    }

    update(_snapshot: PlayerSnapshot): void { /* visual only */ }

    destroy(): void {
        if (this.hideTimer !== null) clearTimeout(this.hideTimer);
        this.container = null;
        this.leftRipple = null;
        this.rightRipple = null;
    }

    private showRipple(side: 'left' | 'right'): void {
        const prefix = this.config.classPrefix ?? '';
        const el = side === 'left' ? this.leftRipple : this.rightRipple;
        if (!el) return;

        el.classList.add(`${prefix}player-seek-ripple--active`);

        if (this.hideTimer !== null) clearTimeout(this.hideTimer);
        this.hideTimer = window.setTimeout(() => {
            this.leftRipple?.classList.remove(`${prefix}player-seek-ripple--active`);
            this.rightRipple?.classList.remove(`${prefix}player-seek-ripple--active`);
        }, 600);
    }
}