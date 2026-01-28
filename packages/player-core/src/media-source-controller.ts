import {
    EventEmitter,
    createLogger,
    createPlayerError,
    ErrorCode,
    type PlayerError,
    type Unsubscribe,
    createDeferred,
    type Deferred,
} from '@aspect/shared';

const logger = createLogger('mediasource-controller');

/**
 * MediaSource controller events.
 */
export interface MediaSourceControllerEvents {
    sourceopen: void;
    sourceended: void;
    sourceclosed: void;
    error: PlayerError;
}

/**
 * SourceBuffer configuration.
 */
export interface SourceBufferConfig {
    mimeType: string;
    codec: string;
}

/**
 * Segment to append to a SourceBuffer.
 */
export interface SegmentData {
    type: 'video' | 'audio';
    data: ArrayBuffer;
    timestampOffset?: number;
}

/**
 * Append operation in the queue.
 */
interface AppendOperation {
    type: 'video' | 'audio';
    data: ArrayBuffer;
    timestampOffset: number | undefined;
    deferred: Deferred<void>;
}

/**
 * Remove operation in the queue.
 */
interface RemoveOperation {
    type: 'video' | 'audio';
    start: number;
    end: number;
    deferred: Deferred<void>;
}

type BufferOperation =
    | { kind: 'append'; operation: AppendOperation }
    | { kind: 'remove'; operation: RemoveOperation };

/**
 * MediaSource controller manages the MediaSource and SourceBuffers.
 * Handles append queue, backpressure, and error recovery.
 */
export class MediaSourceController {
    private mediaSource: MediaSource | null = null;
    private objectURL: string | null = null;
    private videoBuffer: SourceBuffer | null = null;
    private audioBuffer: SourceBuffer | null = null;

    private readonly events = new EventEmitter<MediaSourceControllerEvents>();
    private readonly operationQueue: BufferOperation[] = [];
    private isProcessingQueue = false;
    private destroyed = false;

    private sourceOpenDeferred: Deferred<void> | null = null;

    /**
     * Create and attach MediaSource to video element.
     *
     * @param video - Video element to attach to
     * @returns Promise that resolves when MediaSource is open
     */
    async attach(video: HTMLVideoElement): Promise<void> {
        this.assertNotDestroyed();

        if (typeof MediaSource === 'undefined') {
            throw createPlayerError(
                ErrorCode.MSE_NOT_SUPPORTED,
                'MediaSource Extensions not supported'
            );
        }

        logger.debug('Creating MediaSource');

        this.mediaSource = new MediaSource();
        this.sourceOpenDeferred = createDeferred<void>();

        this.mediaSource.addEventListener('sourceopen', this.handleSourceOpen);
        this.mediaSource.addEventListener('sourceended', this.handleSourceEnded);
        this.mediaSource.addEventListener('sourceclose', this.handleSourceClose);

        this.objectURL = URL.createObjectURL(this.mediaSource);
        video.src = this.objectURL;

        await this.sourceOpenDeferred.promise;
        logger.debug('MediaSource opened');
    }

