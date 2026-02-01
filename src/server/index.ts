import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 50000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.join(__dirname, '../../data');

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../dist')));

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

app.get('/api/files', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'path required' });
    }
    const safePath = path.join(DATA_DIR, path.basename(filePath));
    const content = await fs.readFile(safePath, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/files', async (req, res) => {
  try {
    await ensureDataDir();
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: 'path and content required' });
    }
    const safePath = path.join(DATA_DIR, path.basename(filePath));
    await fs.writeFile(safePath, content, 'utf-8');
    res.json({ success: true, path: safePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to write file' });
  }
});

app.get('/api/files/list', async (_req, res) => {
  try {
    await ensureDataDir();
    const files = await fs.readdir(DATA_DIR);
    const mdFiles = files.filter((f) => f.endsWith('.md'));
    res.json({ files: mdFiles });
  } catch {
    res.json({ files: [] });
  }
});

app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const gemini = spawn('gemini', ['-p', prompt], {
    shell: true,
    env: { ...process.env },
  });

  gemini.stdout.on('data', (data: Buffer) => {
    res.write(`data: ${JSON.stringify({ text: data.toString() })}\n\n`);
  });

  gemini.stderr.on('data', (data: Buffer) => {
    res.write(`data: ${JSON.stringify({ error: data.toString() })}\n\n`);
  });

  gemini.on('close', () => {
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  });

  gemini.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    gemini.kill();
  });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
