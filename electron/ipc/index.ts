import { BrowserWindow } from 'electron';
import { registerDialogHandlers } from './dialog';
import { registerFsHandlers } from './fs';
import { registerProjectHandlers } from './project';
import { registerAiHandlers } from './ai';
import { registerWindowHandlers } from './window';
import { registerSettingsHandlers } from './settings';
import type { ThemeMode } from './settings';

export function registerIpcHandlers(
  createWindow: () => BrowserWindow,
  onThemeChanged?: (theme: ThemeMode) => void,
) {
  registerDialogHandlers();
  registerFsHandlers();
  registerProjectHandlers();
  registerAiHandlers();
  registerSettingsHandlers(onThemeChanged);
  registerWindowHandlers(createWindow);
}
