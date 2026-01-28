import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@aspect/player-react': path.resolve(__dirname, '../player-react/src/index.ts'),
            '@aspect/player-ui': path.resolve(__dirname, '../player-ui/src/index.ts'),
            '@aspect/player-core': path.resolve(__dirname, '../player-core/src/index.ts'),
            '@aspect/player-sources': path.resolve(__dirname, '../player-sources/src/index.ts'),
            '@aspect/shared': path.resolve(__dirname, '../shared/src/index.ts'),
        }
    },
    server: {
        port: 3000
    },
    optimizeDeps: {
        include: ['react', 'react-dom']
    }
})
