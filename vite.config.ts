import { defineConfig, type Plugin } from 'vite';
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

/**
 * Vite 개발 서버 미들웨어로 AI 채팅 API 제공
 * 웹 테스트 모드에서만 사용됨
 */
function devChatApiPlugin(): Plugin {
  return {
    name: 'dev-chat-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const { prompt, history = [] } = JSON.parse(body);

            if (!prompt) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'prompt is required' }));
              return;
            }

            // Dynamic import to avoid bundling issues
            const { streamChatToSSE } = await import('./src/shared/ai/stream');

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');

            const stream = await streamChatToSSE({ prompt, history });
            const reader = stream.getReader();

            const pump = async (): Promise<void> => {
              const { done, value } = await reader.read();
              if (done) {
                res.end();
                return;
              }
              res.write(value);
              return pump();
            };

            await pump();
          } catch (error) {
            console.error('Chat API error:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(error) }));
          }
        });
      });

      // CORS preflight
      server.middlewares.use('/api/chat', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    ...(isWebMode ? [devChatApiPlugin()] : [
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
    ]),
  ],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
});
