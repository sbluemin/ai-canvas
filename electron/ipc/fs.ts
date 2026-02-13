import { handleIpc } from '../core';
import fs from 'node:fs/promises';

export function registerFsHandlers() {
  handleIpc('fs:writeFile', async (_event: any, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  });

  handleIpc('fs:readFile', async (_event: any, filePath: string) => {
    return await fs.readFile(filePath, 'utf-8');
  });
}
