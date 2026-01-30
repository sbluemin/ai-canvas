import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

const isWebMode = process.env.npm_lifecycle_event?.includes('web') || process.argv.includes('--mode') && process.argv.includes('web');

export default defineConfig({
  plugins: [
    react(),
    ...(!isWebMode ? [
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
          onstart(options) {
            options.reload();
          },
        },
      ]),
      renderer(),
    ] : []),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
});
