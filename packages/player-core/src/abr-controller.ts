import {
    EventEmitter,
    createLogger,
    detectPlatform,
    type QualityLevel,
    type Unsubscribe,
    ABRMode,
    type ABRModeValue,
    type ABRConfig,
    type ABRState,
    clamp,
} from '@aspect/shared';

const logger = createLogger('abr-controller');

/**
 * ABR controller events.
 */
export interface ABRControllerEvents {
    /** Quality level changed */
    qualitychange: { level: QualityLevel; auto: boolean };
    /** ABR state updated */
    stateupdate: ABRState;
    /** Bandwidth estimate updated */
    bandwidthupdate: { bandwidth: number };
}

/**
 * Segment timing data for bandwidth estimation.
 */
export interface SegmentTiming {
    /** Segment size in bytes */
    bytes: number;
    /** Download duration in milliseconds */
    durationMs: number;
    /** Segment duration in seconds */
    segmentDuration: number;
}

/**
 * Bandwidth sample for EWMA calculation.
 */
interface BandwidthSample {
    bandwidth: number;
    timestamp: number;
}

/**
 * Default ABR configuration.
 */
const DEFAULT_ABR_CONFIG: Required<ABRConfig> = {
    startLevel: 'lowest',
    bandwidthSafetyFactor: 0.8,
    upgradeBufferThreshold: 10,
    downgradeBufferThreshold: 5,
    mobileStabilityBias: true,
};

/**
 * ABR Controller implements adaptive bitrate selection.
 *
 * Key behaviors:
 * - Conservative startup (lowest quality)
 * - Fast ramp-up when buffer is healthy
 * - Slow degradation with hysteresis
 * - Mobile bias toward stability over resolution
 */
export class ABRController {
    private readonly config: Required<ABRConfig>;
    private readonly events = new EventEmitter<ABRControllerEvents>();
    private readonly isMobile: boolean;

    private levels: QualityLevel[] = [];
    private currentLevelIndex = 0;
    private mode: ABRModeValue = ABRMode.AUTO;
    private manualLevelIndex: number | null = null;

    // Bandwidth estimation
    private readonly bandwidthSamples: BandwidthSample[] = [];
    private estimatedBandwidth = 0;
    private readonly maxSamples = 10;
    private readonly fastEWMAFactor = 0.5;
    private readonly slowEWMAFactor = 0.1;
    private fastEWMA = 0;
    private slowEWMA = 0;

    // Playback metrics
    private segmentsLoaded = 0;
    private droppedFrames = 0;
    private lastDroppedFrameCheck = 0;
    private forwardBuffer = 0;

    // Stability tracking
    private lastUpgradeTime = 0;
    private lastDowngradeTime = 0;
    private switching = false;

    private destroyed = false;

    constructor(config: ABRConfig = {}) {
        const platform = detectPlatform();
        this.isMobile = platform.isMobile || platform.isTablet;

        // Apply more conservative settings on mobile
        const mobileOverrides = this.isMobile && (config.mobileStabilityBias ?? DEFAULT_ABR_CONFIG.mobileStabilityBias)
            ? { bandwidthSafetyFactor: 0.6, upgradeBufferThreshold: 15 }
            : {};

        this.config = {
            ...DEFAULT_ABR_CONFIG,
            ...config,
            ...mobileOverrides,
        };

        logger.info(`ABRController created (mobile: ${this.isMobile})`);
    }

    /**
     * Set available quality levels.
     */
    setLevels(levels: QualityLevel[]): void {
        this.levels = [...levels].sort((a, b) => a.bitrate - b.bitrate);
        logger.debug(`Quality levels set: ${this.levels.length} levels`);

        // Initialize to lowest quality for conservative startup
        if (this.levels.length > 0 && this.segmentsLoaded === 0) {
            this.currentLevelIndex = this.getStartLevelIndex();
        }
    }

