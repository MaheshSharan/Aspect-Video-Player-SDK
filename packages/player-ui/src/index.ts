// Types
export type {
    UIComponent,
    PlayerUIConfig,
    PlayerUIEvents,
    SubtitleTrackConfig,
} from './types';

export { CSS_CLASSES } from './types';

// CSS injection
export { injectStyles, removeStyles, getStyles } from './inject-styles';

// Controls
export {
    PlayButton,
    SeekBar,
    TimeDisplay,
    LiveIndicator,
    VolumeControl,
    FullscreenButton,
    PiPButton,
    SkipBackButton,
    SkipForwardButton,
    TitleDisplay,

} from './controls';

// Menus
export {
    QualitySelector,
    SpeedSelector,
    LoadingSpinner,
    ErrorOverlay,
    SubtitleMenu,
} from './menus_v3';

// Player UI
export { PlayerUI, createPlayerUI } from './player-ui';

// Thumbnail preview
export { ThumbnailManager } from './thumbnail-preview';
export type { ThumbnailCue } from './thumbnail-preview';

// Subtitles
export { SubtitleManager } from './subtitles';
export type { SubtitleCue, SubtitleTrack } from './subtitles';
