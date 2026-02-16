import { BrowserWindow } from 'electron';
import { registerDialogHandlers } from './dialog';
import { registerFsHandlers } from './fs';
import { registerProjectHandlers } from './project';
import { registerAiHandlers } from './ai';
import { registerWindowHandlers } from './window';
import { registerSettingsHandlers } from './settings';

export function registerIpcHandlers(createWindow: () => BrowserWindow) {
  registerDialogHandlers();
  registerFsHandlers();
  registerProjectHandlers();
  registerAiHandlers();
  registerSettingsHandlers();
  registerWindowHandlers(createWindow);
}
