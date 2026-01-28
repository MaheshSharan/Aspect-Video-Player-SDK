import type { Unsubscribe } from './types';

/**
 * Handler function for events.
 */
export type EventHandler<T = unknown> = (payload: T) => void;

/**
 * Internal subscription entry.
 */
interface Subscription<T> {
    handler: EventHandler<T>;
    once: boolean;
}

/**
 * Type-safe event emitter with support for typed event maps.
 *
 * @example
 * ```typescript
 * interface Events {
 *   play: void;
 *   timeupdate: { currentTime: number };
 *   error: { code: string; message: string };
 * }
 *
 * const emitter = new EventEmitter<Events>();
 * emitter.on('timeupdate', ({ currentTime }) => console.log(currentTime));
 * emitter.emit('timeupdate', { currentTime: 10 });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventEmitter<TEventMap extends Record<string, any>> {
    private readonly subscriptions = new Map<
        keyof TEventMap,
        Set<Subscription<TEventMap[keyof TEventMap]>>
    >();

    /**
     * Subscribe to an event.
     *
     * @param event - Event name to subscribe to
     * @param handler - Handler function to call when event is emitted
     * @returns Unsubscribe function
     */
    on<E extends keyof TEventMap>(event: E, handler: EventHandler<TEventMap[E]>): Unsubscribe {
        return this.addSubscription(event, handler, false);
    }

    /**
     * Subscribe to an event for a single emission only.
     *
     * @param event - Event name to subscribe to
     * @param handler - Handler function to call when event is emitted
     * @returns Unsubscribe function
     */
    once<E extends keyof TEventMap>(event: E, handler: EventHandler<TEventMap[E]>): Unsubscribe {
        return this.addSubscription(event, handler, true);
    }

    /**
     * Unsubscribe a handler from an event.
     *
     * @param event - Event name to unsubscribe from
     * @param handler - Handler function to remove
     */
    off<E extends keyof TEventMap>(event: E, handler: EventHandler<TEventMap[E]>): void {
        const subs = this.subscriptions.get(event);
        if (subs === undefined) return;

        for (const sub of subs) {
            if (sub.handler === handler) {
                subs.delete(sub);
                break;
            }
        }

        if (subs.size === 0) {
            this.subscriptions.delete(event);
        }
    }

    /**
     * Emit an event to all subscribers.
     *
     * @param event - Event name to emit
     * @param payload - Event payload
     */
    emit<E extends keyof TEventMap>(event: E, payload: TEventMap[E]): void {
        const subs = this.subscriptions.get(event);
        if (subs === undefined) return;

        // Copy set to allow modifications during iteration
        const subscriptionsCopy = Array.from(subs);

        for (const sub of subscriptionsCopy) {
            try {
                sub.handler(payload);
            } catch (error) {
                // Log but don't break emission chain
                console.error(`[EventEmitter] Handler threw for event "${String(event)}":`, error);
            }

            if (sub.once) {
                subs.delete(sub);
            }
        }

        if (subs.size === 0) {
            this.subscriptions.delete(event);
        }
    }

    /**
     * Remove all subscriptions for an event, or all events if not specified.
     *
     * @param event - Optional event name to clear
     */
    removeAllListeners<E extends keyof TEventMap>(event?: E): void {
        if (event !== undefined) {
            this.subscriptions.delete(event);
        } else {
            this.subscriptions.clear();
        }
    }

    /**
     * Get the number of listeners for an event.
     *
     * @param event - Event name
     * @returns Number of listeners
     */
    listenerCount<E extends keyof TEventMap>(event: E): number {
        const subs = this.subscriptions.get(event);
        return subs?.size ?? 0;
    }

    /**
     * Check if there are any listeners for an event.
     *
     * @param event - Event name
     * @returns True if there are listeners
     */
    hasListeners<E extends keyof TEventMap>(event: E): boolean {
        return this.listenerCount(event) > 0;
    }

    private addSubscription<E extends keyof TEventMap>(
        event: E,
        handler: EventHandler<TEventMap[E]>,
        once: boolean
    ): Unsubscribe {
        let subs = this.subscriptions.get(event);
        if (subs === undefined) {
            subs = new Set();
            this.subscriptions.set(event, subs);
        }

        const subscription: Subscription<TEventMap[E]> = { handler, once };
        subs.add(subscription as Subscription<TEventMap[keyof TEventMap]>);

        return () => {
            subs?.delete(subscription as Subscription<TEventMap[keyof TEventMap]>);
            if (subs?.size === 0) {
                this.subscriptions.delete(event);
            }
        };
    }
}

/**
 * Create a deferred promise that can be resolved or rejected externally.
 */
export interface Deferred<T> {
    readonly promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
}

/**
 * Create a deferred promise.
 */
export function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}
