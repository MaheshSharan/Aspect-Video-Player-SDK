import type { UIComponent, PlayerUIConfig } from './types';
import type { PlayerSnapshot } from 'aspect-player-core';
import type { QualityLevel } from 'aspect-player-shared';
import { CSS_CLASSES } from './types';

import type { SubtitleTrack } from './subtitles';

/**
 * Quality selector component.
 */
export class QualitySelector implements UIComponent {
    readonly name = 'quality-selector';

    private element: HTMLDivElement | null = null;
    private button: HTMLButtonElement | null = null;
    private menu: HTMLDivElement | null = null;
    private isOpen = false;
    private levels: readonly QualityLevel[] = [];
    private currentIndex = -1;
    private autoEnabled = true;

    private readonly onSelect: (index: number) => void;

    constructor(private readonly config: PlayerUIConfig, onSelect: (index: number) => void) {
        this.onSelect = onSelect;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}quality-selector`;
        this.element.style.position = 'relative';

        this.button = document.createElement('button');
        this.button.className = `${prefix}${CSS_CLASSES.BUTTON} ${prefix}${CSS_CLASSES.BUTTON_SETTINGS}`;
        this.button.setAttribute('aria-label', 'Quality');
        this.button.innerHTML = this.getIcon();
        this.button.addEventListener('click', this.handleButtonClick);

        this.menu = document.createElement('div');
        this.menu.className = `${prefix}${CSS_CLASSES.MENU}`;
        this.menu.style.display = 'none';

        this.element.appendChild(this.button);
        this.element.appendChild(this.menu);

        document.addEventListener('click', this.handleOutsideClick);

        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        this.levels = snapshot.qualityLevels;
        this.currentIndex = snapshot.currentQuality?.index ?? -1;
        this.autoEnabled = snapshot.abrEnabled;

        this.updateMenu();
    }

    destroy(): void {
        this.button?.removeEventListener('click', this.handleButtonClick);
        document.removeEventListener('click', this.handleOutsideClick);
        this.element = null;
    }

    private updateMenu(): void {
        if (this.menu === null) return;

        const prefix = this.config.classPrefix ?? '';
        this.menu.innerHTML = '';

        // Auto option
        const autoItem = document.createElement('button');
        autoItem.className = `${prefix}${CSS_CLASSES.MENU_ITEM}${this.autoEnabled ? ` ${prefix}${CSS_CLASSES.MENU_ITEM_ACTIVE}` : ''}`;
        autoItem.textContent = 'Auto';
        autoItem.addEventListener('click', () => {
            this.onSelect(-1);
            this.closeMenu();
        });
        this.menu.appendChild(autoItem);

        // Quality levels (sorted high to low)
        const sortedLevels = [...this.levels].sort((a, b) => b.bitrate - a.bitrate);

        for (const level of sortedLevels) {
            const isActive = !this.autoEnabled && level.index === this.currentIndex;
            const item = document.createElement('button');
            item.className = `${prefix}${CSS_CLASSES.MENU_ITEM}${isActive ? ` ${prefix}${CSS_CLASSES.MENU_ITEM_ACTIVE}` : ''}`;
            item.textContent = level.label;
            item.addEventListener('click', () => {
                this.onSelect(level.index);
                this.closeMenu();
            });
            this.menu.appendChild(item);
        }
    }

    private handleButtonClick = (e: MouseEvent): void => {
        e.stopPropagation();
        this.isOpen ? this.closeMenu() : this.openMenu();
    };

    private handleOutsideClick = (e: MouseEvent): void => {
        if (this.element !== null && !this.element.contains(e.target as Node)) {
            this.closeMenu();
        }
    };

    private openMenu(): void {
        if (this.menu !== null) {
            this.menu.style.display = 'block';
            this.isOpen = true;
        }
    }

    private closeMenu(): void {
        if (this.menu !== null) {
            this.menu.style.display = 'none';
            this.isOpen = false;
        }
    }

    private getIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
    }
}

/**
 * Speed selector component.
 */
export class SpeedSelector implements UIComponent {
    readonly name = 'speed-selector';

    private element: HTMLDivElement | null = null;
    private button: HTMLButtonElement | null = null;
    private menu: HTMLDivElement | null = null;
    private isOpen = false;
    private currentRate = 1;

    private readonly speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    private readonly onSelect: (rate: number) => void;

    constructor(private readonly config: PlayerUIConfig, onSelect: (rate: number) => void) {
        this.onSelect = onSelect;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}speed-selector`;
        this.element.style.position = 'relative';

