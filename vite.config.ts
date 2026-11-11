import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'apps/reto-ebejico',
  // Rutas relativas: el juego funciona igual en la raíz de un dominio, en una subcarpeta
  // (GitHub Pages) o incrustado en un iframe de miradaparda.com
  base: './',
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
    host: true,
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
