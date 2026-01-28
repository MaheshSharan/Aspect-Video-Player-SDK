import type { PlayerUIConfig } from './types';
import type { PlayerSnapshot } from '@aspect/player-core';

/**
 * Subtitle cue interface.
 */
export interface SubtitleCue {
    startTime: number;
    endTime: number;
    text: string;
}

/**
 * Subtitle track interface.
 */
export interface SubtitleTrack {
    id: string;
    label: string;
    language: string;
    url: string;
    default?: boolean;
}

/**
 * Subtitle manager for loading, parsing, and displaying subtitles.
 */
export class SubtitleManager {
    private cues: SubtitleCue[] = [];
    private tracks: SubtitleTrack[] = [];
    private activeTrackId: string | null = null;
    private overlay: HTMLDivElement | null = null;
    private currentCue: SubtitleCue | null = null;
    private enabled = false;

    constructor(private readonly config: PlayerUIConfig) { }

    /**
     * Set available subtitle tracks.
     */
    setTracks(tracks: SubtitleTrack[]): void {
        this.tracks = tracks;

        // Auto-select default track if available
        const defaultTrack = tracks.find(t => t.default);
        if (defaultTrack !== undefined) {
            void this.loadTrack(defaultTrack.id);
        }
    }

    /**
     * Get available subtitle tracks.
     */
    getTracks(): SubtitleTrack[] {
        return this.tracks;
    }

    /**
     * Get the active track ID.
     */
    getActiveTrackId(): string | null {
        return this.activeTrackId;
    }

    /**
     * Load and activate a subtitle track.
     */
    async loadTrack(trackId: string): Promise<void> {
        const track = this.tracks.find(t => t.id === trackId);
        if (track === undefined) {
            console.warn(`Subtitle track not found: ${trackId}`);
            return;
        }

        try {
            const response = await fetch(track.url);
            if (!response.ok) {
                throw new Error(`Failed to load subtitle: ${response.status}`);
            }

            const text = await response.text();
            this.cues = this.parseVTT(text);
            this.activeTrackId = trackId;
            this.enabled = true;
        } catch (error) {
            console.warn('Failed to load subtitle track:', error);
            this.cues = [];
        }
    }

    /**
     * Disable subtitles (keep track loaded but hide).
     */
    disable(): void {
        this.enabled = false;
        this.hideOverlay();
    }

    /**
     * Enable subtitles.
     */
    enable(): void {
        this.enabled = true;
    }

    /**
     * Toggle subtitles on/off.
     */
    toggle(): void {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.hideOverlay();
        }
    }

    /**
     * Check if subtitles are enabled.
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Create the subtitle overlay element.
     */
    createOverlay(container: HTMLElement): HTMLDivElement {
        const prefix = this.config.classPrefix ?? '';

        this.overlay = document.createElement('div');
        this.overlay.className = `${prefix}player-subtitles`;
        container.appendChild(this.overlay);

        return this.overlay;
    }

    /**
     * Update subtitle display based on current time.
     */
    update(snapshot: PlayerSnapshot): void {
        if (!this.enabled || this.overlay === null || this.cues.length === 0) {
            return;
        }

        const time = snapshot.currentTime;

        // Find cue for current time
        const cue = this.findCue(time);

        if (cue !== this.currentCue) {
            this.currentCue = cue;
            this.updateOverlay();
        }
    }

    /**
     * Hide the subtitle overlay.
     */
    private hideOverlay(): void {
        if (this.overlay !== null) {
            this.overlay.textContent = '';
            this.overlay.style.display = 'none';
        }
        this.currentCue = null;
    }

    /**
     * Update the overlay with current cue.
     */
    private updateOverlay(): void {
        if (this.overlay === null) return;

        if (this.currentCue !== null) {
            this.overlay.innerHTML = this.formatSubtitleText(this.currentCue.text);
            this.overlay.style.display = 'block';
        } else {
            this.overlay.textContent = '';
            this.overlay.style.display = 'none';
        }
    }

    /**
     * Format subtitle text, converting VTT formatting to HTML.
     */
    private formatSubtitleText(text: string): string {
        // Replace newlines with <br>
        let formatted = text.replace(/\n/g, '<br>');

        // Handle VTT styling tags
        formatted = formatted.replace(/<b>/g, '<strong>');
        formatted = formatted.replace(/<\/b>/g, '</strong>');
        formatted = formatted.replace(/<i>/g, '<em>');
        formatted = formatted.replace(/<\/i>/g, '</em>');
        formatted = formatted.replace(/<u>/g, '<u>');
        formatted = formatted.replace(/<\/u>/g, '</u>');

        return formatted;
    }

    /**
     * Find cue for a specific time.
     */
    private findCue(time: number): SubtitleCue | null {
        // Binary search for efficiency with large cue lists
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
     * Parse WebVTT content into cues.
     */
    private parseVTT(content: string): SubtitleCue[] {
        const cues: SubtitleCue[] = [];
        const lines = content.split(/\r?\n/);

        let i = 0;

        // Skip WEBVTT header and metadata
        while (i < lines.length && !(lines[i]?.includes('-->'))) {
            i++;
        }

        while (i < lines.length) {
            const line = lines[i]?.trim() ?? '';

            // Look for timestamp line
            if (line.includes('-->')) {
                const parts = line.split('-->').map(s => s.trim());
                const startStr = parts[0] ?? '0:00';
                const endStr = (parts[1] ?? '0:00').split(' ')[0] ?? '0:00'; // Remove positioning info
                const startTime = this.parseTime(startStr);
                const endTime = this.parseTime(endStr);

                // Collect text lines until empty line or end
                i++;
                const textLines: string[] = [];
                while (i < lines.length && lines[i]?.trim() !== '') {
                    textLines.push(lines[i]?.trim() ?? '');
                    i++;
                }

                if (textLines.length > 0) {
                    cues.push({
                        startTime,
                        endTime,
                        text: textLines.join('\n'),
                    });
                }
            } else {
                i++;
            }
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
            seconds = parseInt(parts[0] ?? '0', 10) * 3600 +
                parseInt(parts[1] ?? '0', 10) * 60 +
                parseFloat(parts[2] ?? '0');
        } else if (parts.length === 2) {
            seconds = parseInt(parts[0] ?? '0', 10) * 60 +
                parseFloat(parts[1] ?? '0');
        }

        return seconds;
    }

    /**
     * Cleanup resources.
     */
    destroy(): void {
        this.overlay?.remove();
        this.overlay = null;
        this.cues = [];
        this.tracks = [];
        this.currentCue = null;
    }
}
