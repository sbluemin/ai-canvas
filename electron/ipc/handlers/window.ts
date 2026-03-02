import { app } from 'electron';
import { handleIpc } from '../../shared/utils';

export function registerWindowHandlers(): void {
  handleIpc('window:show-emoji-panel', async () => {
    app.showEmojiPanel();
    return { success: true };
  });
}
