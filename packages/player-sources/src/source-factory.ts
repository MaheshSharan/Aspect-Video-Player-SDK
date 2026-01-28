import {
    MediaSourceType,
    type MediaSourceTypeValue,
    type MediaSourceConfig,
    detectPlatform,
    createLogger,
} from '@aspect/shared';
import type { SourceAdapter, SourceAdapterConfig } from './types';
import { HLSAdapter, type HLSAdapterConfig } from './hls-adapter';
import { HLSNativeAdapter } from './hls-native-adapter';
import { DASHAdapter, type DASHAdapterConfig } from './dash-adapter';
import { MP4Adapter } from './mp4-adapter';

const logger = createLogger('source-factory');

/**
 * Source factory configuration.
 */
export interface SourceFactoryConfig extends SourceAdapterConfig {
    /** Force native HLS on supported platforms */
    preferNativeHLS?: boolean;
    /** HLS-specific configuration */
    hls?: HLSAdapterConfig;
    /** DASH-specific configuration */
    dash?: DASHAdapterConfig;
}

/**
 * Detect media source type from URL.
 *
 * @param url - Media source URL
 * @returns Detected media type or undefined
 */
export function detectSourceType(url: string): MediaSourceTypeValue | undefined {
    const lowercaseUrl = url.toLowerCase();
    const urlWithoutQuery = lowercaseUrl.split('?')[0] ?? '';

    // HLS detection
    if (
        urlWithoutQuery.endsWith('.m3u8') ||
        urlWithoutQuery.includes('.m3u8/') ||
        lowercaseUrl.includes('format=m3u8') ||
        lowercaseUrl.includes('format=hls')
    ) {
        return MediaSourceType.HLS;
    }

    // DASH detection
    if (
        urlWithoutQuery.endsWith('.mpd') ||
        urlWithoutQuery.includes('.mpd/') ||
        lowercaseUrl.includes('format=mpd') ||
        lowercaseUrl.includes('format=dash')
    ) {
        return MediaSourceType.DASH;
    }

    // MP4 detection
    if (
        urlWithoutQuery.endsWith('.mp4') ||
        urlWithoutQuery.endsWith('.m4v') ||
        urlWithoutQuery.endsWith('.webm') ||
        urlWithoutQuery.endsWith('.mov')
    ) {
        return MediaSourceType.MP4;
    }

    return undefined;
}

/**
 * Check if the current platform should use native HLS.
 */
export function shouldUseNativeHLS(): boolean {
    const platform = detectPlatform();

    // iOS always uses native HLS (MSE not supported)
    if (platform.os === 'ios') {
        return true;
    }

    // Safari prefers native HLS
    if (platform.browser === 'safari') {
        return true;
    }

    return false;
}

/**
 * Create a source adapter for the given configuration.
 *
 * @param config - Media source configuration
 * @param factoryConfig - Factory configuration
 * @returns Source adapter or null if no suitable adapter
 */
export function createSourceAdapter(
    config: MediaSourceConfig,
    factoryConfig: SourceFactoryConfig = {}
): SourceAdapter | null {
    // Determine source type
    const sourceType = config.type ?? detectSourceType(config.url);

    if (sourceType === undefined) {
        logger.warn(`Could not determine source type for URL: ${config.url}`);
        return null;
    }

    logger.info(`Creating adapter for source type: ${sourceType}`);

    switch (sourceType) {
        case MediaSourceType.HLS:
            return createHLSAdapter(factoryConfig);

        case MediaSourceType.DASH:
            return createDASHAdapter(factoryConfig);

        case MediaSourceType.MP4:
            return createMP4Adapter(factoryConfig);

        default:
            logger.warn(`Unsupported source type: ${sourceType}`);
            return null;
    }
}

/**
 * Create an HLS adapter based on platform.
 */
function createHLSAdapter(config: SourceFactoryConfig): SourceAdapter | null {
    const useNative = config.preferNativeHLS ?? shouldUseNativeHLS();

    if (useNative && HLSNativeAdapter.isSupported()) {
        logger.debug('Using native HLS adapter');
        return new HLSNativeAdapter(config);
    }

    if (HLSAdapter.isSupported()) {
        logger.debug('Using hls.js adapter');
        return new HLSAdapter({
            ...config,
            ...config.hls,
        });
    }

    // Fallback to native if available
    if (HLSNativeAdapter.isSupported()) {
        logger.debug('Falling back to native HLS adapter');
        return new HLSNativeAdapter(config);
    }

    logger.error('No HLS adapter available');
    return null;
}

/**
 * Create a DASH adapter.
 */
function createDASHAdapter(config: SourceFactoryConfig): SourceAdapter | null {
    if (DASHAdapter.isSupported()) {
        logger.debug('Using dash.js adapter');
        return new DASHAdapter({
            ...config,
            ...config.dash,
        });
    }

    logger.error('DASH playback not supported');
    return null;
}

/**
 * Create an MP4 adapter.
 */
function createMP4Adapter(config: SourceFactoryConfig): SourceAdapter | null {
    if (MP4Adapter.isSupported()) {
        logger.debug('Using MP4 adapter');
        return new MP4Adapter(config);
    }

    logger.error('MP4 playback not supported');
    return null;
}

/**
 * Get supported source types for the current platform.
 */
export function getSupportedSourceTypes(): MediaSourceTypeValue[] {
    const supported: MediaSourceTypeValue[] = [];

    if (HLSAdapter.isSupported() || HLSNativeAdapter.isSupported()) {
        supported.push(MediaSourceType.HLS);
    }

    if (DASHAdapter.isSupported()) {
        supported.push(MediaSourceType.DASH);
    }

    if (MP4Adapter.isSupported()) {
        supported.push(MediaSourceType.MP4);
    }

    return supported;
}

/**
 * Check if a specific source type is supported.
 */
export function isSourceTypeSupported(type: MediaSourceTypeValue): boolean {
    switch (type) {
        case MediaSourceType.HLS:
            return HLSAdapter.isSupported() || HLSNativeAdapter.isSupported();
        case MediaSourceType.DASH:
            return DASHAdapter.isSupported();
        case MediaSourceType.MP4:
            return MP4Adapter.isSupported();
        default:
            return false;
    }
}
