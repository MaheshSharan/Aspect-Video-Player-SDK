import {
    PlayerState,
    type PlayerStateValue,
    EventEmitter,
    createLogger,
    assert,
} from '@aspect/shared';

const logger = createLogger('state-machine');

/**
 * State transition definition.
 */
interface StateTransition {
    from: PlayerStateValue | readonly PlayerStateValue[];
    to: PlayerStateValue;
    action?: string;
}

/**
 * Valid state transitions.
 * Defines the allowed transitions in the player lifecycle.
 */
const VALID_TRANSITIONS: readonly StateTransition[] = [
    // From IDLE
    { from: PlayerState.IDLE, to: PlayerState.LOADING, action: 'load' },

    // From LOADING
    { from: PlayerState.LOADING, to: PlayerState.READY, action: 'loaded' },
    { from: PlayerState.LOADING, to: PlayerState.ERROR, action: 'error' },
    { from: PlayerState.LOADING, to: PlayerState.IDLE, action: 'reset' },

    // From READY
    { from: PlayerState.READY, to: PlayerState.PLAYING, action: 'play' },
    { from: PlayerState.READY, to: PlayerState.IDLE, action: 'reset' },
    { from: PlayerState.READY, to: PlayerState.ERROR, action: 'error' },

    // From PLAYING
    { from: PlayerState.PLAYING, to: PlayerState.PAUSED, action: 'pause' },
    { from: PlayerState.PLAYING, to: PlayerState.BUFFERING, action: 'stall' },
    { from: PlayerState.PLAYING, to: PlayerState.ENDED, action: 'end' },
    { from: PlayerState.PLAYING, to: PlayerState.ERROR, action: 'error' },
    { from: PlayerState.PLAYING, to: PlayerState.IDLE, action: 'reset' },

    // From PAUSED
    { from: PlayerState.PAUSED, to: PlayerState.PLAYING, action: 'play' },
    { from: PlayerState.PAUSED, to: PlayerState.BUFFERING, action: 'stall' },
    { from: PlayerState.PAUSED, to: PlayerState.IDLE, action: 'reset' },
    { from: PlayerState.PAUSED, to: PlayerState.ERROR, action: 'error' },

    // From BUFFERING
    { from: PlayerState.BUFFERING, to: PlayerState.PLAYING, action: 'resume' },
    { from: PlayerState.BUFFERING, to: PlayerState.PAUSED, action: 'pause' },
    { from: PlayerState.BUFFERING, to: PlayerState.ERROR, action: 'error' },
    { from: PlayerState.BUFFERING, to: PlayerState.IDLE, action: 'reset' },

    // From ENDED
    { from: PlayerState.ENDED, to: PlayerState.PLAYING, action: 'play' },
    { from: PlayerState.ENDED, to: PlayerState.IDLE, action: 'reset' },
    { from: PlayerState.ENDED, to: PlayerState.LOADING, action: 'load' },

    // From ERROR
    { from: PlayerState.ERROR, to: PlayerState.LOADING, action: 'retry' },
    { from: PlayerState.ERROR, to: PlayerState.IDLE, action: 'reset' },
];

/**
 * State machine events.
 */
interface StateMachineEvents {
    transition: {
        from: PlayerStateValue;
        to: PlayerStateValue;
        action: string | undefined;
    };
}

/**
 * Player state machine.
 * Manages state transitions and enforces valid state flow.
 */
export class PlayerStateMachine {
    private currentState: PlayerStateValue = PlayerState.IDLE;
    private readonly events = new EventEmitter<StateMachineEvents>();

    /**
     * Get current state.
     */
    getState(): PlayerStateValue {
        return this.currentState;
    }

    /**
     * Check if a transition to the target state is valid.
     *
     * @param to - Target state
     * @returns True if transition is valid
     */
    canTransitionTo(to: PlayerStateValue): boolean {
        return this.findTransition(this.currentState, to) !== undefined;
    }

    /**
     * Transition to a new state.
     *
     * @param to - Target state
     * @param action - Optional action that triggered the transition
     * @throws Error if transition is invalid
     */
    transitionTo(to: PlayerStateValue, action?: string): void {
        const from = this.currentState;

        if (from === to) {
            logger.debug(`Ignoring no-op transition: ${from} -> ${to}`);
            return;
        }

        const transition = this.findTransition(from, to);

        if (transition === undefined) {
            const msg = `Invalid state transition: ${from} -> ${to}`;
            logger.error(msg);
            throw new Error(msg);
        }

        logger.debug(`State transition: ${from} -> ${to} (action: ${action ?? transition.action ?? 'unknown'})`);

        this.currentState = to;

        this.events.emit('transition', {
            from,
            to,
            action: action ?? transition.action,
        });
    }

    /**
     * Force transition to a state, bypassing validation.
     * Use only for error recovery scenarios.
     *
     * @param to - Target state
     */
    forceTransition(to: PlayerStateValue): void {
        const from = this.currentState;
        logger.warn(`Force transition: ${from} -> ${to}`);
        this.currentState = to;
        this.events.emit('transition', { from, to, action: 'force' });
    }

    /**
     * Reset to IDLE state.
     */
    reset(): void {
        if (this.currentState === PlayerState.IDLE) {
            return;
        }

        // IDLE is always a valid target from any state
        this.forceTransition(PlayerState.IDLE);
    }

    /**
     * Check if player is in a playable state.
     */
    isPlayable(): boolean {
        return (
            this.currentState === PlayerState.READY ||
            this.currentState === PlayerState.PAUSED ||
            this.currentState === PlayerState.ENDED
        );
    }

    /**
     * Check if player is actively playing.
     */
    isPlaying(): boolean {
        return this.currentState === PlayerState.PLAYING;
    }

    /**
     * Check if player is in an error state.
     */
    isError(): boolean {
        return this.currentState === PlayerState.ERROR;
    }

    /**
     * Check if player is loading.
     */
    isLoading(): boolean {
        return this.currentState === PlayerState.LOADING;
    }

    /**
     * Subscribe to state transitions.
     *
     * @param handler - Transition handler
     * @returns Unsubscribe function
     */
    onTransition(
        handler: (event: StateMachineEvents['transition']) => void
    ): () => void {
        return this.events.on('transition', handler);
    }

    /**
     * Assert that the current state matches expected.
     *
     * @param expected - Expected state(s)
     * @param message - Error message if assertion fails
     */
    assertState(expected: PlayerStateValue | readonly PlayerStateValue[], message?: string): void {
        const expectedStates = Array.isArray(expected) ? expected : [expected];
        const current = this.currentState;

        assert(
            expectedStates.includes(current),
            message ?? `Expected state ${expectedStates.join(' or ')}, got ${current}`
        );
    }

    private findTransition(
        from: PlayerStateValue,
        to: PlayerStateValue
    ): StateTransition | undefined {
        return VALID_TRANSITIONS.find((t) => {
            const fromStates = Array.isArray(t.from) ? t.from : [t.from];
            return fromStates.includes(from) && t.to === to;
        });
    }
}
