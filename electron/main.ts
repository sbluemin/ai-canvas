import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import * as gemini from './gemini';
import * as codex from './codex';
import * as anthropic from './anthropic';
import { executeAiChatWorkflow, type AiChatRequest } from './ai';
import { fetchModelsFromApi } from './api/models';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.ELECTRON_IS_PACKAGED !== 'true');

const APP_NAME = 'AI Canvas';
app.setName(APP_NAME);

let mainWindow: BrowserWindow | null = null;

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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: getIconPath(),
    frame: process.platform === 'darwin' ? false : true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
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
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('dialog:showSaveDialog', async () => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    defaultPath: 'untitled.md',
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('gemini:auth:start', async () => {
  try {
    await gemini.startAuth();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('gemini:auth:status', async () => {
  return await gemini.getAuthStatus();
});

ipcMain.handle('gemini:auth:logout', async () => {
  await gemini.logout();
  return { success: true };
});

ipcMain.handle('codex:auth:start', async () => {
  try {
    await codex.startAuth();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('codex:auth:status', async () => {
  return await codex.getAuthStatus();
});

ipcMain.handle('codex:auth:logout', async () => {
  await codex.logout();
  return { success: true };
});

ipcMain.handle('anthropic:auth:start', async () => {
  try {
    await anthropic.startAuth();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('anthropic:auth:status', async () => {
  return await anthropic.getAuthStatus();
});

ipcMain.handle('anthropic:auth:logout', async () => {
  await anthropic.logout();
  return { success: true };
});

ipcMain.handle('ai:chat', async (event, request: AiChatRequest) => {
  try {
    await executeAiChatWorkflow(event, request);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('ai:fetch-models', async () => {
  try {
    const models = await fetchModelsFromApi();
    return { success: true, models };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

const AI_CANVAS_DIR = '.ai-canvas';
const DEFAULT_CANVAS_NAME = 'canvas.md';
const DEFAULT_CANVAS_CONTENT = `# 새 캔버스

여기에 내용을 작성하세요.
`;

ipcMain.handle('project:open-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '프로젝트 폴더 선택',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('project:init-canvas-dir', async (_event, projectPath: string) => {
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  try {
    await fs.mkdir(canvasDir, { recursive: true });
    return { success: true, path: canvasDir };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('project:list-canvas-files', async (_event, projectPath: string) => {
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('project:read-canvas-file', async (_event, projectPath: string, fileName: string) => {
  const filePath = path.join(projectPath, AI_CANVAS_DIR, fileName);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('project:write-canvas-file', async (_event, projectPath: string, fileName: string, content: string) => {
  const filePath = path.join(projectPath, AI_CANVAS_DIR, fileName);
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('project:create-default-canvas', async (_event, projectPath: string) => {
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  const filePath = path.join(canvasDir, DEFAULT_CANVAS_NAME);
  try {
    await fs.mkdir(canvasDir, { recursive: true });
    await fs.writeFile(filePath, DEFAULT_CANVAS_CONTENT, 'utf-8');
    return { success: true, fileName: DEFAULT_CANVAS_NAME };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

app.whenReady().then(() => {
  createApplicationMenu();

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