    /**
     * Record a segment download for bandwidth estimation.
     */
    recordSegmentTiming(timing: SegmentTiming): void {
        if (this.destroyed) return;

        // Calculate bandwidth in bits per second
        const durationSec = timing.durationMs / 1000;
        if (durationSec <= 0) return;

        const bandwidth = (timing.bytes * 8) / durationSec;
        const now = Date.now();

        // Add to samples
        this.bandwidthSamples.push({ bandwidth, timestamp: now });

        // Keep only recent samples
        while (this.bandwidthSamples.length > this.maxSamples) {
            this.bandwidthSamples.shift();
        }

        // Update EWMA estimates
        if (this.fastEWMA === 0) {
            this.fastEWMA = bandwidth;
            this.slowEWMA = bandwidth;
        } else {
            this.fastEWMA = bandwidth * this.fastEWMAFactor + this.fastEWMA * (1 - this.fastEWMAFactor);
            this.slowEWMA = bandwidth * this.slowEWMAFactor + this.slowEWMA * (1 - this.slowEWMAFactor);
        }

        // Use the lower of fast and slow EWMA for safety
        this.estimatedBandwidth = Math.min(this.fastEWMA, this.slowEWMA);

        this.segmentsLoaded++;

        this.events.emit('bandwidthupdate', { bandwidth: this.estimatedBandwidth });
        logger.debug(`Bandwidth sample: ${(bandwidth / 1000000).toFixed(2)} Mbps, estimated: ${(this.estimatedBandwidth / 1000000).toFixed(2)} Mbps`);
    }

    /**
     * Update buffer state for ABR decisions.
     */
    updateBufferState(forwardBuffer: number): void {
        this.forwardBuffer = forwardBuffer;
    }

    /**
     * Update dropped frame count.
     */
    updateDroppedFrames(dropped: number): void {
        const now = Date.now();
        if (now - this.lastDroppedFrameCheck > 1000) {
            const newDropped = dropped - this.droppedFrames;
            if (newDropped > 10) {
                logger.warn(`High dropped frames: ${newDropped} in last second`);
                // Force quality drop on high dropped frames
                this.forceQualityDrop();
            }
            this.droppedFrames = dropped;
            this.lastDroppedFrameCheck = now;
        }
    }

    /**
     * Get next quality level based on current conditions.
     * This is the main ABR decision function.
     */
    getNextLevel(): QualityLevel | undefined {
        if (this.levels.length === 0) {
            return undefined;
        }

        // Manual mode override
        if (this.mode === ABRMode.MANUAL && this.manualLevelIndex !== null) {
            const level = this.levels[this.manualLevelIndex];
            return level;
        }

        const nextIndex = this.selectQualityIndex();

        if (nextIndex !== this.currentLevelIndex) {
            this.switching = true;
            const isUpgrade = nextIndex > this.currentLevelIndex;

            if (isUpgrade) {
                this.lastUpgradeTime = Date.now();
            } else {
                this.lastDowngradeTime = Date.now();
            }

            this.currentLevelIndex = nextIndex;
            const level = this.levels[nextIndex];

            if (level !== undefined) {
                logger.info(`Quality ${isUpgrade ? 'upgrade' : 'downgrade'}: ${level.label} (${(level.bitrate / 1000000).toFixed(2)} Mbps)`);
                this.events.emit('qualitychange', { level, auto: true });
            }

            this.switching = false;
        }

        return this.levels[this.currentLevelIndex];
    }

    /**
     * Lock to a specific quality level (manual mode).
     */
    setManualLevel(levelIndex: number): void {
        if (levelIndex < 0 || levelIndex >= this.levels.length) {
            logger.warn(`Invalid level index: ${levelIndex}`);
            return;
        }

        this.mode = ABRMode.MANUAL;
        this.manualLevelIndex = levelIndex;
        this.currentLevelIndex = levelIndex;

        const level = this.levels[levelIndex];
        if (level !== undefined) {
            logger.info(`Manual quality set: ${level.label}`);
            this.events.emit('qualitychange', { level, auto: false });
        }
    }

    /**
     * Enable auto quality selection.
     */
    setAutoLevel(): void {
        this.mode = ABRMode.AUTO;
        this.manualLevelIndex = null;
        logger.info('Auto quality enabled');
    }

    /**
     * Get current ABR state.
     */
    getState(): ABRState {
        return {
            mode: this.mode,
            currentLevel: this.levels[this.currentLevelIndex],
            levels: this.levels,
            estimatedBandwidth: this.estimatedBandwidth,
            switching: this.switching,
        };
    }

    /**
     * Subscribe to ABR controller events.
     */
    on<E extends keyof ABRControllerEvents>(
        event: E,
        handler: (payload: ABRControllerEvents[E]) => void
    ): Unsubscribe {
        return this.events.on(event, handler);
    }

