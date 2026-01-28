# Aspect Video Player SDK

A modular, TypeScript-based video player SDK designed for modern web applications. Features a headless core architecture with pluggable UI and mobile-optimized streaming.

## Packages

| Package | Description |
|---------|-------------|
| `@aspect/player-core` | Core engine with state machine, buffer management, and ABR coordination |
| `@aspect/player-sources` | Adapters for HLS (hls.js), DASH (dash.js), and native MP4 |
| `@aspect/player-ui` | Lightweight, dependency-free UI layer with Netflix-style controls |
| `@aspect/player-react` | React hooks and components |
| `@aspect/shared` | Shared types and utilities |

## Installation

```bash
npm install @aspect/player-react @aspect/player-core @aspect/player-sources
```

## Quick Start

### React

```tsx
import { AspectPlayer } from '@aspect/player-react';

function App() {
  return (
    <AspectPlayer
      source={{ url: 'https://example.com/stream.m3u8' }}
      title="Video Title"
      controls
      autoplay={false}
    />
  );
}
```

### Vanilla JavaScript

```typescript
import { CorePlayerEngine } from '@aspect/player-core';
import { createSourceAdapter } from '@aspect/player-sources';
import { createPlayerUI } from '@aspect/player-ui';

const video = document.querySelector('video');

const engine = new CorePlayerEngine({ videoElement: video });
engine.registerSourceAdapterFactory(createSourceAdapter);

const ui = createPlayerUI(engine, {
  container: document.getElementById('player-container'),
  title: 'Video Title',
});

await engine.load({ url: 'https://example.com/stream.m3u8' });
await engine.play();
```

## Configuration

### AspectPlayer Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `MediaSourceConfig` | - | Media source with URL and optional MIME type |
| `controls` | `boolean` | `true` | Show built-in UI controls |
| `autoplay` | `boolean` | `false` | Start playback automatically |
| `muted` | `boolean` | `false` | Start muted |
| `volume` | `number` | `1` | Initial volume (0-1) |
| `title` | `string` | - | Video title displayed in controls |
| `episodeInfo` | `string` | - | Episode info (e.g., "S1 E1") |
| `showSubtitles` | `boolean` | `false` | Show subtitle button (only when subtitles available) |

### PlayerUI Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | `HTMLElement` | - | Container for UI overlay |
| `title` | `string` | - | Video title |
| `episodeInfo` | `string` | - | Episode info |
| `showSubtitles` | `boolean` | `false` | Show subtitle button |
| `showSpeedSelector` | `boolean` | `true` | Show playback speed control |
| `showQualitySelector` | `boolean` | `true` | Show quality selector |
| `showPiP` | `boolean` | `true` | Show picture-in-picture button |
| `autohide` | `boolean` | `true` | Auto-hide controls during playback |
| `autohideDelay` | `number` | `3000` | Delay before hiding (ms) |

### Event Handlers

```tsx
<AspectPlayer
  onReady={() => {}}
  onPlay={() => {}}
  onPause={() => {}}
  onEnded={() => {}}
  onError={(error) => {}}
  onTimeUpdate={(currentTime, duration) => {}}
  onQualityChange={(level, auto) => {}}
  onVolumeChange={(volume, muted) => {}}
  onStateChange={(state) => {}}
/>
```

## UI Controls

The default UI includes:

- Play/Pause button
- 10-second skip back/forward buttons
- Volume slider with mute toggle
- Seek bar with buffer visualization and preview tooltip
- Time display
- Title display (center)
- Playback speed selector
- Picture-in-Picture button
- Fullscreen toggle
- Subtitle button (conditional)
- Subtitle overlay (when tracks provided)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space / K | Play/Pause |
| M | Toggle mute |
| Arrow Left / J | Seek back 10s |
| Arrow Right / L | Seek forward 10s |
| Arrow Up | Volume up 10% |
| Arrow Down | Volume down 10% |
| F | Toggle fullscreen |

## Development

Monorepo managed with `pnpm` and `turbo`.

```bash
pnpm install    # Install dependencies
pnpm build      # Build all packages
pnpm dev        # Development mode
pnpm test       # Run tests
pnpm lint       # Run linter
```

## License

MIT
