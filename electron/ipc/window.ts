import { BrowserWindow } from 'electron';
import { handleIpc } from '../core';

export function registerWindowHandlers(createWindow: () => BrowserWindow) {
  handleIpc('window:create', async () => {
    createWindow();
    return { success: true };
  });
}
