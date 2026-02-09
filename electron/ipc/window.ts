import { BrowserWindow } from 'electron';
import { handleIpc } from '../ipc';

export function registerWindowHandlers(createWindow: () => BrowserWindow) {
  handleIpc('window:create', async () => {
    createWindow();
    return { success: true };
  });
}