    /**
     * Add a SourceBuffer for video or audio.
     *
     * @param type - Buffer type
     * @param config - SourceBuffer configuration
     */
    addSourceBuffer(type: 'video' | 'audio', config: SourceBufferConfig): void {
        this.assertNotDestroyed();
        this.assertSourceOpen();

        const mimeType = `${config.mimeType}; codecs="${config.codec}"`;
        logger.debug(`Adding SourceBuffer: ${type} - ${mimeType}`);

        if (!MediaSource.isTypeSupported(mimeType)) {
            throw createPlayerError(
                ErrorCode.CODEC_NOT_SUPPORTED,
                `Codec not supported: ${mimeType}`
            );
        }

        try {
            const buffer = this.mediaSource!.addSourceBuffer(mimeType);

            // Use segments mode for better control
            if ('mode' in buffer) {
                buffer.mode = 'segments';
            }

            buffer.addEventListener('error', () => this.handleBufferError(type));
            buffer.addEventListener('updateend', () => this.processQueue());

            if (type === 'video') {
                this.videoBuffer = buffer;
            } else {
                this.audioBuffer = buffer;
            }
        } catch (error) {
            throw createPlayerError(
                ErrorCode.MSE_SOURCE_BUFFER_ERROR,
                `Failed to add SourceBuffer: ${String(error)}`,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Append segment data to a SourceBuffer.
     * Queues the operation if buffer is updating.
     *
     * @param segment - Segment data to append
     * @returns Promise that resolves when append completes
     */
    async appendBuffer(segment: SegmentData): Promise<void> {
        this.assertNotDestroyed();
        this.assertSourceOpen();

        const buffer = this.getBuffer(segment.type);
        if (buffer === null) {
            throw createPlayerError(
                ErrorCode.MSE_SOURCE_BUFFER_ERROR,
                `No SourceBuffer for type: ${segment.type}`
            );
        }

        const deferred = createDeferred<void>();

        this.operationQueue.push({
            kind: 'append',
            operation: {
                type: segment.type,
                data: segment.data,
                timestampOffset: segment.timestampOffset,
                deferred,
            },
        });

        this.processQueue();
        return deferred.promise;
    }

    /**
     * Remove data from a SourceBuffer.
     *
     * @param type - Buffer type
     * @param start - Start time in seconds
     * @param end - End time in seconds
     * @returns Promise that resolves when remove completes
     */
    async removeBuffer(type: 'video' | 'audio', start: number, end: number): Promise<void> {
        this.assertNotDestroyed();

        const buffer = this.getBuffer(type);
        if (buffer === null) {
            return;
        }

        const deferred = createDeferred<void>();

        this.operationQueue.push({
            kind: 'remove',
            operation: {
                type,
                start,
                end,
                deferred,
            },
        });

        this.processQueue();
        return deferred.promise;
    }

    /**
     * Set the duration of the MediaSource.
     *
     * @param duration - Duration in seconds
     */
    setDuration(duration: number): void {
        this.assertNotDestroyed();
        this.assertSourceOpen();

        if (this.isAnyBufferUpdating()) {
            logger.warn('Cannot set duration while buffer is updating');
            return;
        }

        try {
            this.mediaSource!.duration = duration;
        } catch (error) {
            logger.error('Failed to set duration:', error);
        }
    }

    /**
     * Signal end of stream.
     *
     * @param error - Optional error to signal
     */
    endOfStream(error?: 'network' | 'decode'): void {
        this.assertNotDestroyed();

        if (this.mediaSource?.readyState !== 'open') {
            return;
        }

        if (this.isAnyBufferUpdating()) {
            logger.warn('Cannot end stream while buffer is updating');
            return;
        }

        try {
            if (error !== undefined) {
                this.mediaSource.endOfStream(error);
            } else {
                this.mediaSource.endOfStream();
            }
        } catch (e) {
            logger.error('Failed to end stream:', e);
        }
    }

    /**
     * Get buffered time ranges for a buffer type.
     *
     * @param type - Buffer type
     * @returns TimeRanges or null
     */
    getBuffered(type: 'video' | 'audio'): TimeRanges | null {
        const buffer = this.getBuffer(type);
        return buffer?.buffered ?? null;
    }

    /**
     * Check if MediaSource is open.
     */
    isOpen(): boolean {
        return this.mediaSource?.readyState === 'open';
    }

    /**
     * Subscribe to controller events.
     */
    on<E extends keyof MediaSourceControllerEvents>(
        event: E,
        handler: (payload: MediaSourceControllerEvents[E]) => void
    ): Unsubscribe {
        return this.events.on(event, handler);
    }

    /**
     * Destroy the controller and release resources.
     */
    destroy(): void {
        if (this.destroyed) {
            return;
        }

        logger.debug('Destroying MediaSourceController');
        this.destroyed = true;

        // Abort any pending operations
        if (this.videoBuffer !== null && !this.videoBuffer.updating) {
            try {
                this.videoBuffer.abort();
            } catch {
                // Ignore abort errors
            }
        }

        if (this.audioBuffer !== null && !this.audioBuffer.updating) {
            try {
                this.audioBuffer.abort();
            } catch {
                // Ignore abort errors
            }
        }

        // Clear queue
        for (const op of this.operationQueue) {
            if (op.kind === 'append') {
                op.operation.deferred.reject(new Error('Controller destroyed'));
            } else {
                op.operation.deferred.reject(new Error('Controller destroyed'));
            }
        }
        this.operationQueue.length = 0;

        // Cleanup MediaSource
        if (this.mediaSource !== null) {
            this.mediaSource.removeEventListener('sourceopen', this.handleSourceOpen);
            this.mediaSource.removeEventListener('sourceended', this.handleSourceEnded);
            this.mediaSource.removeEventListener('sourceclose', this.handleSourceClose);

            if (this.mediaSource.readyState === 'open') {
                try {
                    this.mediaSource.endOfStream();
                } catch {
                    // Ignore
                }
            }
        }

        // Revoke object URL
        if (this.objectURL !== null) {
            URL.revokeObjectURL(this.objectURL);
            this.objectURL = null;
        }

        this.videoBuffer = null;
        this.audioBuffer = null;
        this.mediaSource = null;

        this.events.removeAllListeners();
    }

    private getBuffer(type: 'video' | 'audio'): SourceBuffer | null {
        return type === 'video' ? this.videoBuffer : this.audioBuffer;
    }

    private isAnyBufferUpdating(): boolean {
        return (
            (this.videoBuffer?.updating ?? false) ||
            (this.audioBuffer?.updating ?? false)
        );
    }

    private processQueue(): void {
        if (this.isProcessingQueue || this.destroyed) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.operationQueue.length > 0) {
            const op = this.operationQueue[0];

            if (op === undefined) {
                break;
            }

            const buffer = this.getBuffer(
                op.kind === 'append' ? op.operation.type : op.operation.type
            );

            if (buffer === null || buffer.updating) {
                break;
            }

            this.operationQueue.shift();

            try {
                if (op.kind === 'append') {
                    this.executeAppend(buffer, op.operation);
                } else {
                    this.executeRemove(buffer, op.operation);
                }
            } catch (error) {
                if (op.kind === 'append') {
                    op.operation.deferred.reject(error);
                } else {
                    op.operation.deferred.reject(error);
                }
            }

            // Only process one operation at a time
            break;
        }

        this.isProcessingQueue = false;
    }

    private executeAppend(buffer: SourceBuffer, operation: AppendOperation): void {
        try {
            if (operation.timestampOffset !== undefined) {
                buffer.timestampOffset = operation.timestampOffset;
            }

            buffer.appendBuffer(operation.data);

            // Listen for completion
            const onUpdateEnd = (): void => {
                buffer.removeEventListener('updateend', onUpdateEnd);
                buffer.removeEventListener('error', onError);
                operation.deferred.resolve();
                this.processQueue();
            };

            const onError = (): void => {
                buffer.removeEventListener('updateend', onUpdateEnd);
                buffer.removeEventListener('error', onError);
                operation.deferred.reject(
                    createPlayerError(ErrorCode.MSE_APPEND_ERROR, 'SourceBuffer append failed')
                );
                this.processQueue();
            };

            buffer.addEventListener('updateend', onUpdateEnd);
            buffer.addEventListener('error', onError);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                operation.deferred.reject(
                    createPlayerError(ErrorCode.MSE_QUOTA_EXCEEDED, 'Buffer quota exceeded')
                );
            } else {
                operation.deferred.reject(
                    createPlayerError(
                        ErrorCode.MSE_APPEND_ERROR,
                        `Append failed: ${String(error)}`,
                        error instanceof Error ? error : undefined
                    )
                );
            }
        }
    }

    private executeRemove(buffer: SourceBuffer, operation: RemoveOperation): void {
        try {
            buffer.remove(operation.start, operation.end);

            const onUpdateEnd = (): void => {
                buffer.removeEventListener('updateend', onUpdateEnd);
                operation.deferred.resolve();
                this.processQueue();
            };

            buffer.addEventListener('updateend', onUpdateEnd);
        } catch (error) {
            operation.deferred.reject(
                createPlayerError(
                    ErrorCode.MSE_REMOVE_ERROR,
                    `Remove failed: ${String(error)}`,
                    error instanceof Error ? error : undefined
                )
            );
        }
    }

    private handleSourceOpen = (): void => {
        logger.debug('sourceopen event');
        this.events.emit('sourceopen', undefined);
        this.sourceOpenDeferred?.resolve();
    };

    private handleSourceEnded = (): void => {
        logger.debug('sourceended event');
        this.events.emit('sourceended', undefined);
    };

    private handleSourceClose = (): void => {
        logger.debug('sourceclose event');
        this.events.emit('sourceclosed', undefined);
    };

    private handleBufferError(type: 'video' | 'audio'): void {
        logger.error(`SourceBuffer error: ${type}`);
        this.events.emit(
            'error',
            createPlayerError(
                ErrorCode.MSE_SOURCE_BUFFER_ERROR,
                `SourceBuffer error for ${type}`
            )
        );
    }

    private assertNotDestroyed(): void {
        if (this.destroyed) {
            throw new Error('MediaSourceController has been destroyed');
        }
    }

    private assertSourceOpen(): void {
        if (this.mediaSource?.readyState !== 'open') {
            throw createPlayerError(
                ErrorCode.MSE_SOURCE_BUFFER_ERROR,
                `MediaSource is not open (state: ${this.mediaSource?.readyState ?? 'null'})`
            );
        }
    }
}
