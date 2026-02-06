import type { UIComponent, PlayerUIConfig } from './types';
import type { PlayerSnapshot } from 'aspect-player-core';
import type { QualityLevel } from 'aspect-player-shared';
import { CSS_CLASSES } from './types';

import type { SubtitleTrack } from './subtitles';

/**
 * Subtitle appearance settings interface.
 */
export interface SubtitleAppearance {
    /** Font size as percentage (50-200), default 100 */
    fontSize: number;
    /** Text color as hex string, default '#ffffff' */
    textColor: string;
    /** Background opacity (0-100), default 50 */
    backgroundOpacity: number;
    /** Bold text enabled */
    bold: boolean;
    /** Vertical position: 'default' (bottom) or 'high' */
    verticalPosition: 'default' | 'high';
}

/** Default appearance settings */
export const DEFAULT_APPEARANCE: SubtitleAppearance = {
    fontSize: 100,
    textColor: '#ffffff',
    backgroundOpacity: 50,
    bold: false,
    verticalPosition: 'default',
};

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
        this.button.setAttribute('aria-label', 'Quality settings');
        this.button.setAttribute('aria-haspopup', 'menu');
        this.button.setAttribute('aria-expanded', 'false');
        this.button.setAttribute('type', 'button');
        this.button.innerHTML = this.getIcon();
        this.button.addEventListener('click', this.handleButtonClick);

        this.menu = document.createElement('div');
        this.menu.className = `${prefix}${CSS_CLASSES.MENU}`;
        this.menu.setAttribute('role', 'menu');
        this.menu.setAttribute('aria-label', 'Quality levels');
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
        autoItem.setAttribute('role', 'menuitem');
        autoItem.setAttribute('aria-checked', String(this.autoEnabled));
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
            item.setAttribute('role', 'menuitem');
            item.setAttribute('aria-checked', String(isActive));
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
            this.button?.setAttribute('aria-expanded', 'true');
        }
    }

    private closeMenu(): void {
        if (this.menu !== null) {
            this.menu.style.display = 'none';
            this.isOpen = false;
            this.button?.setAttribute('aria-expanded', 'false');
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
        this.button.setAttribute('aria-haspopup', 'menu');
        this.button.setAttribute('aria-expanded', 'false');
        this.button.setAttribute('type', 'button');
        this.button.textContent = '1x';
        this.button.addEventListener('click', this.handleButtonClick);

        this.menu = document.createElement('div');
        this.menu.className = `${prefix}${CSS_CLASSES.MENU}`;
        this.menu.setAttribute('role', 'menu');
        this.menu.setAttribute('aria-label', 'Playback speeds');
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
            item.setAttribute('role', 'menuitem');
            item.setAttribute('aria-checked', String(isActive));
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
            this.button?.setAttribute('aria-expanded', 'true');
        }
    }

    private closeMenu(): void {
        if (this.menu !== null) {
            this.menu.style.display = 'none';
            this.isOpen = false;
            this.button?.setAttribute('aria-expanded', 'false');
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
        this.element.setAttribute('role', 'status');
        this.element.setAttribute('aria-label', 'Loading');
        this.element.innerHTML = `<svg viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><animate attributeName="stroke-dasharray" dur="1.5s" repeatCount="indefinite" values="1,150;90,150;90,150"/><animate attributeName="stroke-dashoffset" dur="1.5s" repeatCount="indefinite" values="0;-35;-124"/></circle></svg>`;

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
        this.element.setAttribute('role', 'alert');
        this.element.setAttribute('aria-live', 'assertive');
        this.element.style.display = 'none';

        this.messageEl = document.createElement('p');
        this.messageEl.textContent = 'An error occurred';

        this.retryButton = document.createElement('button');
        this.retryButton.className = `${prefix}${CSS_CLASSES.BUTTON}`;
        this.retryButton.setAttribute('type', 'button');
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
 * Modern subtitle menu with track list, customize panel, and appearance settings.
 * 
 * Views:
 * 1. Track List — Header with back arrow, "Subtitles", "Customize" link. 
 *    Toggle for enable/disable, Off option, Auto select, then language list.
 * 2. Customize — Subtitle delay, background opacity, text size, bold, color, position, reset.
 */
export class SubtitleMenu implements UIComponent {
    readonly name = 'subtitle-menu';

    private element: HTMLDivElement | null = null;
    private button: HTMLButtonElement | null = null;
    private panel: HTMLDivElement | null = null;
    private trackListEl: HTMLDivElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private isOpen = false;
    private tracks: SubtitleTrack[] = [];
    private activeTrackId: string | null = null;
    private offset = 0;
    private savedScrollPosition = 0;
    private currentView: 'tracks' | 'customize' = 'tracks';
    private searchQuery = '';
    private appearance: SubtitleAppearance = { ...DEFAULT_APPEARANCE };
    private portalContainer: HTMLElement | null = null;

    private readonly onSelect: (trackId: string | null) => void;
    private readonly onOffsetChange: (offset: number) => void;
    private onAppearanceChange: ((appearance: SubtitleAppearance) => void) | null = null;

    constructor(
        private readonly config: PlayerUIConfig,
        onSelect: (trackId: string | null) => void,
        onOffsetChange: (offset: number) => void,
        onAppearanceChange?: (appearance: SubtitleAppearance) => void
    ) {
        this.onSelect = onSelect;
        this.onOffsetChange = onOffsetChange;
        this.onAppearanceChange = onAppearanceChange ?? null;
    }

    render(): HTMLElement {
        const prefix = this.config.classPrefix ?? '';

        this.element = document.createElement('div');
        this.element.className = `${prefix}subtitle-menu`;
        this.element.style.position = 'relative';

        this.button = document.createElement('button');
        this.button.className = `${prefix}${CSS_CLASSES.BUTTON} ${prefix}${CSS_CLASSES.BUTTON_SETTINGS}`;
        this.button.setAttribute('aria-label', 'Subtitles');
        this.button.setAttribute('aria-haspopup', 'dialog');
        this.button.setAttribute('aria-expanded', 'false');
        this.button.setAttribute('type', 'button');
        this.button.innerHTML = this.getSubtitleIcon();
        this.button.addEventListener('click', this.handleButtonClick);

        this.panel = document.createElement('div');
        this.panel.className = `${prefix}player-sub-panel`;
        this.panel.setAttribute('role', 'dialog');
        this.panel.setAttribute('aria-label', 'Subtitle options');
        this.panel.style.display = 'none';

        // Prevent clicks inside panel from bubbling to video (which triggers play/pause)
        this.panel.addEventListener('click', (e) => e.stopPropagation());
        this.panel.addEventListener('mousedown', (e) => e.stopPropagation());

        this.element.appendChild(this.button);
        // Panel is appended to portal container if set, otherwise to element
        // This will be handled in openPanel()

        document.addEventListener('click', this.handleOutsideClick);

        return this.element;
    }

    update(_snapshot: PlayerSnapshot): void { /* updated via setTracks/setOffset */ }

    setTracks(tracks: SubtitleTrack[], activeId: string | null): void {
        this.tracks = tracks;
        this.activeTrackId = activeId;
        if (this.isOpen && this.currentView === 'tracks') {
            this.saveScrollPosition();
            this.renderCurrentView();
            this.restoreScrollPosition();
        }
    }

    setOffset(offset: number): void {
        this.offset = offset;
        // Live-update offset display without full re-render
        const prefix = this.config.classPrefix ?? '';
        const display = this.panel?.querySelector(`.${prefix}player-sub-delay-value`);
        if (display) display.textContent = this.formatOffset(this.offset);
        const slider = this.panel?.querySelector(`.${prefix}player-sub-delay-slider`) as HTMLInputElement;
        if (slider) slider.value = this.offset.toString();
    }

    getAppearance(): SubtitleAppearance { return { ...this.appearance }; }

    /**
     * Set the container for portal rendering (e.g., fullscreen container).
     * When set, the panel will be rendered inside this container instead of
     * as a child of the button element.
     */
    setPortalContainer(container: HTMLElement | null): void {
        this.portalContainer = container;
    }

    destroy(): void {
        this.button?.removeEventListener('click', this.handleButtonClick);
        document.removeEventListener('click', this.handleOutsideClick);
        // Remove panel from portal if it was portaled
        if (this.panel && this.panel.parentElement && this.panel.parentElement !== this.element) {
            this.panel.remove();
        }
        this.element = null;
        this.panel = null;
        this.trackListEl = null;
        this.searchInput = null;
        this.portalContainer = null;
    }

    // ── Internals ──────────────────────────────────────────

    private saveScrollPosition(): void {
        if (this.trackListEl) this.savedScrollPosition = this.trackListEl.scrollTop;
    }

    private restoreScrollPosition(): void {
        if (this.trackListEl) {
            requestAnimationFrame(() => {
                if (this.trackListEl) this.trackListEl.scrollTop = this.savedScrollPosition;
            });
        }
    }

    private renderCurrentView(): void {
        if (!this.panel) return;
        this.panel.innerHTML = '';
        if (this.currentView === 'customize') {
            this.renderCustomizeView();
        } else {
            this.renderTrackListView();
        }
    }

    // ── Track List View ────────────────────────────────────

    private renderTrackListView(): void {
        if (!this.panel) return;
        const p = this.config.classPrefix ?? '';

        // Header
        const header = document.createElement('div');
        header.className = `${p}player-sub-header`;

        const headerLeft = document.createElement('div');
        headerLeft.className = `${p}player-sub-header-left`;

        const backBtn = document.createElement('button');
        backBtn.className = `${p}player-sub-header-btn`;
        backBtn.type = 'button';
        backBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
        backBtn.addEventListener('click', (e) => { e.stopPropagation(); this.closePanel(); });
        headerLeft.appendChild(backBtn);

        const titleSpan = document.createElement('span');
        titleSpan.className = `${p}player-sub-header-title`;
        titleSpan.textContent = 'Subtitles';
        headerLeft.appendChild(titleSpan);

        const customizeBtn = document.createElement('button');
        customizeBtn.className = `${p}player-sub-customize-btn`;
        customizeBtn.type = 'button';
        customizeBtn.textContent = 'Customize';
        customizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.currentView = 'customize';
            this.renderCurrentView();
        });

        header.appendChild(headerLeft);
        header.appendChild(customizeBtn);
        this.panel.appendChild(header);

        // Content wrapper
        const content = document.createElement('div');
        content.className = `${p}player-sub-content`;

        // ── Enable Subtitles toggle row ──
        const toggleRow = document.createElement('div');
        toggleRow.className = `${p}player-sub-toggle-row`;

        const toggleLabel = document.createElement('span');
        toggleLabel.className = `${p}player-sub-toggle-label`;
        toggleLabel.textContent = 'Enable Subtitles';

        const toggle = this.createToggle(this.activeTrackId !== null, (checked) => {
            if (checked) {
                const first = this.tracks[0];
                if (first) this.onSelect(first.id);
            } else {
                this.onSelect(null);
            }
        });

        toggleRow.appendChild(toggleLabel);
        toggleRow.appendChild(toggle);
        content.appendChild(toggleRow);

        // Divider
        content.appendChild(this.createDivider());

        // ── Search bar (only if >8 tracks) ──
        if (this.tracks.length > 8) {
            const searchWrap = document.createElement('div');
            searchWrap.className = `${p}player-sub-search`;

            const searchIcon = document.createElement('span');
            searchIcon.className = `${p}player-sub-search-icon`;
            searchIcon.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

            this.searchInput = document.createElement('input');
            this.searchInput.className = `${p}player-sub-search-input`;
            this.searchInput.type = 'text';
            this.searchInput.placeholder = 'Search languages...';
            this.searchInput.value = this.searchQuery;
            this.searchInput.addEventListener('input', (e) => {
                e.stopPropagation();
                this.searchQuery = (e.target as HTMLInputElement).value;
                this.rebuildTrackList();
            });

            searchWrap.appendChild(searchIcon);
            searchWrap.appendChild(this.searchInput);
            content.appendChild(searchWrap);
        }

        // ── Track list ──
        const trackList = document.createElement('div');
        trackList.className = `${p}player-sub-track-list`;
        trackList.addEventListener('scroll', (e) => e.stopPropagation(), { passive: true });
        this.trackListEl = trackList;

        this.populateTrackList(trackList);
        content.appendChild(trackList);

        this.panel.appendChild(content);
    }

    private populateTrackList(container: HTMLDivElement): void {
        const p = this.config.classPrefix ?? '';
        container.innerHTML = '';

        const filtered = this.searchQuery.trim() === ''
            ? this.tracks
            : this.tracks.filter(t =>
                t.label.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                t.language.toLowerCase().includes(this.searchQuery.toLowerCase())
            );

        if (filtered.length === 0 && this.searchQuery.trim() !== '') {
            const empty = document.createElement('div');
            empty.className = `${p}player-sub-empty`;
            empty.textContent = `No results for "${this.searchQuery}"`;
            container.appendChild(empty);
            return;
        }

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = `${p}player-sub-empty`;
            empty.textContent = 'No subtitles available';
            container.appendChild(empty);
            return;
        }

        // Track items
        for (const track of filtered) {
            const isActive = track.id === this.activeTrackId;
            const row = document.createElement('button');
            row.className = `${p}player-sub-track-item${isActive ? ` ${p}player-sub-track-item--active` : ''}`;
            row.type = 'button';
            row.setAttribute('role', 'menuitem');
            row.setAttribute('aria-checked', String(isActive));

            const label = document.createElement('span');
            label.className = `${p}player-sub-track-label`;
            label.textContent = track.label;

            const right = document.createElement('span');
            right.className = `${p}player-sub-track-right`;

            if (isActive) {
                const dot = document.createElement('span');
                dot.className = `${p}player-sub-dot`;
                right.appendChild(dot);
            }

            row.appendChild(label);
            row.appendChild(right);

            row.addEventListener('click', (e) => {
                e.stopPropagation();
                this.saveScrollPosition();
                this.onSelect(track.id);
            });
            container.appendChild(row);
        }
    }

    private rebuildTrackList(): void {
        if (this.trackListEl) {
            this.populateTrackList(this.trackListEl);
        }
    }

    // ── Customize View ─────────────────────────────────────

    private renderCustomizeView(): void {
        if (!this.panel) return;
        const p = this.config.classPrefix ?? '';

        // Header
        const header = document.createElement('div');
        header.className = `${p}player-sub-header`;

        const headerLeft = document.createElement('div');
        headerLeft.className = `${p}player-sub-header-left`;

        const backBtn = document.createElement('button');
        backBtn.className = `${p}player-sub-header-btn`;
        backBtn.type = 'button';
        backBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
        backBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.currentView = 'tracks';
            this.renderCurrentView();
        });
        headerLeft.appendChild(backBtn);

        const titleSpan = document.createElement('span');
        titleSpan.className = `${p}player-sub-header-title`;
        titleSpan.textContent = 'Customize';
        headerLeft.appendChild(titleSpan);

        header.appendChild(headerLeft);
        header.appendChild(document.createElement('div')); // empty right slot
        this.panel.appendChild(header);

        // Scrollable content
        const content = document.createElement('div');
        content.className = `${p}player-sub-customize-content`;

        // ── Subtitle Delay ──
        this.buildDelaySection(content);

        content.appendChild(this.createDivider());

        // ── Background Opacity ──
        this.buildSliderSetting(content, 'Background opacity', '%',
            this.appearance.backgroundOpacity, 0, 100, 1,
            (val) => { this.appearance.backgroundOpacity = val; this.emitAppearance(); });

        content.appendChild(this.createDivider());

        // ── Text Size ──
        this.buildSliderSetting(content, 'Text size', '%',
            this.appearance.fontSize, 50, 200, 5,
            (val) => { this.appearance.fontSize = val; this.emitAppearance(); });

        content.appendChild(this.createDivider());

        // ── Bold Text ──
        this.buildToggleSetting(content, 'Bold text', this.appearance.bold,
            (val) => { this.appearance.bold = val; this.emitAppearance(); });

        content.appendChild(this.createDivider());

        // ── Text Color ──
        this.buildColorSetting(content);

        content.appendChild(this.createDivider());

        // ── Vertical Position ──
        this.buildPositionSetting(content);

        content.appendChild(this.createDivider());

        // ── Reset Button ──
        const resetBtn = document.createElement('button');
        resetBtn.className = `${p}player-sub-reset-btn`;
        resetBtn.type = 'button';
        resetBtn.textContent = 'Reset to defaults';
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.appearance = { ...DEFAULT_APPEARANCE };
            this.offset = 0;
            this.onOffsetChange(0);
            this.emitAppearance();
            this.renderCurrentView();
        });
        content.appendChild(resetBtn);

        this.panel.appendChild(content);
    }

    private buildDelaySection(container: HTMLElement): void {
        const p = this.config.classPrefix ?? '';

        const group = document.createElement('div');
        group.className = `${p}player-sub-setting-group`;

        const label = document.createElement('p');
        label.className = `${p}player-sub-setting-label`;
        label.textContent = 'Subtitle delay';
        group.appendChild(label);

        // Slider
        const sliderWrap = document.createElement('div');
        sliderWrap.className = `${p}player-sub-slider-wrap`;

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '-5';
        slider.max = '5';
        slider.step = '0.1';
        slider.value = this.offset.toString();
        slider.className = `${p}player-sub-delay-slider ${p}player-sub-range`;

        const valueDisplay = document.createElement('span');
        valueDisplay.className = `${p}player-sub-delay-value ${p}player-sub-range-value`;
        valueDisplay.textContent = this.formatOffset(this.offset);

        slider.addEventListener('input', (e) => {
            e.stopPropagation();
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.offset = val;
            this.onOffsetChange(val);
            valueDisplay.textContent = this.formatOffset(val);
        });

        sliderWrap.appendChild(slider);
        sliderWrap.appendChild(valueDisplay);
        group.appendChild(sliderWrap);

        // +/- buttons
        const btnRow = document.createElement('div');
        btnRow.className = `${p}player-sub-delay-btns`;

        const minusBtn = document.createElement('button');
        minusBtn.className = `${p}player-sub-delay-btn`;
        minusBtn.type = 'button';
        minusBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg><span>Earlier</span>`;
        minusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const v = Math.max(-5, this.offset - 0.1);
            this.offset = v;
            this.onOffsetChange(v);
            slider.value = v.toString();
            valueDisplay.textContent = this.formatOffset(v);
        });

        const display = document.createElement('span');
        display.className = `${p}player-sub-delay-display`;
        display.textContent = this.formatOffset(this.offset);

        const plusBtn = document.createElement('button');
        plusBtn.className = `${p}player-sub-delay-btn`;
        plusBtn.type = 'button';
        plusBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg><span>Later</span>`;
        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const v = Math.min(5, this.offset + 0.1);
            this.offset = v;
            this.onOffsetChange(v);
            slider.value = v.toString();
            valueDisplay.textContent = this.formatOffset(v);
        });

        btnRow.appendChild(minusBtn);
        btnRow.appendChild(display);
        btnRow.appendChild(plusBtn);
        group.appendChild(btnRow);

        container.appendChild(group);
    }

    private buildSliderSetting(
        container: HTMLElement, labelText: string, unit: string,
        value: number, min: number, max: number, step: number,
        onChange: (val: number) => void
    ): void {
        const p = this.config.classPrefix ?? '';

        const group = document.createElement('div');
        group.className = `${p}player-sub-setting-group`;

        const row = document.createElement('div');
        row.className = `${p}player-sub-setting-row`;

        const label = document.createElement('p');
        label.className = `${p}player-sub-setting-label`;
        label.textContent = labelText;

        const valDisplay = document.createElement('span');
        valDisplay.className = `${p}player-sub-range-value`;
        valDisplay.textContent = `${Math.round(value)}${unit}`;

        row.appendChild(label);
        row.appendChild(valDisplay);
        group.appendChild(row);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = String(min);
        slider.max = String(max);
        slider.step = String(step);
        slider.value = String(value);
        slider.className = `${p}player-sub-range`;

        slider.addEventListener('input', (e) => {
            e.stopPropagation();
            const v = parseFloat((e.target as HTMLInputElement).value);
            valDisplay.textContent = `${Math.round(v)}${unit}`;
            onChange(v);
        });

        group.appendChild(slider);
        container.appendChild(group);
    }

    private buildToggleSetting(
        container: HTMLElement, labelText: string, value: boolean,
        onChange: (val: boolean) => void
    ): void {
        const p = this.config.classPrefix ?? '';

        const row = document.createElement('div');
        row.className = `${p}player-sub-toggle-row`;

        const label = document.createElement('span');
        label.className = `${p}player-sub-toggle-label`;
        label.textContent = labelText;

        const toggle = this.createToggle(value, onChange);

        row.appendChild(label);
        row.appendChild(toggle);
        container.appendChild(row);
    }

    private buildColorSetting(container: HTMLElement): void {
        const p = this.config.classPrefix ?? '';

        const group = document.createElement('div');
        group.className = `${p}player-sub-setting-group`;

        const label = document.createElement('p');
        label.className = `${p}player-sub-setting-label`;
        label.textContent = 'Text color';
        group.appendChild(label);

        const colors = ['#ffffff', '#80b1fa', '#e2e535', '#10b239', '#ff6b6b', '#ffa500'];
        const swatchRow = document.createElement('div');
        swatchRow.className = `${p}player-sub-color-row`;

        for (const color of colors) {
            const btn = document.createElement('button');
            btn.className = `${p}player-sub-color-swatch${this.appearance.textColor === color ? ` ${p}player-sub-color-swatch--active` : ''}`;
            btn.type = 'button';

            const circle = document.createElement('span');
            circle.className = `${p}player-sub-color-circle`;
            circle.style.background = color;
            btn.appendChild(circle);

            if (this.appearance.textColor === color) {
                const check = document.createElement('span');
                check.className = `${p}player-sub-color-check`;
                check.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="${this.getContrastColor(color)}"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;
                circle.appendChild(check);
            }

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.appearance.textColor = color;
                this.emitAppearance();
                this.renderCurrentView();
            });
            swatchRow.appendChild(btn);
        }

        // Custom color picker
        const customWrap = document.createElement('div');
        customWrap.className = `${p}player-sub-color-custom`;

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = this.appearance.textColor;
        colorInput.className = `${p}player-sub-color-input`;
        colorInput.addEventListener('input', (e) => {
            e.stopPropagation();
            this.appearance.textColor = (e.target as HTMLInputElement).value;
            this.emitAppearance();
            this.renderCurrentView();
        });

        const pickerIcon = document.createElement('span');
        pickerIcon.className = `${p}player-sub-color-picker-icon`;
        pickerIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.66 5.41l.92.92-2.69 2.69-.92-.92 2.69-2.69M17.67 3c-.26 0-.51.1-.71.29l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42l-2.34-2.34c-.2-.19-.45-.29-.71-.29z"/></svg>`;

        customWrap.appendChild(colorInput);
        customWrap.appendChild(pickerIcon);
        swatchRow.appendChild(customWrap);

        group.appendChild(swatchRow);
        container.appendChild(group);
    }

    private buildPositionSetting(container: HTMLElement): void {
        const p = this.config.classPrefix ?? '';

        const group = document.createElement('div');
        group.className = `${p}player-sub-setting-group`;

        const row = document.createElement('div');
        row.className = `${p}player-sub-setting-row`;

        const label = document.createElement('p');
        label.className = `${p}player-sub-setting-label`;
        label.textContent = 'Vertical position';

        const btnGroup = document.createElement('div');
        btnGroup.className = `${p}player-sub-pos-btns`;

        const positions: Array<{ value: 'default' | 'high'; label: string }> = [
            { value: 'default', label: 'Default' },
            { value: 'high', label: 'High' },
        ];

        for (const pos of positions) {
            const btn = document.createElement('button');
            btn.className = `${p}player-sub-pos-btn${this.appearance.verticalPosition === pos.value ? ` ${p}player-sub-pos-btn--active` : ''}`;
            btn.type = 'button';
            btn.textContent = pos.label;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.appearance.verticalPosition = pos.value;
                this.emitAppearance();
                this.renderCurrentView();
            });
            btnGroup.appendChild(btn);
        }

        row.appendChild(label);
        row.appendChild(btnGroup);
        group.appendChild(row);
        container.appendChild(group);
    }

    // ── Shared UI Builders ─────────────────────────────────

    private createToggle(checked: boolean, onChange: (val: boolean) => void): HTMLElement {
        const p = this.config.classPrefix ?? '';
        const wrap = document.createElement('button');
        wrap.className = `${p}player-sub-toggle${checked ? ` ${p}player-sub-toggle--on` : ''}`;
        wrap.type = 'button';
        wrap.setAttribute('role', 'switch');
        wrap.setAttribute('aria-checked', String(checked));

        const knob = document.createElement('span');
        knob.className = `${p}player-sub-toggle-knob`;
        wrap.appendChild(knob);

        wrap.addEventListener('click', (e) => {
            e.stopPropagation();
            const newState = !wrap.classList.contains(`${p}player-sub-toggle--on`);
            wrap.classList.toggle(`${p}player-sub-toggle--on`, newState);
            wrap.setAttribute('aria-checked', String(newState));
            onChange(newState);
        });

        return wrap;
    }

    private createDivider(): HTMLElement {
        const p = this.config.classPrefix ?? '';
        const div = document.createElement('hr');
        div.className = `${p}player-sub-divider`;
        return div;
    }

    private emitAppearance(): void {
        this.onAppearanceChange?.({ ...this.appearance });
    }

    private formatOffset(offset: number): string {
        const sign = offset > 0 ? '+' : '';
        return `${sign}${offset.toFixed(1)}s`;
    }

    private getContrastColor(hex: string): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000000' : '#ffffff';
    }

    // ── Open / Close ───────────────────────────────────────

    private handleButtonClick = (e: MouseEvent): void => {
        e.stopPropagation();
        this.isOpen ? this.closePanel() : this.openPanel();
    };

    private handleOutsideClick = (e: MouseEvent): void => {
        const target = e.target as Node;
        // Check if click is inside element OR inside portaled panel
        const insideElement = this.element && this.element.contains(target);
        const insidePanel = this.panel && this.panel.contains(target);
        if (!insideElement && !insidePanel) {
            this.closePanel();
        }
    };

    private openPanel(): void {
        if (!this.panel) return;
        this.currentView = 'tracks';
        this.searchQuery = '';
        this.savedScrollPosition = 0;
        this.renderCurrentView();

        // Append to portal container if set, otherwise to element
        const container = this.portalContainer ?? this.element;
        if (container && this.panel.parentElement !== container) {
            container.appendChild(this.panel);
        }

        // Position panel when portaled
        if (this.portalContainer && this.button) {
            this.positionPanelInPortal();
        }

        this.panel.style.display = 'flex';
        this.isOpen = true;
        this.button?.setAttribute('aria-expanded', 'true');
    }

    private closePanel(): void {
        if (!this.panel) return;
        this.panel.style.display = 'none';
        this.isOpen = false;
        this.button?.setAttribute('aria-expanded', 'false');
        this.trackListEl = null;
        this.searchInput = null;

        // Move panel back to element if it was portaled (for cleanup)
        if (this.portalContainer && this.element && this.panel.parentElement === this.portalContainer) {
            this.element.appendChild(this.panel);
            this.panel.style.position = '';
            this.panel.style.top = '';
            this.panel.style.right = '';
            this.panel.style.left = '';
            this.panel.style.bottom = '';
        }
    }

    private positionPanelInPortal(): void {
        if (!this.panel || !this.button || !this.portalContainer) return;

        const buttonRect = this.button.getBoundingClientRect();
        const containerRect = this.portalContainer.getBoundingClientRect();

        // Position panel above the button, aligned to the right
        const rightOffset = containerRect.right - buttonRect.right;
        const bottomOffset = containerRect.bottom - buttonRect.top + 8; // 8px gap

        this.panel.style.position = 'absolute';
        this.panel.style.bottom = `${bottomOffset}px`;
        this.panel.style.right = `${rightOffset}px`;
        this.panel.style.left = 'auto';
        this.panel.style.top = 'auto';
    }

    // ── Icons ──────────────────────────────────────────────

    private getSubtitleIcon(): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 4H5C3.89 4 3 4.9 3 6V18C3 19.1 3.89 20 5 20H19C20.1 20 21 19.1 21 18V6C21 4.9 20.1 4 19 4ZM4 18V6C4 5.45 4.45 5 5 5H19C19.55 5 20 5.45 20 6V18C20 18.55 19.55 19 19 19H5C4.45 19 4 18.55 4 18ZM6 10H8V12H6V10ZM10 10H18V12H10V10ZM6 14H14V16H6V14Z"/></svg>`;
    }
}