        this.button = document.createElement('button');
        this.button.className = `${prefix}${CSS_CLASSES.BUTTON}`;
        this.button.setAttribute('aria-label', 'Playback speed');
        this.button.textContent = '1x';
        this.button.addEventListener('click', this.handleButtonClick);

        this.menu = document.createElement('div');
        this.menu.className = `${prefix}${CSS_CLASSES.MENU}`;
        this.menu.style.display = 'none';

        this.element.appendChild(this.button);
        this.element.appendChild(this.menu);

        document.addEventListener('click', this.handleOutsideClick);

        this.updateMenu();

        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        if (snapshot.playbackRate !== this.currentRate) {
            this.currentRate = snapshot.playbackRate;
            if (this.button !== null) {
                this.button.textContent = `${this.currentRate}x`;
            }
            this.updateMenu();
        }
    }

    destroy(): void {
        this.button?.removeEventListener('click', this.handleButtonClick);
        document.removeEventListener('click', this.handleOutsideClick);
        this.element = null;
    }

    private updateMenu(): void {
        if (this.menu === null) return;

        const prefix = this.config.classPrefix ?? '';
        this.menu.innerHTML = '';

        for (const speed of this.speeds) {
            const isActive = Math.abs(speed - this.currentRate) < 0.01;
            const item = document.createElement('button');
            item.className = `${prefix}${CSS_CLASSES.MENU_ITEM}${isActive ? ` ${prefix}${CSS_CLASSES.MENU_ITEM_ACTIVE}` : ''}`;
            item.textContent = speed === 1 ? 'Normal' : `${speed}x`;
            item.addEventListener('click', () => {
                this.onSelect(speed);
                this.closeMenu();
            });
            this.menu.appendChild(item);
        }
    }

    private handleButtonClick = (e: MouseEvent): void => {
        e.stopPropagation();
        this.isOpen ? this.closeMenu() : this.openMenu();
    };

    private handleOutsideClick = (e: MouseEvent): void => {
        if (this.element !== null && !this.element.contains(e.target as Node)) {
            this.closeMenu();
        }
    };

    private openMenu(): void {
        if (this.menu !== null) {
            this.menu.style.display = 'block';
            this.isOpen = true;
        }
    }

    private closeMenu(): void {
        if (this.menu !== null) {
            this.menu.style.display = 'none';
            this.isOpen = false;
        }
    }
}

/**
 * Loading spinner component.
 */
export class LoadingSpinner implements UIComponent {
    readonly name = 'loading-spinner';

    private element: HTMLDivElement | null = null;

    constructor(private readonly config: PlayerUIConfig) { }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}${CSS_CLASSES.SPINNER}`;
        this.element.innerHTML = `<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><animate attributeName="stroke-dasharray" dur="1.5s" repeatCount="indefinite" values="1,150;90,150;90,150"/><animate attributeName="stroke-dashoffset" dur="1.5s" repeatCount="indefinite" values="0;-35;-124"/></circle></svg>`;

        // Hidden by default
        this.element.style.display = 'none';

        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        if (this.element !== null) {
            const showSpinner = snapshot.state === 'loading' || snapshot.state === 'buffering';
            this.element.style.display = showSpinner ? 'flex' : 'none';
        }
    }

    destroy(): void {
        this.element = null;
    }
}

/**
 * Error overlay component.
 */
export class ErrorOverlay implements UIComponent {
    readonly name = 'error-overlay';

    private element: HTMLDivElement | null = null;
    private messageEl: HTMLParagraphElement | null = null;
    private retryButton: HTMLButtonElement | null = null;

    private readonly onRetry: () => void;

    constructor(private readonly config: PlayerUIConfig, onRetry: () => void) {
        this.onRetry = onRetry;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}${CSS_CLASSES.ERROR}`;
        this.element.style.display = 'none';

        this.messageEl = document.createElement('p');
        this.messageEl.textContent = 'An error occurred';

        this.retryButton = document.createElement('button');
        this.retryButton.className = `${prefix}${CSS_CLASSES.BUTTON}`;
        this.retryButton.textContent = 'Retry';
        this.retryButton.addEventListener('click', this.handleRetry);

        this.element.appendChild(this.messageEl);
        this.element.appendChild(this.retryButton);

        return this.element;
    }

    update(snapshot: PlayerSnapshot): void {
        if (this.element !== null) {
            const showError = snapshot.state === 'error' && snapshot.error !== undefined;
            this.element.style.display = showError ? 'flex' : 'none';

            if (showError && this.messageEl !== null && snapshot.error !== undefined) {
                this.messageEl.textContent = snapshot.error.message;
            }
        }
    }

    destroy(): void {
        this.retryButton?.removeEventListener('click', this.handleRetry);
        this.element = null;
    }

    private handleRetry = (): void => {
        this.onRetry();
    };
}

