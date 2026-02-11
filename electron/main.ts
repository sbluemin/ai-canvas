import { app, BrowserWindow, ipcMain, dialog, Menu, session, shell } from 'electron';
import type { Rectangle } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import * as gemini from './gemini';
import * as codex from './codex';
import * as anthropic from './anthropic';
import { executeAiChatWorkflow, type AiChatRequest } from './ai';
import { fetchModelsFromApi } from './api/models';
import { handleIpc } from './ipc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.ELECTRON_IS_PACKAGED !== 'true');

const APP_NAME = 'AI Canvas';
app.setName(APP_NAME);

let mainWindow: BrowserWindow | null = null;
const windows = new Set<BrowserWindow>();
type WindowStoreSchema = {
  bounds?: Rectangle;
};

const windowStore = new Store<WindowStoreSchema>({ name: 'window-state' });

function getIconPath(): string {
  if (isDev) {
    return path.join(__dirname, '../public/icon.png');
  }
  return path.join(__dirname, '../dist/icon.png');
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: APP_NAME,
          submenu: [
            { role: 'about' as const, label: `About ${APP_NAME}` },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const, label: `Hide ${APP_NAME}` },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const, label: `Quit ${APP_NAME}` },
          ],
        }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow();
          },
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const savedBounds = windowStore.get('bounds');
  const window = new BrowserWindow({
    width: savedBounds?.width ?? 1200,
    height: savedBounds?.height ?? 800,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 800,
    minHeight: 600,
    icon: getIconPath(),
    frame: process.platform === 'darwin' ? false : true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'win32' ? {
      titleBarOverlay: {
        color: '#131314',
        symbolColor: '#9ca3af',
        height: 56,
      },
    } : {}),
  });

  if (isDev) {
    window.loadURL('http://localhost:5173');
    window.webContents.once('did-finish-load', () => {
      window.webContents.openDevTools({ mode: 'detach' });
    });

    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error('[dev] failed to load renderer:', {
        errorCode,
        errorDescription,
        validatedURL,
      });
    });
  } else {
    window.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
    }
  });

  windows.add(window);
  mainWindow = window;

  window.on('close', () => {
    windowStore.set('bounds', window.getBounds());
  });

  window.on('closed', () => {
    windows.delete(window);
    if (mainWindow === window) {
      const remaining = Array.from(windows);
      mainWindow = remaining.length > 0 ? remaining[0] : null;
    }
  });

  return window;
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox({
      type: 'info',
      buttons: ['Restart & Install', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Ready',
      message: 'A new version has been downloaded. Would you like to restart and install now?',
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('autoUpdater failed:', error);
  });
}

ipcMain.handle('dialog:showSaveDialog', async () => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    defaultPath: 'untitled.md',
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('dialog:showOpenDialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  return await fs.readFile(filePath, 'utf-8');
});

handleIpc('gemini:auth:start', async () => {
  await gemini.startAuth();
  return { success: true };
});

ipcMain.handle('gemini:auth:status', async () => {
  return await gemini.getAuthStatus();
});

ipcMain.handle('gemini:auth:logout', async () => {
  await gemini.logout();
  return { success: true };
});

handleIpc('codex:auth:start', async () => {
  await codex.startAuth();
  return { success: true };
});

ipcMain.handle('codex:auth:status', async () => {
  return await codex.getAuthStatus();
});

ipcMain.handle('codex:auth:logout', async () => {
  await codex.logout();
  return { success: true };
});

handleIpc('anthropic:auth:start', async () => {
  await anthropic.startAuth();
  return { success: true };
});

ipcMain.handle('anthropic:auth:status', async () => {
  return await anthropic.getAuthStatus();
});

ipcMain.handle('anthropic:auth:logout', async () => {
  await anthropic.logout();
  return { success: true };
});

handleIpc('ai:chat', async (event, request: AiChatRequest) => {
  await executeAiChatWorkflow(event, request);
  return { success: true };
});

handleIpc('ai:fetch-models', async () => {
  const models = await fetchModelsFromApi();
  return { success: true, models };
});

const AI_CANVAS_DIR = '.ai-canvas';
const DEFAULT_CANVAS_NAME = 'canvas.md';
const CHAT_SESSION_NAME = 'chat-session.json';
const WORKSPACE_NAME = 'workspace.json';
const AUTOSAVE_STATUS_NAME = 'autosave-status.json';
const ASSET_DIR_NAME = 'assets';
const DEFAULT_CANVAS_CONTENT = `# New Canvas

Start writing here.
`;

function isValidCanvasFileName(fileName: string): boolean {
  if (!fileName.endsWith('.md')) return false;
  if (fileName.includes('/') || fileName.includes('\\')) return false;
  if (fileName.includes('..')) return false;
  return fileName.length > 3;
}

function getCanvasFilePath(projectPath: string, fileName: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, fileName);
}

function getChatSessionPath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, CHAT_SESSION_NAME);
}

function getWorkspacePath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, WORKSPACE_NAME);
}

function getAutosaveStatusPath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, AUTOSAVE_STATUS_NAME);
}

function getAssetsDirPath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, ASSET_DIR_NAME);
}

function markdownToBasicHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = escaped
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  return `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:Inter,Segoe UI,sans-serif;padding:32px;line-height:1.6;color:#111827}code{background:#f3f4f6;padding:2px 4px;border-radius:4px}pre{background:#111827;color:#f9fafb;padding:12px;border-radius:8px;overflow:auto}img{max-width:100%}</style></head><body><p>${html}</p></body></html>`;
}

function getContentSecurityPolicy(): string {
  if (isDev) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:5173 http://127.0.0.1:5173",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: file: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' ws://localhost:5173 ws://127.0.0.1:5173 http://localhost:5173 http://127.0.0.1:5173",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-src 'self'",
    ].join('; ');
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: file: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'self'",
  ].join('; ');
}

function setupContentSecurityPolicy() {
  const csp = getContentSecurityPolicy();
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isMainFrame = details.resourceType === 'mainFrame';
    const isAppUrl = isDev
      ? details.url.startsWith('http://localhost:5173') || details.url.startsWith('http://127.0.0.1:5173')
      : details.url.startsWith('file://');

    if (!isMainFrame || !isAppUrl) {
      callback({ responseHeaders: details.responseHeaders ?? {} });
      return;
    }

    const responseHeaders = details.responseHeaders ?? {};
    responseHeaders['Content-Security-Policy'] = [csp];
    callback({ responseHeaders });
  });
}

function isAllowedNavigation(url: string): boolean {
  if (isDev) {
    return url.startsWith('http://localhost:5173') || url.startsWith('http://127.0.0.1:5173');
  }
  return url.startsWith('file://');
}

ipcMain.handle('project:open-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Project Folder',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

handleIpc('project:init-canvas-dir', async (_event, projectPath: string) => {
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  await fs.mkdir(canvasDir, { recursive: true });
  return { success: true, path: canvasDir };
});

handleIpc('project:list-canvas-files', async (_event, projectPath: string) => {
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  try {
    const entries = await fs.readdir(canvasDir, { withFileTypes: true });
    const mdFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name);
    return { success: true, files: mdFiles };
  } catch (error) {
    // 디렉터리가 없으면 빈 리스트 반환
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { success: true, files: [] };
    }
    throw error;
  }
});

handleIpc('project:read-canvas-file', async (_event, projectPath: string, fileName: string) => {
  if (!isValidCanvasFileName(fileName)) {
    return { success: false, error: 'Invalid file name.' };
  }
  const filePath = getCanvasFilePath(projectPath, fileName);
  const content = await fs.readFile(filePath, 'utf-8');
  return { success: true, content };
});

handleIpc('project:write-canvas-file', async (_event, projectPath: string, fileName: string, content: string) => {
  if (!isValidCanvasFileName(fileName)) {
    return { success: false, error: 'Invalid file name.' };
  }
  const filePath = getCanvasFilePath(projectPath, fileName);
  await fs.writeFile(filePath, content, 'utf-8');
  return { success: true };
});

handleIpc('project:rename-canvas-file', async (_event, projectPath: string, oldFileName: string, newFileName: string) => {
  if (!isValidCanvasFileName(oldFileName) || !isValidCanvasFileName(newFileName)) {
    return { success: false, error: 'Invalid file name.' };
  }

  const oldPath = getCanvasFilePath(projectPath, oldFileName);
  const newPath = getCanvasFilePath(projectPath, newFileName);

  try {
    await fs.access(newPath);
    return { success: false, error: 'A file with the same name already exists.' };
  } catch {
    // 대상 파일이 없을 때만 rename 진행
  }

  await fs.rename(oldPath, newPath);
  return { success: true };
});

handleIpc('project:delete-canvas-file', async (_event, projectPath: string, fileName: string) => {
  if (!isValidCanvasFileName(fileName)) {
    return { success: false, error: 'Invalid file name.' };
  }

  const filePath = getCanvasFilePath(projectPath, fileName);
  await fs.unlink(filePath);
  return { success: true };
});

handleIpc('project:read-chat-session', async (_event, projectPath: string) => {
  const filePath = getChatSessionPath(projectPath);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return { success: true, messages: [] };
    }
    return { success: true, messages: parsed };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { success: true, messages: [] };
    }
    throw error;
  }
});

handleIpc('project:write-chat-session', async (_event, projectPath: string, messages: unknown[]) => {
  const filePath = getChatSessionPath(projectPath);
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  await fs.mkdir(canvasDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(messages), 'utf-8');
  return { success: true };
});

handleIpc('project:create-default-canvas', async (_event, projectPath: string) => {
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  const filePath = path.join(canvasDir, DEFAULT_CANVAS_NAME);
  await fs.mkdir(canvasDir, { recursive: true });
  await fs.writeFile(filePath, DEFAULT_CANVAS_CONTENT, 'utf-8');
  return { success: true, fileName: DEFAULT_CANVAS_NAME };
});

handleIpc('project:read-workspace', async (_event, projectPath: string) => {
  const workspacePath = getWorkspacePath(projectPath);
  try {
    const raw = await fs.readFile(workspacePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return { success: true, workspace: parsed };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { success: true, workspace: null };
    }
    throw error;
  }
});

