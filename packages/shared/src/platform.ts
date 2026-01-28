import type { PlatformInfo } from './types';

/**
 * Cached platform info to avoid repeated detection.
 */
let cachedPlatformInfo: PlatformInfo | null = null;

/**
 * User agent string (may not exist in non-browser environments).
 */
function getUserAgent(): string {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
        return navigator.userAgent;
    }
    return '';
}

/**
 * Detect browser family from user agent.
 */
function detectBrowser(ua: string): { browser: PlatformInfo['browser']; version: string } {
    // Order matters: Edge contains Chrome, Chrome contains Safari
    if (/Edg\/(\d+[\d.]*)/.test(ua)) {
        const match = ua.match(/Edg\/(\d+[\d.]*)/);
        return { browser: 'edge', version: match?.[1] ?? '' };
    }

    if (/Chrome\/(\d+[\d.]*)/.test(ua) && !/Chromium/.test(ua)) {
        const match = ua.match(/Chrome\/(\d+[\d.]*)/);
        return { browser: 'chrome', version: match?.[1] ?? '' };
    }

    if (/Firefox\/(\d+[\d.]*)/.test(ua)) {
        const match = ua.match(/Firefox\/(\d+[\d.]*)/);
        return { browser: 'firefox', version: match?.[1] ?? '' };
    }

    // Safari detection: must not contain Chrome or Chromium
    if (/Safari\/(\d+[\d.]*)/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua)) {
        // Version is in "Version/X.Y" for Safari
        const versionMatch = ua.match(/Version\/(\d+[\d.]*)/);
        return { browser: 'safari', version: versionMatch?.[1] ?? '' };
    }

    return { browser: 'unknown', version: '' };
}

/**
 * Detect operating system from user agent.
 */
function detectOS(ua: string): PlatformInfo['os'] {
    // iOS detection must come before macOS (iPad with desktop mode has Mac in UA)
    if (/iPhone|iPad|iPod/.test(ua)) {
        return 'ios';
    }

    // iPadOS 13+ reports as Mac, check for touch support
    if (/Mac/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) {
        return 'ios';
    }

    if (/Android/.test(ua)) {
        return 'android';
    }

    if (/Win/.test(ua)) {
        return 'windows';
    }

    if (/Mac/.test(ua)) {
        return 'macos';
    }

    if (/Linux/.test(ua)) {
        return 'linux';
    }

    return 'unknown';
}

/**
 * Detect if device is mobile.
 */
function detectMobile(ua: string, os: PlatformInfo['os']): boolean {
    if (os === 'ios' || os === 'android') {
        // Tablets are not "mobile" for our purposes (buffer limits)
        return !/iPad|Tablet/.test(ua);
    }
    return false;
}

/**
 * Detect if device is tablet.
 */
function detectTablet(ua: string, os: PlatformInfo['os']): boolean {
    if (/iPad/.test(ua)) {
        return true;
    }

    if (os === 'android' && /Tablet/.test(ua)) {
        return true;
    }

    // iPadOS 13+ with desktop user agent
    if (os === 'ios' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) {
        return true;
    }

    return false;
}

/**
 * Check if MediaSource Extensions are supported.
 */
function detectMSESupport(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return (
        typeof MediaSource !== 'undefined' &&
        typeof MediaSource.isTypeSupported === 'function'
    );
}

/**
 * Check if native HLS is supported (Safari, iOS).
 */
function detectNativeHLSSupport(): boolean {
    if (typeof document === 'undefined') {
        return false;
    }

    const video = document.createElement('video');
    return (
        video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
        video.canPlayType('application/x-mpegURL') !== ''
    );
}

/**
 * Check if Picture-in-Picture is supported.
 */
