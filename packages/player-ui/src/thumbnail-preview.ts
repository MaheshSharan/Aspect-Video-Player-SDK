import type { PlayerUIConfig } from './types';

/**
 * Thumbnail cue parsed from VTT sprite sheet.
 */
export interface ThumbnailCue {
    startTime: number;
    endTime: number;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Thumbnail manager for parsing VTT sprite sheets and providing thumbnails.
 */
export class ThumbnailManager {
    private cues: ThumbnailCue[] = [];
    private loaded = false;
    private loading = false;
    private baseUrl = '';

    constructor(private readonly config: PlayerUIConfig) { }

    /**
     * Load and parse a VTT thumbnail track.
     */
    async load(vttUrl: string): Promise<void> {
        if (this.loading) return;
        this.loading = true;

        try {
            // Store base URL for relative sprite paths
            this.baseUrl = vttUrl.substring(0, vttUrl.lastIndexOf('/') + 1);

            const response = await fetch(vttUrl);
            if (!response.ok) {
                throw new Error(`Failed to load thumbnail VTT: ${response.status}`);
            }

            const text = await response.text();
            this.cues = this.parseVTT(text);
            this.loaded = true;
        } catch (error) {
            console.warn('Failed to load thumbnail track:', error);
            this.cues = [];
        } finally {
            this.loading = false;
        }
    }

    /**
     * Get thumbnail for a specific time.
     */
    getThumbnail(time: number): ThumbnailCue | null {
        if (!this.loaded || this.cues.length === 0) {
            return null;
        }

        // Binary search for the cue containing this time
        let left = 0;
        let right = this.cues.length - 1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const cue = this.cues[mid];

            if (cue === undefined) {
                break;
            }

            if (time >= cue.startTime && time < cue.endTime) {
                return cue;
            } else if (time < cue.startTime) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }

        return null;
    }

    /**
     * Check if thumbnails are available.
     */
    isAvailable(): boolean {
        return this.loaded && this.cues.length > 0;
    }

    /**
     * Parse VTT content into thumbnail cues.
     * Supports sprite sheet format: url.jpg#xywh=x,y,w,h
     */
    private parseVTT(content: string): ThumbnailCue[] {
        const cues: ThumbnailCue[] = [];
        const lines = content.split(/\r?\n/);

        let i = 0;

        // Skip WEBVTT header
        while (i < lines.length && !(lines[i]?.includes('-->'))) {
            i++;
        }

        while (i < lines.length) {
            const line = lines[i]?.trim() ?? '';

            // Look for timestamp line (00:00:00.000 --> 00:00:05.000)
            if (line.includes('-->')) {
                const parts = line.split('-->').map(s => s.trim());
                const startStr = parts[0] ?? '0:00';
                const endStr = parts[1] ?? '0:00';
                const startTime = this.parseTime(startStr);
                const endTime = this.parseTime(endStr);

                // Next line should be the URL
                i++;
                if (i < lines.length) {
                    const urlLine = lines[i]?.trim() ?? '';
                    if (urlLine) {
                        const cue = this.parseUrlLine(urlLine, startTime, endTime);
                        if (cue) {
                            cues.push(cue);
                        }
                    }
                }
            }
            i++;
        }

        return cues;
    }

    /**
     * Parse time string to seconds.
     */
    private parseTime(timeStr: string): number {
        const parts = timeStr.split(':');
        let seconds = 0;

        if (parts.length === 3) {
            // HH:MM:SS.mmm
            seconds = parseInt(parts[0] ?? '0', 10) * 3600 +
                parseInt(parts[1] ?? '0', 10) * 60 +
                parseFloat(parts[2] ?? '0');
        } else if (parts.length === 2) {
            // MM:SS.mmm
            seconds = parseInt(parts[0] ?? '0', 10) * 60 +
                parseFloat(parts[1] ?? '0');
        }

        return seconds;
    }

    /**
     * Parse URL line with optional sprite coordinates.
     * Format: image.jpg#xywh=0,0,160,90
     */
    private parseUrlLine(urlLine: string, startTime: number, endTime: number): ThumbnailCue | null {
        let url = urlLine;
        let x = 0, y = 0, width = 160, height = 90;

        // Check for sprite sheet coordinates
        const hashIndex = urlLine.indexOf('#xywh=');
        if (hashIndex !== -1) {
            url = urlLine.substring(0, hashIndex);
            const coords = urlLine.substring(hashIndex + 6).split(',');
            if (coords.length >= 4) {
                x = parseInt(coords[0] ?? '0', 10);
                y = parseInt(coords[1] ?? '0', 10);
                width = parseInt(coords[2] ?? '160', 10);
                height = parseInt(coords[3] ?? '90', 10);
            }
        }

        // Resolve relative URLs
        if (!url.startsWith('http') && !url.startsWith('/')) {
            url = this.baseUrl + url;
        }

        return { startTime, endTime, url, x, y, width, height };
    }

    /**
     * Cleanup resources.
     */
    destroy(): void {
        this.cues = [];
        this.loaded = false;
    }
}
