/**
 * Build script to generate inject-styles.ts from styles.css
 * Run this before building the package: node scripts/build-styles.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, '../src');

const cssContent = readFileSync(resolve(srcDir, 'styles.css'), 'utf-8');

const tsContent = `/**
 * CSS injection utility for PlayerUI.
 * AUTO-GENERATED from styles.css - DO NOT EDIT DIRECTLY
 * Run: node scripts/build-styles.js
 */

const CSS_CONTENT = ${JSON.stringify(cssContent)};

let stylesInjected = false;
let styleElement: HTMLStyleElement | null = null;

/**
 * Inject player UI styles into the document head.
 * This function is idempotent - calling it multiple times has no effect.
 */
export function injectStyles(): void {
    if (stylesInjected || typeof document === 'undefined') {
        return;
    }

    styleElement = document.createElement('style');
    styleElement.id = 'aspect-player-ui-styles';
    styleElement.textContent = CSS_CONTENT;
    document.head.appendChild(styleElement);
    stylesInjected = true;
}

/**
 * Remove injected player UI styles from the document.
 */
export function removeStyles(): void {
    if (styleElement !== null) {
        styleElement.remove();
        styleElement = null;
        stylesInjected = false;
    }
}

/**
 * Get the raw CSS content as a string.
 */
export function getStyles(): string {
    return CSS_CONTENT;
}
`;

writeFileSync(resolve(srcDir, 'inject-styles.ts'), tsContent, 'utf-8');
console.log('✅ Generated inject-styles.ts from styles.css');
