import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

const isWebMode = process.env.npm_lifecycle_event?.includes('web') || process.argv.includes('--mode') && process.argv.includes('web');

const electronExternals = [
  'electron',
  'ai',
  'ai-sdk-provider-gemini-cli',
  '@google/gemini-cli-core',
];

export default defineConfig({
  plugins: [
    react(),
    ...(isWebMode ? [] : [
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: electronExternals,
              },
            },
          },
        },
      ]),
      renderer(),
    ]),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // Proxy API requests to Express server for web mode
    proxy: {
      '/api': {
        target: 'http://localhost:50000',
        changeOrigin: true,
      },
    },
  },
});
