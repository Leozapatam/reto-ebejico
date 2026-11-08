import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'apps/reto-ebejico',
  publicDir: path.resolve(__dirname, 'apps/reto-ebejico/public'),
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'packages/game-core/src'),
      '@client': path.resolve(__dirname, 'packages/game-client/src'),
      '@ui': path.resolve(__dirname, 'packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    fs: {
      allow: ['..'],
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});
