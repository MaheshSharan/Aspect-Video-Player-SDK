import { createContext, useContext } from 'react';
import type { PlayerContextValue } from './types';

/**
 * Default context value when no provider is present.
 */
const defaultContextValue: PlayerContextValue = {
    engine: null,
    snapshot: null,
    isReady: false,
    isLoading: false,
    error: null,
};

/**
 * Player context for sharing player state across components.
 */
export const PlayerContext = createContext<PlayerContextValue>(defaultContextValue);

/**
 * Hook to access the player context.
 * Must be used within a PlayerProvider.
 *
 * @returns Player context value
 * @throws Error if used outside PlayerProvider
 */
export function usePlayerContext(): PlayerContextValue {
    const context = useContext(PlayerContext);

    if (context === defaultContextValue) {
        throw new Error('usePlayerContext must be used within a PlayerProvider');
    }

    return context;
}

/**
 * Hook to check if we're inside a PlayerProvider.
 *
 * @returns True if inside a PlayerProvider
 */
export function useHasPlayerContext(): boolean {
    const context = useContext(PlayerContext);
    return context !== defaultContextValue;
}