function detectPiPSupport(): boolean {
    if (typeof document === 'undefined') {
        return false;
    }

    // Standard PiP API
    const hasStandardPiP = 'pictureInPictureEnabled' in document;
    if (hasStandardPiP) {
        return (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled === true;
    }

    // WebKit PiP (older Safari)
    const video = (document as Document).createElement('video');
    return typeof (video as HTMLVideoElement & { webkitSupportsPresentationMode?: unknown }).webkitSupportsPresentationMode === 'function';
}

/**
 * Check if Fullscreen API is supported.
 */
function detectFullscreenSupport(): boolean {
    if (typeof document === 'undefined') {
        return false;
    }

    return (
        'fullscreenEnabled' in document ||
        'webkitFullscreenEnabled' in document ||
        'mozFullScreenEnabled' in document ||
        'msFullscreenEnabled' in document
    );
}

/**
 * Check if AirPlay is supported (Safari only).
 */
function detectAirPlaySupport(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    return 'WebKitPlaybackTargetAvailabilityEvent' in window;
}

/**
 * Detect platform capabilities.
 * Results are cached after first call.
 *
 * @returns Platform information
 */
export function detectPlatform(): PlatformInfo {
    if (cachedPlatformInfo !== null) {
        return cachedPlatformInfo;
    }

    const ua = getUserAgent();
    const { browser, version } = detectBrowser(ua);
    const os = detectOS(ua);

    cachedPlatformInfo = {
        browser,
        browserVersion: version,
        os,
        isMobile: detectMobile(ua, os),
        isTablet: detectTablet(ua, os),
        supportsMSE: detectMSESupport(),
        supportsNativeHLS: detectNativeHLSSupport(),
        supportsPiP: detectPiPSupport(),
        supportsFullscreen: detectFullscreenSupport(),
        supportsAirPlay: detectAirPlaySupport(),
    };

    return cachedPlatformInfo;
}

/**
 * Reset cached platform info (useful for testing).
 */
export function resetPlatformCache(): void {
    cachedPlatformInfo = null;
}

/**
 * Check if a specific codec is supported for MSE.
 *
 * @param mimeType - Full MIME type with codec (e.g., 'video/mp4; codecs="avc1.42E01E"')
 * @returns True if codec is supported
 */
export function isCodecSupported(mimeType: string): boolean {
    if (typeof MediaSource === 'undefined') {
        return false;
    }

    return MediaSource.isTypeSupported(mimeType);
}

/**
 * Common codec strings for checking support.
 */
export const CommonCodecs = {
    /** H.264 Baseline Profile Level 3.0 */
    H264_BASELINE: 'video/mp4; codecs="avc1.42E01E"',
    /** H.264 Main Profile Level 3.1 */
    H264_MAIN: 'video/mp4; codecs="avc1.4D401F"',
    /** H.264 High Profile Level 4.0 */
    H264_HIGH: 'video/mp4; codecs="avc1.640028"',
    /** H.265/HEVC Main Profile */
    HEVC_MAIN: 'video/mp4; codecs="hev1.1.6.L93.B0"',
    /** VP9 Profile 0 */
    VP9_PROFILE0: 'video/webm; codecs="vp9"',
    /** VP9 Profile 2 (HDR) */
    VP9_PROFILE2: 'video/webm; codecs="vp09.02.10.10"',
    /** AV1 Main Profile */
    AV1_MAIN: 'video/mp4; codecs="av01.0.01M.08"',
    /** AAC Low Complexity */
    AAC_LC: 'audio/mp4; codecs="mp4a.40.2"',
    /** AAC High Efficiency v2 */
    AAC_HE_V2: 'audio/mp4; codecs="mp4a.40.29"',
    /** Opus */
    OPUS: 'audio/webm; codecs="opus"',
} as const;

/**
 * Get supported video codecs.
 *
 * @returns Object with codec names as keys and support status as values
 */
export function getSupportedVideoCodecs(): Record<string, boolean> {
    return {
        h264_baseline: isCodecSupported(CommonCodecs.H264_BASELINE),
        h264_main: isCodecSupported(CommonCodecs.H264_MAIN),
        h264_high: isCodecSupported(CommonCodecs.H264_HIGH),
        hevc: isCodecSupported(CommonCodecs.HEVC_MAIN),
        vp9: isCodecSupported(CommonCodecs.VP9_PROFILE0),
        vp9_hdr: isCodecSupported(CommonCodecs.VP9_PROFILE2),
        av1: isCodecSupported(CommonCodecs.AV1_MAIN),
    };
}

/**
 * Get supported audio codecs.
 *
 * @returns Object with codec names as keys and support status as values
 */
export function getSupportedAudioCodecs(): Record<string, boolean> {
    return {
        aac_lc: isCodecSupported(CommonCodecs.AAC_LC),
        aac_he_v2: isCodecSupported(CommonCodecs.AAC_HE_V2),
        opus: isCodecSupported(CommonCodecs.OPUS),
    };
}