/**
 * Subtitle menu component with track selection and sync offset.
 */
export class SubtitleMenu implements UIComponent {
    readonly name = 'subtitle-menu';

    private element: HTMLDivElement | null = null;
    private button: HTMLButtonElement | null = null;
    private menu: HTMLDivElement | null = null;
    private isOpen = false;
    private tracks: SubtitleTrack[] = [];
    private activeTrackId: string | null = null;
    private offset = 0;

    private readonly onSelect: (trackId: string | null) => void;
    private readonly onOffsetChange: (offset: number) => void;

    constructor(
        private readonly config: PlayerUIConfig,
        onSelect: (trackId: string | null) => void,
        onOffsetChange: (offset: number) => void
    ) {
        this.onSelect = onSelect;
        this.onOffsetChange = onOffsetChange;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}subtitle-menu`;
        this.element.style.position = 'relative';

        this.button = document.createElement('button');
        this.button.className = `${prefix}${CSS_CLASSES.BUTTON} ${prefix}${CSS_CLASSES.BUTTON_SETTINGS}`;
        this.button.setAttribute('aria-label', 'Subtitles');
        this.button.innerHTML = this.getIcon();
        this.button.addEventListener('click', this.handleButtonClick);

        this.menu = document.createElement('div');
        this.menu.className = `${prefix}${CSS_CLASSES.MENU} ${prefix}subtitle-settings-menu`;
        this.menu.style.display = 'none';

        this.element.appendChild(this.button);
        this.element.appendChild(this.menu);

        document.addEventListener('click', this.handleOutsideClick);

        return this.element;
    }

    update(_snapshot: PlayerSnapshot): void {
        // We need to update tracks and offset manually or via specific methods
        // since snapshot doesn't contain full subtitle state.
        // But for now, we'll assume the parent updates us via setTracks/setState logic
        // or we can just re-render menu content when opened.
    }

    setTracks(tracks: SubtitleTrack[], activeId: string | null): void {
        this.tracks = tracks;
        this.activeTrackId = activeId;
        if (this.isOpen) {
            this.updateMenu();
        }
    }

    setOffset(offset: number): void {
        this.offset = offset;
        // Don't fully re-render menu to avoid interrupting slider interaction
        this.updateOffsetDisplay();
    }

    destroy(): void {
        this.button?.removeEventListener('click', this.handleButtonClick);
        document.removeEventListener('click', this.handleOutsideClick);
        this.element = null;
    }

    private showSettings = false;

    private updateMenu(): void {
        if (this.menu === null) return;

        const prefix = this.config.classPrefix ?? '';
        this.menu.innerHTML = '';

        if (this.showSettings) {
            this.renderSettingsView(prefix);
        } else {
            this.renderTrackListView(prefix);
        }
    }

    private renderTrackListView(prefix: string): void {
        if (this.menu === null) return;

        // --- Header ---
        const header = document.createElement('div');
        header.className = `${prefix}subtitle-menu-header`;

        const title = document.createElement('span');
        title.className = `${prefix}subtitle-menu-title`;
        title.textContent = 'Subtitles';
        header.appendChild(title);

        // Settings button (only if a track is selected)
        if (this.activeTrackId !== null) {
            const settingsBtn = document.createElement('button');
            settingsBtn.className = `${prefix}subtitle-settings-btn`;
            settingsBtn.innerHTML = this.getSettingsIcon();
            settingsBtn.title = 'Subtitle Settings';
            settingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showSettings = true;
                this.updateMenu();
            });
            header.appendChild(settingsBtn);
        }

        this.menu.appendChild(header);

        // --- Track List ---
        const trackList = document.createElement('div');
        trackList.className = `${prefix}subtitle-track-list`;

        // "Off" option
        const offItem = this.createMenuItem('Off', this.activeTrackId === null, () => {
            this.onSelect(null);
            this.closeMenu();
        });
        trackList.appendChild(offItem);

        // Available tracks
        for (const track of this.tracks) {
            const isActive = track.id === this.activeTrackId;
            const item = this.createMenuItem(track.label, isActive, () => {
                this.onSelect(track.id);
                this.closeMenu();
            });
            trackList.appendChild(item);
        }

        this.menu.appendChild(trackList);
    }

    private renderSettingsView(prefix: string): void {
        if (this.menu === null) return;

        const panel = document.createElement('div');
        panel.className = `${prefix}subtitle-settings-panel`;

        // Back button
        const backBtn = document.createElement('button');
        backBtn.className = `${prefix}subtitle-back-btn`;
        backBtn.innerHTML = '&#8592; Back to Tracks';
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showSettings = false;
            this.updateMenu();
        });
        panel.appendChild(backBtn);

        // Offset Controls
        const controlGroup = document.createElement('div');
        controlGroup.className = `${prefix}offset-control-group`;

        const headerRow = document.createElement('div');
        headerRow.className = `${prefix}offset-label`;
        headerRow.innerHTML = '<span>Sync Offset</span>';
        controlGroup.appendChild(headerRow);

        const sliderContainer = document.createElement('div');
        sliderContainer.className = `${prefix}offset-slider-container`;

        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.className = `${prefix}offset-reset`;
        resetBtn.innerHTML = 'Reset';
        resetBtn.title = 'Reset Offset';
        resetBtn.addEventListener('click', () => {
            this.onOffsetChange(0);
            this.setOffset(0); // Update local state and UI
        });

        // Value display
        const valueDisplay = document.createElement('span');
        valueDisplay.className = `${prefix}offset-value`;
        valueDisplay.textContent = this.formatOffset(this.offset);

        // Slider
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '-5';
        slider.max = '5';
        slider.step = '0.1';
        slider.value = this.offset.toString();
        // Add player-slider class for red theme
        slider.className = `${prefix}offset-slider ${prefix}player-slider`;
        slider.style.flex = '1'; // Ensure it takes available space

        slider.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.onOffsetChange(val);
            this.offset = val; // Update local state
            valueDisplay.textContent = this.formatOffset(val);
        });

        sliderContainer.appendChild(resetBtn);
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);

        controlGroup.appendChild(sliderContainer);
        panel.appendChild(controlGroup);
        this.menu.appendChild(panel);
    }

    private getSettingsIcon(): string {
        return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>`;
    }

    private createMenuItem(label: string, isActive: boolean, onClick: () => void): HTMLButtonElement {
        const prefix = this.config.classPrefix ?? '';
        const item = document.createElement('button');
        item.className = `${prefix}${CSS_CLASSES.MENU_ITEM}${isActive ? ` ${prefix}${CSS_CLASSES.MENU_ITEM_ACTIVE}` : ''}`;

        // Checkmark icon for active state
        const checkIcon = isActive ? '<span class="check-icon">✓</span> ' : '<span class="check-placeholder"></span> ';
        item.innerHTML = `${checkIcon}${label}`;

        item.addEventListener('click', onClick);
        return item;
    }

    private updateOffsetDisplay(): void {
        const prefix = this.config.classPrefix ?? '';
        if (this.menu) {
            const display = this.menu.querySelector(`.${prefix}offset-value`);
            if (display) {
                display.textContent = this.formatOffset(this.offset);
            }
        }
    }

    private formatOffset(offset: number): string {
        const sign = offset > 0 ? '+' : '';
        return `${sign}${offset.toFixed(1)}s`;
    }

    private handleButtonClick = (e: MouseEvent): void => {
        e.stopPropagation();
        this.isOpen ? this.closeMenu() : this.openMenu();
    };

    private handleOutsideClick = (e: MouseEvent): void => {
        if (this.element !== null && !this.element.contains(e.target as Node)) {
            // Don't close if interacting with slider
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            this.closeMenu();
        }
    };

    private openMenu(): void {
        if (this.menu !== null) {
            this.updateMenu();
            this.menu.style.display = 'block';
            this.isOpen = true;
        }
    }

    private closeMenu(): void {
        if (this.menu !== null) {
            this.menu.style.display = 'none';
            this.isOpen = false;
        }
    }

    private getIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5C3.89 4 3 4.9 3 6V18C3 19.1 3.89 20 5 20H19C20.1 20 21 19.1 21 18V6C21 4.9 20.1 4 19 4ZM4 18V6C4 5.45 4.45 5 5 5H19C19.55 5 20 5.45 20 6V18C20 18.55 19.55 19 19 19H5C4.45 19 4 18.55 4 18ZM6 10H8V12H6V10ZM10 10H18V12H10V10ZM6 14H14V16H6V14Z"/></svg>`;
    }
}
