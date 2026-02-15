import { dialog } from 'electron';
import { handleIpc } from '../core';

export function registerDialogHandlers() {
  handleIpc('dialog:showSaveDialog', async () => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      defaultPath: 'untitled.md',
    });
    return result.canceled ? null : result.filePath;
  });

  handleIpc('dialog:showOpenDialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  handleIpc('dialog:showOpenDialogForAttachments', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images & Documents',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'],
        },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return [];
    }
    return result.filePaths;
  });
}