    /**
     * Reset ABR state for new source.
     */
    reset(): void {
        this.levels = [];
        this.currentLevelIndex = 0;
        this.mode = ABRMode.AUTO;
        this.manualLevelIndex = null;
        this.bandwidthSamples.length = 0;
        this.estimatedBandwidth = 0;
        this.fastEWMA = 0;
        this.slowEWMA = 0;
        this.segmentsLoaded = 0;
        this.droppedFrames = 0;
        this.forwardBuffer = 0;
        this.lastUpgradeTime = 0;
        this.lastDowngradeTime = 0;
        this.switching = false;
    }

    /**
     * Destroy the ABR controller.
     */
    destroy(): void {
        if (this.destroyed) return;

        logger.debug('Destroying ABRController');
        this.destroyed = true;
        this.events.removeAllListeners();
    }

    /**
     * Core quality selection algorithm.
     */
    private selectQualityIndex(): number {
        // Conservative startup: stay on lowest for first 3 segments
        if (this.segmentsLoaded < 3) {
            return 0;
        }

        // Buffer critical: immediate drop to lowest
        if (this.forwardBuffer < this.config.downgradeBufferThreshold) {
            logger.debug(`Buffer critical (${this.forwardBuffer.toFixed(1)}s), dropping to lowest`);
            return 0;
        }

        // Calculate sustainable bitrate with safety factor
        const targetBitrate = this.estimatedBandwidth * this.config.bandwidthSafetyFactor;

        // Find highest sustainable quality
        let targetIndex = 0;
        for (let i = 0; i < this.levels.length; i++) {
            const level = this.levels[i];
            if (level !== undefined && level.bitrate <= targetBitrate) {
                targetIndex = i;
            }
        }

        // Apply hysteresis for upgrades
        if (targetIndex > this.currentLevelIndex) {
            // Require significant buffer for upgrade
            if (this.forwardBuffer < this.config.upgradeBufferThreshold) {
                return this.currentLevelIndex;
            }

            // Require significant improvement (30%) to upgrade
            const currentLevel = this.levels[this.currentLevelIndex];
            const targetLevel = this.levels[targetIndex];
            if (currentLevel !== undefined && targetLevel !== undefined) {
                const improvement = targetLevel.bitrate / currentLevel.bitrate;
                if (improvement < 1.3) {
                    return this.currentLevelIndex;
                }
            }

            // Rate-limit upgrades (minimum 10 seconds between upgrades)
            const now = Date.now();
            if (now - this.lastUpgradeTime < 10000) {
                return this.currentLevelIndex;
            }

            // On mobile, be even more conservative with upgrades
            if (this.isMobile && this.config.mobileStabilityBias) {
                // Only upgrade one level at a time on mobile
                return Math.min(targetIndex, this.currentLevelIndex + 1);
            }
        }

        // Apply hysteresis for downgrades (allow faster drops)
        if (targetIndex < this.currentLevelIndex) {
            // Rate-limit downgrades (minimum 5 seconds between downgrades)
            const now = Date.now();
            if (now - this.lastDowngradeTime < 5000) {
                return this.currentLevelIndex;
            }

            // On mobile, drop more aggressively
            if (this.isMobile && this.config.mobileStabilityBias) {
                return targetIndex;
            }

            // On desktop, allow one level drop at a time for smoother experience
            return Math.max(targetIndex, this.currentLevelIndex - 1);
        }

        return targetIndex;
    }

    private getStartLevelIndex(): number {
        const start = this.config.startLevel;

        if (start === 'lowest') {
            return 0;
        }
        if (start === 'highest') {
            return this.levels.length - 1;
        }
        if (start === 'auto') {
            // Start at a middle-low quality for quick start
            return Math.floor(this.levels.length / 4);
        }
        if (typeof start === 'number') {
            return clamp(start, 0, this.levels.length - 1);
        }

        return 0;
    }

    private forceQualityDrop(): void {
        if (this.currentLevelIndex > 0 && this.mode === ABRMode.AUTO) {
            const newIndex = Math.max(0, this.currentLevelIndex - 2);
            this.currentLevelIndex = newIndex;
            this.lastDowngradeTime = Date.now();

            const level = this.levels[newIndex];
            if (level !== undefined) {
                logger.warn(`Forced quality drop to ${level.label} due to dropped frames`);
                this.events.emit('qualitychange', { level, auto: true });
            }
        }
    }



}
