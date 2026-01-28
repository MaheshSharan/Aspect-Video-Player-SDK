import type { PlayerSnapshot } from 'aspect-player-core';

/**
 * UI component interface.
 * All UI controls implement this interface.
 */
export interface UIComponent {
    /** Component name */
    readonly name: string;

    /** Render the component DOM */
    render(): HTMLElement;

    /** Update component with player state */
    update(snapshot: PlayerSnapshot): void;

    /** Destroy the component */
    destroy(): void;
}

/**
 * Subtitle track configuration.
 */
export interface SubtitleTrackConfig {
    /** Unique track identifier */
    id: string;
    /** Display label (e.g., "English") */
    label: string;
    /** Language code (e.g., "en") */
    language: string;
    /** URL to WebVTT file */
    url: string;
    /** Whether this track is selected by default */
    default?: boolean;
}

/**
 * UI layer configuration.
 */
export interface PlayerUIConfig {
    /** Container element for the UI */
    container: HTMLElement;

    /** Show controls on hover only */
    autohide?: boolean;

    /** Autohide delay in milliseconds */
    autohideDelay?: number;

    /** Show quality selector */
    showQualitySelector?: boolean;

    /** Show speed selector */
    showSpeedSelector?: boolean;

    /** Show PiP button */
    showPiP?: boolean;

    /** Show subtitle selector */
    showSubtitles?: boolean;

    /** Video title to display */
    title?: string;

    /** Episode info (for TV shows) */
    episodeInfo?: string;

    /** Available subtitle tracks */
    subtitleTracks?: SubtitleTrackConfig[];

    /** URL to thumbnail VTT sprite sheet */
    thumbnailTrack?: string;

    /** Custom CSS class prefix */
    classPrefix?: string;
}

/**
 * UI layer events.
 */
export interface PlayerUIEvents {
    /** User requested play */
    play: void;
    /** User requested pause */
    pause: void;
    /** User requested seek */
    seek: { position: number };
    /** User changed quality */
    quality: { index: number };
    /** User changed speed */
    speed: { rate: number };
    /** User toggled fullscreen */
    fullscreen: { enter: boolean };
    /** User toggled PiP */
    pip: { enter: boolean };
    /** User changed volume */
    volume: { volume: number };
    /** User toggled mute */
    mute: { muted: boolean };
    /** User requested skip back */
    skipBack: { seconds: number };
    /** User requested skip forward */
    skipForward: { seconds: number };
}

/**
 * CSS class names for styling.
 */
export const CSS_CLASSES = {
    CONTAINER: 'player-ui',
    CONTROLS: 'player-controls',
    CONTROLS_HIDDEN: 'player-controls--hidden',
    // Layout groups
    CONTROLS_LEFT: 'player-controls__left',
    CONTROLS_CENTER: 'player-controls__center',
    CONTROLS_RIGHT: 'player-controls__right',
    CONTROLS_ROW: 'player-controls__row',
    // Buttons
    BUTTON: 'player-btn',
    BUTTON_PLAY: 'player-btn--play',
    BUTTON_PAUSE: 'player-btn--pause',
    BUTTON_SKIP_BACK: 'player-btn--skip-back',
    BUTTON_SKIP_FORWARD: 'player-btn--skip-forward',
    BUTTON_FULLSCREEN: 'player-btn--fullscreen',
    BUTTON_PIP: 'player-btn--pip',
    BUTTON_SETTINGS: 'player-btn--settings',
    BUTTON_SUBTITLES: 'player-btn--subtitles',
    BUTTON_NEXT: 'player-btn--next',
    BUTTON_EPISODES: 'player-btn--episodes',
    // Sliders
    SLIDER: 'player-slider',
    SLIDER_SEEK: 'player-slider--seek',
    SLIDER_VOLUME: 'player-slider--volume',
    SLIDER_TRACK: 'player-slider__track',
    SLIDER_FILL: 'player-slider__fill',
    SLIDER_BUFFER: 'player-slider__buffer',
    SLIDER_THUMB: 'player-slider__thumb',
    // Time
    TIME: 'player-time',
    TIME_CURRENT: 'player-time--current',
    TIME_DURATION: 'player-time--duration',
    TIME_SEPARATOR: 'player-time--separator',
    // Title
    TITLE: 'player-title',
    TITLE_EPISODE: 'player-title__episode',
    // Menu
    MENU: 'player-menu',
    MENU_ITEM: 'player-menu__item',
    MENU_ITEM_ACTIVE: 'player-menu__item--active',
    // Overlays
    SPINNER: 'player-spinner',
    ERROR: 'player-error',
    VOLUME_GROUP: 'player-volume-group',
} as const;

