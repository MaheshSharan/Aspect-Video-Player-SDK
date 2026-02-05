# API Reference

## Core Engine

### CorePlayerEngine

Main playback controller.

```typescript
new CorePlayerEngine(config: EngineConfig)
```

#### EngineConfig

| Property | Type | Description |
|----------|------|-------------|
| `videoElement` | `HTMLVideoElement` | Required |
| `autoplay` | `boolean` | Auto-start playback |
| `muted` | `boolean` | Start muted |
| `volume` | `number` | Initial volume (0-1) |
| `loop` | `boolean` | Loop playback |
| `debug` | `boolean` | Enable debug logging |

#### Methods

| Method | Description |
|--------|-------------|
| `load(source)` | Load media source |
| `play()` | Start playback |
| `pause()` | Pause playback |
| `seek(position)` | Seek to position (seconds) |
| `seekToLiveEdge()` | Seek to live edge (live streams only) |
| `setVolume(volume)` | Set volume (0-1) |
| `setMuted(muted)` | Toggle mute |
| `setQuality(index)` | Set quality level (-1 for auto) |
| `setPlaybackRate(rate)` | Set playback speed |
| `getSnapshot()` | Get current player state |
| `on(event, handler)` | Subscribe to events |

#### Events

| Event | Payload |
|-------|---------|
| `statechange` | `{ state: PlayerState }` |
| `timeupdate` | `{ currentTime, duration }` |
| `bufferupdate` | `{ forwardBuffer }` |
| `qualitychange` | `{ level, auto }` |
| `volumechange` | `{ volume, muted }` |
| `error` | `{ code, message }` |
| `ended` | - |

---

## Player UI

### createPlayerUI

```typescript
createPlayerUI(engine: PlayerEngine, config: PlayerUIConfig): PlayerUI
```

#### PlayerUIConfig

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `container` | `HTMLElement` | - | UI container |
| `title` | `string` | - | Video title |
| `episodeInfo` | `string` | - | Episode info |
| `showSubtitles` | `boolean` | `false` | Show CC button |
| `showSpeedSelector` | `boolean` | `true` | Show speed control |
| `showQualitySelector` | `boolean` | `true` | Show quality selector |
| `showPiP` | `boolean` | `true` | Show PiP button |
| `autohide` | `boolean` | `true` | Auto-hide controls |
| `autohideDelay` | `number` | `3000` | Hide delay (ms) |
| `subtitleTracks` | `SubtitleTrackConfig[]` | - | Available subtitle tracks |
| `thumbnailTrack` | `string` | - | URL to thumbnail VTT file |

#### PlayerUI Methods

| Method | Description |
|--------|-------------|
| `setTitle(title, episodeInfo?)` | Update displayed title |
| `showControls()` | Show control bar |
| `hideControls()` | Hide control bar |
| `destroy()` | Cleanup and remove UI |

---

## React Components

### AspectPlayer

```tsx
<AspectPlayer
  source={{ url: string, type?: string }}
  title?: string
  episodeInfo?: string
  controls?: boolean
  autoplay?: boolean
  muted?: boolean
  volume?: number
  subtitleTracks?: Array<{ id, label, language, url, default? }>
  thumbnailTrack?: string
  onReady?: () => void
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onError?: (error: Error) => void
  onStateChange?: (state: string) => void
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onQualityChange?: (level: QualityLevel, auto: boolean) => void
  onVolumeChange?: (volume: number, muted: boolean) => void
/>
```

### usePlayer Hook

```typescript
const {
  videoRef,
  engine,
  snapshot,
  load,
  play,
  pause,
  seek,
} = usePlayer(options);
```

---

## Types

### PlayerState

```typescript
type PlayerState = 
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error';
```

### MediaSourceConfig

```typescript
interface MediaSourceConfig {
  url: string;
  type?: string;
  poster?: string;
  startPosition?: number;
  preferredQuality?: number;
}
```

### PlayerSnapshot

```typescript
interface PlayerSnapshot {
  state: PlayerState;
  currentTime: number;
  duration: number;
  buffered: BufferInfo;
  volume: number;
  muted: boolean;
  playbackRate: number;
  isLive: boolean;
  liveEdge: number | undefined;     // Live edge position (live streams only)
  liveLatency: number | undefined;  // Seconds behind live edge
  hasDVR: boolean | undefined;      // DVR/seekback available
  dvrWindow: number | undefined;    // DVR window in seconds
  qualityLevels: QualityLevel[];
  currentQuality: QualityLevel | undefined;
  abrEnabled: boolean;
  error: PlayerError | undefined;
  subtitleTracks: SubtitleTrack[];
  currentSubtitleTrack: SubtitleTrack | null;
}
```

### SubtitleTrack

```typescript
interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  url: string;
  default?: boolean;
}
```

---

## Utilities

### ThumbnailManager

Parses VTT sprite sheet files for seek bar thumbnail preview.

```typescript
const thumbnails = new ThumbnailManager(config);
await thumbnails.load('thumbnails.vtt');
const cue = thumbnails.getThumbnail(currentTime);
// cue: { url, x, y, width, height }
```

### SubtitleManager

Parses WebVTT files and renders subtitle overlay.

```typescript
const subtitles = new SubtitleManager(config);
subtitles.setTracks([{ id: 'en', label: 'English', language: 'en', url: 'subs.vtt' }]);
await subtitles.loadTrack('en');
subtitles.update(snapshot); // Called on timeupdate
```

---

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
