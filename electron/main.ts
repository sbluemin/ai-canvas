import { app, BrowserWindow, dialog, Menu, nativeTheme, session } from 'electron';
import type { Rectangle } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { registerIpcHandlers, readStoredThemeMode, type ThemeMode } from './ipc-handlers';
import { shutdownOpenCodeRuntime } from './ai-workflow';

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

function resolveThemeMode(theme: ThemeMode): 'dark' | 'light' {
  if (theme === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return theme;
}

function getWin32TitleBarOverlay(theme: ThemeMode) {
  if (resolveThemeMode(theme) === 'light') {
    return {
      color: '#ffffff',
      symbolColor: '#5f6368',
      height: 56,
    };
  }

  return {
    color: '#131314',
    symbolColor: '#9ca3af',
    height: 56,
  };
}

function applyWin32TitleBarOverlay(theme: ThemeMode) {
  if (process.platform !== 'win32') return;

  const overlay = getWin32TitleBarOverlay(theme);
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    window.setTitleBarOverlay(overlay);
  }
}

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
      titleBarOverlay: getWin32TitleBarOverlay(readStoredThemeMode()),
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

registerIpcHandlers(createWindow, (theme) => {
  applyWin32TitleBarOverlay(theme);
});
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


app.whenReady().then(() => {
  setupContentSecurityPolicy();
  createApplicationMenu();
  setupAutoUpdater();

  if (process.platform === 'darwin') {
    app.dock.setIcon(getIconPath());
  }

  createWindow();

  if (process.platform === 'win32') {
    nativeTheme.on('updated', () => {
      if (readStoredThemeMode() === 'system') {
        applyWin32TitleBarOverlay('system');
      }
    });
  }

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

app.on('before-quit', () => {
  shutdownOpenCodeRuntime();
});
