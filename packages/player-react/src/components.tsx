import React, {
    forwardRef,
    useRef,
    useEffect,
    useState,
    useImperativeHandle,
    useMemo,
} from 'react';
import {
    CorePlayerEngine,
    type PlayerEngine,
    type PlayerSnapshot,
} from 'aspect-player-core';
import { createSourceAdapter } from 'aspect-player-sources';
import { createPlayerUI, type PlayerUI as PlayerUIClass } from 'aspect-player-ui';
import type { MediaSourceConfig, Unsubscribe } from 'aspect-player-shared';
import type { AspectPlayerProps } from './types';
import { PlayerContext } from './context';

/**
 * AspectPlayer - Main React component for video playback.
 *
 * @example
 * ```tsx
 * import { AspectPlayer } from 'aspect-player-react';
 *
 * function App() {
 *   const playerRef = useRef<PlayerRef>(null);
 *
 *   return (
 *     <AspectPlayer
 *       source={{ url: 'https://example.com/video.m3u8' }}
 *       controls
 *       autoplay
 *       playerRef={playerRef}
 *       onReady={() => console.log('Ready!')}
 *     />
 *   );
 * }
 * ```
 */
export const AspectPlayer = forwardRef<HTMLDivElement, AspectPlayerProps>(
    function AspectPlayer(props, ref) {
        const {
            source,
            autoplay = false,
            muted = false,
            volume = 1,
            loop = false,
            debug = false,
            config = {},
            controls = true,
            title,
            episodeInfo,
            poster,
            subtitleTracks,
            thumbnailTrack,
            className,
            style,
            playerRef,
            onReady,
            onPlay,
            onPause,
            onEnded,
            onTimeUpdate,
            onBufferUpdate,
            onQualityChange,
            onError,
            onStateChange,
            onVolumeChange,
            onFullscreenChange,
        } = props;

        const containerRef = useRef<HTMLDivElement>(null);
        const videoRef = useRef<HTMLVideoElement>(null);
        const engineRef = useRef<PlayerEngine | null>(null);
        const uiRef = useRef<PlayerUIClass | null>(null);
        const subscriptionsRef = useRef<Unsubscribe[]>([]);

        const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null);
        const [isReady, setIsReady] = useState(false);
        const [isLoading, setIsLoading] = useState(false);
        const [error, setError] = useState<Error | null>(null);

        // Initialize engine
        useEffect(() => {
            const video = videoRef.current;
            const container = containerRef.current;

            if (video === null || container === null) {
                return;
            }

            // Create engine
            const engine = new CorePlayerEngine({
                videoElement: video,
                autoplay,
                muted,
                volume,
                loop,
                debug,
                ...config,
            });

            // Register source adapter factory
            engine.registerSourceAdapterFactory((sourceConfig: MediaSourceConfig) => {
                return createSourceAdapter(sourceConfig, { debug });
            });

            engineRef.current = engine;

            // Setup event subscriptions
            const subs: Unsubscribe[] = [];

            subs.push(
                engine.on('statechange', ({ state, previousState }) => {
                    setSnapshot(engine.getSnapshot());
                    onStateChange?.(state);

                    if (state === 'playing') {
                        onPlay?.();
                    } else if (state === 'paused' && previousState === 'playing') {
                        onPause?.();
                    }
                })
            );

            subs.push(
                engine.on('loaded', () => {
                    setIsReady(true);
                    setIsLoading(false);
                    setSnapshot(engine.getSnapshot());
                    onReady?.();
                })
            );

            subs.push(
                engine.on('timeupdate', (timing) => {
                    setSnapshot(engine.getSnapshot());
                    onTimeUpdate?.(timing.currentTime, timing.duration);
                })
            );

            subs.push(
                engine.on('bufferupdate', (info) => {
                    setSnapshot(engine.getSnapshot());
                    onBufferUpdate?.(info.forwardBuffer);
                })
            );

            subs.push(
                engine.on('qualitychange', ({ level, auto }) => {
                    setSnapshot(engine.getSnapshot());
                    onQualityChange?.(level, auto);
                })
            );

            subs.push(
                engine.on('volumechange', ({ volume: v, muted: m }) => {
                    setSnapshot(engine.getSnapshot());
                    onVolumeChange?.(v, m);
                })
            );

            subs.push(
                engine.on('ended', () => {
                    setSnapshot(engine.getSnapshot());
                    onEnded?.();
                })
            );

            subs.push(
                engine.on('error', (err) => {
                    setError(new Error(err.message));
                    setSnapshot(engine.getSnapshot());
                    onError?.(new Error(err.message));
                })
            );

            subs.push(
                engine.on('fullscreenchange', ({ fullscreen }) => {
                    onFullscreenChange?.(fullscreen);
                })
            );

            subs.push(
                engine.on('subtitletracks', ({ tracks }) => {
                    console.log('[AspectPlayer] Subtitle tracks updated:', tracks);
                })
            );

            subs.push(
                engine.on('subtitletrackchange', ({ trackId }) => {
                    console.log('[AspectPlayer] Subtitle track changed:', trackId);
                })
            );

            subscriptionsRef.current = subs;

            // Create UI if controls enabled
            if (controls) {
                uiRef.current = createPlayerUI(engine, {
                    container,
                    showQualitySelector: true,
                    showSpeedSelector: true,
                    showPiP: true,
                    showSubtitles: true,
                    title,
                    episodeInfo,
                    subtitleTracks,
                    thumbnailTrack,
                });
            }

            // Cleanup
            return () => {
                for (const unsub of subscriptionsRef.current) {
                    unsub();
                }
                subscriptionsRef.current = [];

                uiRef.current?.destroy();
                uiRef.current = null;

                engine.destroy();
                engineRef.current = null;

                setIsReady(false);
                setSnapshot(null);
            };
        }, [debug]); // Only recreate on debug change

        // Apply muted/volume changes
        useEffect(() => {
            const engine = engineRef.current;
            if (engine !== null) {
                engine.setMuted(muted);
                engine.setVolume(volume);
            }
        }, [muted, volume]);

        // Load source when it changes
        useEffect(() => {
            const engine = engineRef.current;
            const sourceUrl = source?.url;

            if (engine === null || sourceUrl === undefined) {
                return;
            }

            // Track if this effect is still current
            let cancelled = false;

            const loadSource = async () => {
                // Double-check source is defined (TypeScript narrow type)
                if (source === undefined) return;

                setIsLoading(true);
                setError(null);

                try {
                    await engine.load(source);
                    if (!cancelled) {
                        setIsLoading(false);
                    }
                } catch (err) {
                    if (!cancelled) {
                        setError(err instanceof Error ? err : new Error(String(err)));
                        setIsLoading(false);
                    }
                }
            };

            void loadSource();

            return () => {
                cancelled = true;
            };
        }, [source?.url]); // Track source URL, not object reference

        // Update title when it changes
        useEffect(() => {
            if (uiRef.current !== null) {
                uiRef.current.setTitle(title ?? '', episodeInfo);
            }
        }, [title, episodeInfo]);

        // Expose imperative API via ref
        useImperativeHandle(
            playerRef,
            () => ({
                getEngine: () => engineRef.current,

                load: async (src: MediaSourceConfig) => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        await engine.load(src);
                    }
                },

                play: async () => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        await engine.play();
                    }
                },

                pause: () => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        engine.pause();
                    }
                },

                seek: (seconds: number) => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        engine.seek(seconds);
                    }
                },

                setVolume: (vol: number) => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        engine.setVolume(vol);
                    }
                },

                setMuted: (m: boolean) => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        engine.setMuted(m);
                    }
                },

                setPlaybackRate: (rate: number) => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        engine.setPlaybackRate(rate);
                    }
                },

                setQuality: (index: number) => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        engine.setQuality(index);
                    }
                },

                requestFullscreen: async () => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        await engine.requestFullscreen();
                    }
                },

                exitFullscreen: async () => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        await engine.exitFullscreen();
                    }
                },

                requestPiP: async () => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        await engine.requestPictureInPicture();
                    }
                },

                exitPiP: async () => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        await engine.exitPictureInPicture();
                    }
                },

                destroy: () => {
                    const engine = engineRef.current;
                    if (engine !== null) {
                        engine.destroy();
                    }
                },
            }),
            []
        );

        // Context value
        const contextValue = useMemo(
            () => ({
                engine: engineRef.current,
                snapshot,
                isReady,
                isLoading,
                error,
            }),
            [snapshot, isReady, isLoading, error]
        );

        return (
            <PlayerContext.Provider value={contextValue}>
                <div
                    ref={(node) => {
                        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                        if (typeof ref === 'function') {
                            ref(node);
                        } else if (ref !== null) {
                            ref.current = node;
                        }
                    }}
                    className={className}
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#000',
                        overflow: 'hidden',
                        ...style,
                    }}
                >
                    <video
                        ref={videoRef}
                        poster={poster}
                        playsInline
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                        }}
                    />
                </div>
            </PlayerContext.Provider>
        );
    }
);

/**
 * PlayerProvider component for sharing player context.
 * Use this to access player state from child components.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <AspectPlayer source={source}>
 *       <CustomControls />
 *     </AspectPlayer>
 *   );
 * }
 *
 * function CustomControls() {
 *   const { snapshot, engine } = usePlayerContext();
 *   // ...
 * }
 * ```
 */
export function PlayerProvider({
    children,
    engine,
}: {
    children: React.ReactNode;
    engine: PlayerEngine | null;
}) {
    const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, _setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (engine === null) {
            setSnapshot(null);
            setIsReady(false);
            return;
        }

        const subs: Unsubscribe[] = [];

        const updateSnapshot = () => {
            setSnapshot(engine.getSnapshot());
        };

        subs.push(engine.on('statechange', updateSnapshot));
        subs.push(engine.on('loaded', () => setIsReady(true)));
        subs.push(
            engine.on('error', (err) => {
                setError(new Error(err.message));
            })
        );

        updateSnapshot();

        return () => {
            for (const unsub of subs) {
                unsub();
            }
        };
    }, [engine]);

    const value = useMemo(
        () => ({
            engine,
            snapshot,
            isReady,
            isLoading,
            error,
        }),
        [engine, snapshot, isReady, isLoading, error]
    );

    return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
