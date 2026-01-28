import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    minify: false,
    external: [
        'aspect-player-shared',
        'aspect-player-core',
        'aspect-player-sources',
        'aspect-player-ui',
        'react',
        'react-dom',
    ],
    esbuildOptions(options) {
        options.jsx = 'automatic';
    },
});