handleIpc('project:write-workspace', async (_event, projectPath: string, workspace: unknown) => {
  const workspacePath = getWorkspacePath(projectPath);
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  await fs.mkdir(canvasDir, { recursive: true });
  await fs.writeFile(workspacePath, JSON.stringify(workspace), 'utf-8');
  return { success: true };
});

handleIpc('project:read-autosave-status', async (_event, projectPath: string) => {
  const autosaveStatusPath = getAutosaveStatusPath(projectPath);
  try {
    const raw = await fs.readFile(autosaveStatusPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return { success: true, status: parsed };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { success: true, status: null };
    }
    throw error;
  }
});

handleIpc('project:write-autosave-status', async (_event, projectPath: string, status: unknown) => {
  const autosaveStatusPath = getAutosaveStatusPath(projectPath);
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  await fs.mkdir(canvasDir, { recursive: true });
  await fs.writeFile(autosaveStatusPath, JSON.stringify(status), 'utf-8');
  return { success: true };
});

handleIpc('project:save-image-asset', async (_event, projectPath: string, base64: string, mimeType: string) => {
  const assetDir = getAssetsDirPath(projectPath);
  const ext = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/jpeg'
      ? 'jpg'
      : mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'image/gif'
          ? 'gif'
          : 'png';

  await fs.mkdir(assetDir, { recursive: true });
  const buffer = Buffer.from(base64, 'base64');
  const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12);
  const fileName = `${Date.now()}-${hash}.${ext}`;
  const fullPath = path.join(assetDir, fileName);
  await fs.writeFile(fullPath, buffer);

  return {
    success: true,
    relativePath: `${ASSET_DIR_NAME}/${fileName}`,
    absolutePath: fullPath,
  };
});

handleIpc('project:export-document', async (_event, projectPath: string, format: 'html' | 'pdf' | 'docx', markdownContent: string) => {
  const defaultName = `canvas-export-${Date.now()}`;
  const ext = format === 'pdf' ? 'pdf' : format === 'docx' ? 'docx' : 'html';

  const result = await dialog.showSaveDialog({
    title: 'Export Document',
    defaultPath: path.join(projectPath, `${defaultName}.${ext}`),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, error: 'User cancelled the export.' };
  }

  const html = markdownToBasicHtml(markdownContent);

    if (format === 'html') {
      await fs.writeFile(result.filePath, html, 'utf-8');
      return { success: true, filePath: result.filePath };
    }

    if (format === 'pdf') {
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdf = await printWindow.webContents.printToPDF({ printBackground: true });
      await fs.writeFile(result.filePath, pdf);
      printWindow.destroy();
      return { success: true, filePath: result.filePath };
    }

    const docxModule = await import('docx');
    const lines = markdownContent.split('\n');
    const children = lines.map((line) => {
      if (line.startsWith('# ')) {
        return new docxModule.Paragraph({
          heading: docxModule.HeadingLevel.HEADING_1,
          children: [new docxModule.TextRun(line.slice(2))],
        });
      }
      if (line.startsWith('## ')) {
        return new docxModule.Paragraph({
          heading: docxModule.HeadingLevel.HEADING_2,
          children: [new docxModule.TextRun(line.slice(3))],
        });
      }
      return new docxModule.Paragraph({
        children: [new docxModule.TextRun(line)],
      });
    });

    const doc = new docxModule.Document({
      sections: [{ children }],
    });
    const buffer = await docxModule.Packer.toBuffer(doc);
    await fs.writeFile(result.filePath, buffer);
    return { success: true, filePath: result.filePath };
});

handleIpc('project:export-share-bundle', async (_event, projectPath: string, bundle: unknown) => {
  const result = await dialog.showSaveDialog({
    title: 'Export Share Bundle',
    defaultPath: path.join(projectPath, `canvas-share-${Date.now()}.aic`),
    filters: [{ name: 'AI Canvas Bundle', extensions: ['aic'] }],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, error: 'User cancelled the export.' };
  }

  await fs.writeFile(result.filePath, JSON.stringify(bundle, null, 2), 'utf-8');
  return { success: true, filePath: result.filePath };
});

handleIpc('project:import-share-bundle', async (_event) => {
  const result = await dialog.showOpenDialog({
    title: 'Import Share Bundle',
    properties: ['openFile'],
    filters: [{ name: 'AI Canvas Bundle', extensions: ['aic', 'json'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, error: 'User cancelled the import.' };
  }

  const raw = await fs.readFile(result.filePaths[0], 'utf-8');
  const bundle = JSON.parse(raw) as unknown;
  return { success: true, bundle };
});

handleIpc('project:open-in-explorer', async (_event, projectPath: string) => {
  await shell.openPath(projectPath);
  return { success: true };
});

handleIpc('window:create', async () => {
  createWindow();
  return { success: true };
});

app.whenReady().then(() => {
  setupContentSecurityPolicy();
  createApplicationMenu();
  setupAutoUpdater();

  if (process.platform === 'darwin') {
    app.dock.setIcon(getIconPath());
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
