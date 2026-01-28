import { useRef, useEffect, useState, useCallback } from 'react';
import {
    CorePlayerEngine,
    type PlayerEngine,
    type PlayerSnapshot,
} from '@aspect/player-core';
import { createSourceAdapter } from '@aspect/player-sources';
import type { MediaSourceConfig, Unsubscribe } from '@aspect/shared';
import type { UsePlayerOptions, UsePlayerReturn } from './types';

/**
 * Hook to create and manage a player engine instance.
 *
 * @param options - Player options
 * @returns Player controls and state
 *
 * @example
 * ```tsx
 * function VideoPlayer() {
 *   const { videoRef, load, play, pause, snapshot } = usePlayer();
 *
 *   useEffect(() => {
 *     load({ url: 'https://example.com/video.m3u8' });
 *   }, []);
 *
 *   return <video ref={videoRef} />;
 * }
 * ```
 */
export function usePlayer(options: UsePlayerOptions = {}): UsePlayerReturn {
    const videoRef = useRef<HTMLVideoElement>(null);
    const engineRef = useRef<PlayerEngine | null>(null);
    const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Initialize engine on mount
    useEffect(() => {
        const video = videoRef.current;
        if (video === null) {
            return;
        }

        // Create engine
        const engine = new CorePlayerEngine({
            videoElement: video,
            debug: options.debug,
            ...options.config,
        });

        // Register source adapter factory
        engine.registerSourceAdapterFactory((config: MediaSourceConfig) => {
            return createSourceAdapter(config, {
                debug: options.debug,
            });
        });

        // Listen for state updates
        const subscriptions: Unsubscribe[] = [];

        const updateSnapshot = (): void => {
            setSnapshot(engine.getSnapshot());
        };

        subscriptions.push(engine.on('statechange', updateSnapshot));
        subscriptions.push(engine.on('timeupdate', updateSnapshot));
        subscriptions.push(engine.on('bufferupdate', updateSnapshot));
        subscriptions.push(engine.on('qualitylevels', updateSnapshot));
        subscriptions.push(engine.on('qualitychange', updateSnapshot));
        subscriptions.push(engine.on('volumechange', updateSnapshot));
        subscriptions.push(engine.on('ratechange', updateSnapshot));
        subscriptions.push(engine.on('error', updateSnapshot));

        subscriptions.push(
            engine.on('loaded', () => {
                setIsReady(true);
                updateSnapshot();
            })
        );

        engineRef.current = engine;
        updateSnapshot();

        return () => {
            for (const unsub of subscriptions) {
                unsub();
            }
            engine.destroy();
            engineRef.current = null;
            setIsReady(false);
            setSnapshot(null);
        };
    }, [options.debug, options.config]);

    // Load source
    const load = useCallback(async (source: MediaSourceConfig): Promise<void> => {
        const engine = engineRef.current;
        if (engine === null) {
            throw new Error('Player not initialized');
        }

        setIsReady(false);
        await engine.load(source);
    }, []);

    // Play
    const play = useCallback(async (): Promise<void> => {
        const engine = engineRef.current;
        if (engine !== null) {
            await engine.play();
        }
    }, []);

    // Pause
    const pause = useCallback((): void => {
        const engine = engineRef.current;
        if (engine !== null) {
            engine.pause();
        }
    }, []);

    // Seek
    const seek = useCallback((seconds: number): void => {
        const engine = engineRef.current;
        if (engine !== null) {
            engine.seek(seconds);
        }
    }, []);

    // Volume
    const setVolume = useCallback((volume: number): void => {
        const engine = engineRef.current;
        if (engine !== null) {
            engine.setVolume(volume);
        }
    }, []);

    // Muted
    const setMuted = useCallback((muted: boolean): void => {
        const engine = engineRef.current;
        if (engine !== null) {
            engine.setMuted(muted);
        }
    }, []);

    // Quality
    const setQuality = useCallback((index: number): void => {
        const engine = engineRef.current;
        if (engine !== null) {
            engine.setQuality(index);
        }
    }, []);

    // Destroy
    const destroy = useCallback((): void => {
        const engine = engineRef.current;
        if (engine !== null) {
            engine.destroy();
            engineRef.current = null;
        }
    }, []);

    return {
        videoRef,
        engine: engineRef.current,
        snapshot,
        isReady,
        load,
        play,
        pause,
        seek,
        setVolume,
        setMuted,
        setQuality,
        destroy,
    };
}

/**
 * Hook to access current player state.
 * Must be used within a component that has a player.
 *
 * @param engine - Player engine instance
 * @returns Current player snapshot
 */
