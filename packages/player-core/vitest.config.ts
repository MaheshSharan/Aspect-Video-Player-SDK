import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            'aspect-player-shared': path.resolve(__dirname, '../shared/src/index.ts'),
        },
    },
});
