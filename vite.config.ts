import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

const isWebMode = process.env.npm_lifecycle_event?.includes('web') || process.argv.includes('--mode') && process.argv.includes('web');

const electronExternals = [
  'electron',
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
            resolve: {
              conditions: ['node'],
            },
            define: {
              'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID),
              'process.env.GOOGLE_CLIENT_SECRET': JSON.stringify(process.env.GOOGLE_CLIENT_SECRET),
              'process.env.GOOGLE_REDIRECT_URI': JSON.stringify(process.env.GOOGLE_REDIRECT_URI),
              'process.env.ANTHROPIC_CLIENT_ID': JSON.stringify(process.env.ANTHROPIC_CLIENT_ID),
              'process.env.ANTHROPIC_REDIRECT_URI': JSON.stringify(process.env.ANTHROPIC_REDIRECT_URI),
              'process.env.CODEX_CLIENT_ID': JSON.stringify(process.env.CODEX_CLIENT_ID),
              'process.env.CODEX_REDIRECT_URI': JSON.stringify(process.env.CODEX_REDIRECT_URI),
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
    proxy: {
      '/api': {
        target: 'http://localhost:50000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {},
});
