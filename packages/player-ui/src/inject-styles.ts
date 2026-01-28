/**
 * CSS injection utility for PlayerUI.
 * Automatically injects styles into the document when the module is loaded.
 */

// CSS content is embedded at build time
const CSS_CONTENT = `/* Player UI Styles - Netflix-inspired */
:root {
  --player-primary: #ffffff;
  --player-accent: #e50914;
  --player-bg: rgba(0, 0, 0, 0.8);
  --player-bg-solid: #141414;
  --player-text: #ffffff;
  --player-text-muted: rgba(255, 255, 255, 0.7);
  --player-border-radius: 4px;
  --player-transition: 0.2s ease;
  --player-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --player-font-size: 14px;
  --player-slider-height: 4px;
  --player-slider-thumb-size: 14px;
}

.player-ui {
  position: absolute;
  inset: 0;
  font-family: var(--player-font-family);
  font-size: var(--player-font-size);
  color: var(--player-text);
  user-select: none;
  -webkit-user-select: none;
  z-index: 1;
}

/* Subtitle overlay */
.player-subtitles {
  position: absolute;
  bottom: 80px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 24px;
  font-weight: 500;
  color: var(--player-text);
  text-shadow: 
    0 0 4px rgba(0, 0, 0, 0.9),
    0 0 8px rgba(0, 0, 0, 0.8),
    2px 2px 4px rgba(0, 0, 0, 0.9);
  padding: 0 40px;
  pointer-events: none;
  z-index: 5;
  line-height: 1.4;
}

.player-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  background: linear-gradient(transparent, var(--player-bg));
  transition: opacity var(--player-transition);
  z-index: 10;
}

.player-controls--hidden {
  opacity: 0;
  pointer-events: none;
}

.player-controls__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-controls__row--bottom {
  margin-top: 8px;
  justify-content: space-between;
}

/* Netflix-style three-column layout */
.player-controls__left {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.player-controls__center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.player-controls__right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.player-controls__spacer {
  flex: 1;
}

/* Title display */
.player-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--player-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-title__text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-title__episode {
  color: var(--player-text-muted);
  font-weight: 400;
}

.player-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: var(--player-border-radius);
  background: transparent;
  color: var(--player-primary);
  cursor: pointer;
  transition: transform var(--player-transition), background var(--player-transition);
}

.player-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}

.player-btn:active {
  transform: scale(0.95);
}

.player-btn:focus {
  outline: 2px solid var(--player-accent);
  outline-offset: 2px;
}

.player-btn svg {
  width: 24px;
  height: 24px;
  fill: currentColor;
}

.player-slider {
  position: relative;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.player-slider--seek {
  flex: 1;
}

.player-slider--volume {
  width: 80px;
}

.player-slider__track {
  position: relative;
  width: 100%;
  height: var(--player-slider-height);
  background: rgba(255, 255, 255, 0.2);
  border-radius: calc(var(--player-slider-height) / 2);
  overflow: visible;
}

.player-slider__buffer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.4);
  border-radius: calc(var(--player-slider-height) / 2);
  transition: width 0.1s linear;
}

.player-slider__fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--player-accent);
  border-radius: calc(var(--player-slider-height) / 2);
}

.player-slider__thumb {
  position: absolute;
  top: 50%;
  width: var(--player-slider-thumb-size);
  height: var(--player-slider-thumb-size);
  margin-top: calc(var(--player-slider-thumb-size) / -2);
  margin-left: calc(var(--player-slider-thumb-size) / -2);
  background: var(--player-primary);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transform: scale(0);
  transition: transform var(--player-transition);
  pointer-events: none;
}

.player-slider:hover .player-slider__thumb {
  transform: scale(1);
}

/* Preview tooltip */
.player-preview {
  position: absolute;
  bottom: 100%;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0, 0, 0, 0.9);
  border-radius: 4px;
  padding: 4px 8px;
  pointer-events: none;
  z-index: 10;
}

.player-preview__thumbnail {
  width: 160px;
  height: 90px;
  background-size: cover;
  background-position: center;
  border-radius: 2px;
  margin-bottom: 4px;
  display: none;
}

.player-preview__thumbnail--visible {
  display: block;
}

.player-preview__time {
  font-size: 12px;
  font-weight: 500;
  color: var(--player-text);
  white-space: nowrap;
}

/* Native range input styling for volume slider */
input[type="range"].player-slider {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  height: 24px;
}

input[type="range"].player-slider::-webkit-slider-runnable-track {
  height: var(--player-slider-height);
  background: rgba(255, 255, 255, 0.2);
  border-radius: calc(var(--player-slider-height) / 2);
}

input[type="range"].player-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: var(--player-slider-thumb-size);
  height: var(--player-slider-thumb-size);
  background: var(--player-accent);
  border-radius: 50%;
  border: none;
  margin-top: calc((var(--player-slider-height) - var(--player-slider-thumb-size)) / 2);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  transition: transform var(--player-transition);
}

input[type="range"].player-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

input[type="range"].player-slider::-moz-range-track {
  height: var(--player-slider-height);
  background: rgba(255, 255, 255, 0.2);
  border-radius: calc(var(--player-slider-height) / 2);
  border: none;
}

input[type="range"].player-slider::-moz-range-thumb {
  width: var(--player-slider-thumb-size);
  height: var(--player-slider-thumb-size);
  background: var(--player-accent);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

input[type="range"].player-slider::-moz-range-progress {
  height: var(--player-slider-height);
  background: var(--player-accent);
  border-radius: calc(var(--player-slider-height) / 2);
}

.player-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--player-text);
  white-space: nowrap;
  min-width: 90px;
}

.player-time--separator {
  color: var(--player-text-muted);
}

.player-volume-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.player-volume-group .player-slider--volume {
  width: 0;
  opacity: 0;
  transition: width var(--player-transition), opacity var(--player-transition);
  overflow: hidden;
}

.player-volume-group:hover .player-slider--volume {
  width: 80px;
  opacity: 1;
}

.player-menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  min-width: 140px;
  margin-bottom: 8px;
  padding: 8px 0;
  background: var(--player-bg-solid);
  border-radius: var(--player-border-radius);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 100;
}

.player-menu__item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--player-text);
  text-align: left;
  font-size: var(--player-font-size);
  cursor: pointer;
  transition: background var(--player-transition);
}

.player-menu__item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.player-menu__item--active {
  color: var(--player-accent);
  font-weight: 600;
}

.player-menu__item--active::before {
  content: '✓ ';
}

.player-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.player-spinner--visible {
  display: flex;
}

.player-spinner svg {
  width: 56px;
  height: 56px;
  color: var(--player-accent);
  animation: player-spin 1s linear infinite;
}

.player-spinner circle {
  stroke: var(--player-accent);
}

@keyframes player-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.player-error {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  background: rgba(0, 0, 0, 0.95);
  text-align: center;
  z-index: 20;
}

.player-error--visible {
  display: flex;
}

.player-error__message {
  margin: 0;
  color: var(--player-text);
  font-size: 16px;
  max-width: 400px;
}

.player-error__retry {
  padding: 12px 28px;
  background: var(--player-accent);
  color: var(--player-primary);
  font-weight: 600;
  font-size: 14px;
  border: none;
  border-radius: var(--player-border-radius);
  cursor: pointer;
  transition: background var(--player-transition), transform var(--player-transition);
}

.player-error__retry:hover {
  background: #ff1a26;
  transform: scale(1.05);
}

.quality-selector,
.speed-selector {
  position: relative;
}

@media (max-width: 480px) {
  .player-controls {
    padding: 8px 10px;
  }

  .player-btn {
    width: 36px;
    height: 36px;
  }

  .player-btn svg {
    width: 20px;
    height: 20px;
  }

  .player-time {
    font-size: 11px;
    min-width: 70px;
  }

  .player-volume-group .player-slider--volume {
    display: none !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .player-btn,
  .player-slider__thumb,
  .player-menu__item,
  .player-volume-group .player-slider--volume {
    transition: none;
  }

  .player-spinner svg {
    animation: none;
  }
}`;

let stylesInjected = false;
let styleElement: HTMLStyleElement | null = null;

/**
 * Inject player UI styles into the document head.
 * This function is idempotent - calling it multiple times has no effect.
 */
export function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') {
    return;
  }

  styleElement = document.createElement('style');
  styleElement.id = 'aspect-player-ui-styles';
  styleElement.textContent = CSS_CONTENT;
  document.head.appendChild(styleElement);
  stylesInjected = true;
}

/**
 * Remove injected player UI styles from the document.
 */
export function removeStyles(): void {
  if (styleElement !== null) {
    styleElement.remove();
    styleElement = null;
    stylesInjected = false;
  }
}

/**
 * Get the raw CSS content as a string.
 */
export function getStyles(): string {
  return CSS_CONTENT;
}