export function usePlayerState(engine: PlayerEngine | null): PlayerSnapshot | null {
    const [snapshot, setSnapshot] = useState<PlayerSnapshot | null>(null);

    useEffect(() => {
        if (engine === null) {
            setSnapshot(null);
            return;
        }

        const updateSnapshot = (): void => {
            setSnapshot(engine.getSnapshot());
        };

        const subscriptions: Unsubscribe[] = [
            engine.on('statechange', updateSnapshot),
            engine.on('timeupdate', updateSnapshot),
            engine.on('bufferupdate', updateSnapshot),
            engine.on('qualitychange', updateSnapshot),
            engine.on('volumechange', updateSnapshot),
        ];

        updateSnapshot();

        return () => {
            for (const unsub of subscriptions) {
                unsub();
            }
        };
    }, [engine]);

    return snapshot;
}

/**
 * Hook for playback controls.
 *
 * @param engine - Player engine instance
 * @returns Playback control functions
 */
export function usePlayback(engine: PlayerEngine | null) {
    const play = useCallback(async () => {
        if (engine !== null) {
            await engine.play();
        }
    }, [engine]);

    const pause = useCallback(() => {
        if (engine !== null) {
            engine.pause();
        }
    }, [engine]);

    const toggle = useCallback(async () => {
        if (engine !== null) {
            const snapshot = engine.getSnapshot();
            if (snapshot.state === 'playing') {
                engine.pause();
            } else {
                await engine.play();
            }
        }
    }, [engine]);

    const seek = useCallback(
        (seconds: number) => {
            if (engine !== null) {
                engine.seek(seconds);
            }
        },
        [engine]
    );

    return { play, pause, toggle, seek };
}

/**
 * Hook for volume controls.
 *
 * @param engine - Player engine instance
 * @returns Volume control functions and state
 */
export function useVolume(engine: PlayerEngine | null) {
    const [volume, setVolumeState] = useState(1);
    const [muted, setMutedState] = useState(false);

    useEffect(() => {
        if (engine === null) return;

        const updateVolume = ({ volume: v, muted: m }: { volume: number; muted: boolean }) => {
            setVolumeState(v);
            setMutedState(m);
        };

        const snapshot = engine.getSnapshot();
        setVolumeState(snapshot.volume);
        setMutedState(snapshot.muted);

        return engine.on('volumechange', updateVolume);
    }, [engine]);

    const setVolume = useCallback(
        (v: number) => {
            if (engine !== null) {
                engine.setVolume(v);
            }
        },
        [engine]
    );

    const setMuted = useCallback(
        (m: boolean) => {
            if (engine !== null) {
                engine.setMuted(m);
            }
        },
        [engine]
    );

    const toggleMute = useCallback(() => {
        if (engine !== null) {
            engine.setMuted(!muted);
        }
    }, [engine, muted]);

    return { volume, muted, setVolume, setMuted, toggleMute };
}

/**
 * Hook for fullscreen controls.
 *
 * @param engine - Player engine instance
 * @returns Fullscreen control functions and state
 */
export function useFullscreen(engine: PlayerEngine | null) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (engine === null) return;

        return engine.on('fullscreenchange', ({ fullscreen }) => {
            setIsFullscreen(fullscreen);
        });
    }, [engine]);

    const enter = useCallback(async () => {
        if (engine !== null) {
            await engine.requestFullscreen();
        }
    }, [engine]);

    const exit = useCallback(async () => {
        if (engine !== null) {
            await engine.exitFullscreen();
        }
    }, [engine]);

    const toggle = useCallback(async () => {
        if (isFullscreen) {
            await exit();
        } else {
            await enter();
        }
    }, [isFullscreen, enter, exit]);

    return { isFullscreen, enter, exit, toggle };
}

/**
 * Hook for quality controls.
 *
 * @param engine - Player engine instance
 * @returns Quality control functions and state
 */
export function useQuality(engine: PlayerEngine | null) {
    const [levels, setLevels] = useState<readonly import('@aspect/shared').QualityLevel[]>([]);
    const [currentLevel, setCurrentLevel] = useState<import('@aspect/shared').QualityLevel | undefined>();
    const [isAuto, setIsAuto] = useState(true);

    useEffect(() => {
        if (engine === null) return;

        const updateLevels = ({ levels: l }: { levels: readonly import('@aspect/shared').QualityLevel[] }) => {
            setLevels(l);
        };

        const updateQuality = ({ level, auto }: { level: import('@aspect/shared').QualityLevel; auto: boolean }) => {
            setCurrentLevel(level);
            setIsAuto(auto);
        };

        const subscriptions: Unsubscribe[] = [
            engine.on('qualitylevels', updateLevels),
            engine.on('qualitychange', updateQuality),
        ];

        const snapshot = engine.getSnapshot();
        setLevels(snapshot.qualityLevels);
        setCurrentLevel(snapshot.currentQuality);
        setIsAuto(snapshot.abrEnabled);

        return () => {
            for (const unsub of subscriptions) {
                unsub();
            }
        };
    }, [engine]);

    const setQuality = useCallback(
        (index: number) => {
            if (engine !== null) {
                engine.setQuality(index);
            }
        },
        [engine]
    );

    const setAuto = useCallback(() => {
        if (engine !== null) {
            engine.setAutoQuality(true);
        }
    }, [engine]);

    return { levels, currentLevel, isAuto, setQuality, setAuto };
}
