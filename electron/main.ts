import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import * as gemini from './gemini';

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
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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

ipcMain.handle('dialog:showOpenDialog', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  return await fs.readFile(filePath, 'utf-8');
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

ipcMain.handle('gemini:chat', async (event, prompt: string) => {
  const auth = await gemini.getValidAccessToken();
  if (!auth) {
    return { success: false, error: 'Not authenticated' };
  }
  return gemini.chat(event, auth, { prompt });
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
