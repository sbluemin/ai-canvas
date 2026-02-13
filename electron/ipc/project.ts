import { dialog, shell, BrowserWindow } from 'electron';
import { handleIpc } from '../ipc';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import {
  AI_CANVAS_DIR,
  DEFAULT_CANVAS_NAME,
  DEFAULT_CANVAS_CONTENT,
  ASSET_DIR_NAME,
} from '../consts';
import {
  getCanvasFilePath,
  getCanvasFolderPath,
  isValidCanvasFileName,
  isValidCanvasFolderPath,
  getChatSessionPath,
  getWorkspacePath,
  getAutosaveStatusPath,
  getAssetsDirPath,
  markdownToBasicHtml,
} from '../utils';

export function registerProjectHandlers() {
  handleIpc('project:open-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Project Folder',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  handleIpc('project:init-canvas-dir', async (_event: any, projectPath: string) => {
    const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
    try {
      await fs.mkdir(canvasDir, { recursive: true });
      return { success: true, path: canvasDir };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:list-canvas-files', async (_event: any, projectPath: string) => {
    const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
    try {
      const entries = await fs.readdir(canvasDir, { withFileTypes: true });
      const mdFiles = entries
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => e.name);
      return { success: true, files: mdFiles };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: true, files: [] };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:list-canvas-tree', async (_event: any, projectPath: string) => {
    const canvasDir = path.join(projectPath, AI_CANVAS_DIR);

    interface TreeEntry {
      name: string;
      type: 'file' | 'folder';
      path: string;
      children?: TreeEntry[];
    }

    async function readDirRecursive(dirPath: string, relativePath: string): Promise<TreeEntry[]> {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result: TreeEntry[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

        if (entry.isDirectory() && entry.name !== ASSET_DIR_NAME) {
          const children = await readDirRecursive(path.join(dirPath, entry.name), entryRelPath);
          result.push({ name: entry.name, type: 'folder', path: entryRelPath, children });
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          result.push({ name: entry.name, type: 'file', path: entryRelPath });
        }
      }

      result.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return result;
    }

    try {
      const tree = await readDirRecursive(canvasDir, '');
      return { success: true, tree };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: true, tree: [] };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:create-canvas-folder', async (_event: any, projectPath: string, folderPath: string) => {
    if (!isValidCanvasFolderPath(folderPath)) {
      return { success: false, error: 'Invalid folder path.' };
    }
    const fullPath = getCanvasFolderPath(projectPath, folderPath);
    try {
      await fs.mkdir(fullPath, { recursive: true });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:delete-canvas-folder', async (_event: any, projectPath: string, folderPath: string) => {
    if (!isValidCanvasFolderPath(folderPath)) {
      return { success: false, error: 'Invalid folder path.' };
    }
    const fullPath = getCanvasFolderPath(projectPath, folderPath);
    try {
      await fs.rm(fullPath, { recursive: true, force: true });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:move-canvas-file', async (_event: any, projectPath: string, oldPath: string, newPath: string) => {
    if (!isValidCanvasFileName(oldPath) || !isValidCanvasFileName(newPath)) {
      return { success: false, error: 'Invalid file path.' };
    }
    const srcPath = getCanvasFilePath(projectPath, oldPath);
    const destPath = getCanvasFilePath(projectPath, newPath);
    try {
      const destDir = path.dirname(destPath);
      await fs.mkdir(destDir, { recursive: true });
      await fs.rename(srcPath, destPath);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:rename-canvas-folder', async (_event: any, projectPath: string, oldFolderPath: string, newFolderPath: string) => {
    if (!isValidCanvasFolderPath(oldFolderPath) || !isValidCanvasFolderPath(newFolderPath)) {
      return { success: false, error: 'Invalid folder path.' };
    }
    const oldFullPath = getCanvasFolderPath(projectPath, oldFolderPath);
    const newFullPath = getCanvasFolderPath(projectPath, newFolderPath);
    try {
      await fs.rename(oldFullPath, newFullPath);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:read-canvas-file', async (_event: any, projectPath: string, fileName: string) => {
    if (!isValidCanvasFileName(fileName)) {
      return { success: false, error: 'Invalid file name.' };
    }
    const filePath = getCanvasFilePath(projectPath, fileName);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:write-canvas-file', async (_event: any, projectPath: string, fileName: string, content: string) => {
    if (!isValidCanvasFileName(fileName)) {
      return { success: false, error: 'Invalid file name.' };
    }
    const filePath = getCanvasFilePath(projectPath, fileName);
    try {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:rename-canvas-file', async (_event: any, projectPath: string, oldFileName: string, newFileName: string) => {
    if (!isValidCanvasFileName(oldFileName) || !isValidCanvasFileName(newFileName)) {
      return { success: false, error: 'Invalid file name.' };
    }

    const oldPath = getCanvasFilePath(projectPath, oldFileName);
    const newPath = getCanvasFilePath(projectPath, newFileName);

    try {
      await fs.rename(oldPath, newPath);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:delete-canvas-file', async (_event: any, projectPath: string, fileName: string) => {
    if (!isValidCanvasFileName(fileName)) {
      return { success: false, error: 'Invalid file name.' };
    }

    const filePath = getCanvasFilePath(projectPath, fileName);
    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:read-chat-session', async (_event: any, projectPath: string) => {
    const filePath = getChatSessionPath(projectPath);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return { success: true, messages: [] };
      }
      return { success: true, messages: parsed };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: true, messages: [] };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:write-chat-session', async (_event: any, projectPath: string, messages: unknown[]) => {
    const filePath = getChatSessionPath(projectPath);
    try {
      const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
      await fs.mkdir(canvasDir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(messages), 'utf-8');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:create-default-canvas', async (_event: any, projectPath: string) => {
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

  handleIpc('project:read-workspace', async (_event: any, projectPath: string) => {
    const workspacePath = getWorkspacePath(projectPath);
    try {
      const raw = await fs.readFile(workspacePath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      return { success: true, workspace: parsed };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: true, workspace: null };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:write-workspace', async (_event: any, projectPath: string, workspace: unknown) => {
    const workspacePath = getWorkspacePath(projectPath);
    try {
      const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
      await fs.mkdir(canvasDir, { recursive: true });
      await fs.writeFile(workspacePath, JSON.stringify(workspace), 'utf-8');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:read-autosave-status', async (_event: any, projectPath: string) => {
    const autosaveStatusPath = getAutosaveStatusPath(projectPath);
    try {
      const raw = await fs.readFile(autosaveStatusPath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      return { success: true, status: parsed };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: true, status: null };
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:write-autosave-status', async (_event: any, projectPath: string, status: unknown) => {
    const autosaveStatusPath = getAutosaveStatusPath(projectPath);
    try {
      const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
      await fs.mkdir(canvasDir, { recursive: true });
      await fs.writeFile(autosaveStatusPath, JSON.stringify(status), 'utf-8');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:save-image-asset', async (_event: any, projectPath: string, base64: string, mimeType: string) => {
    const assetDir = getAssetsDirPath(projectPath);
    const ext = mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/jpeg'
        ? 'jpg'
        : mimeType === 'image/webp'
          ? 'webp'
          : mimeType === 'image/gif'
            ? 'gif'
            : 'png';

    try {
      await fs.mkdir(assetDir, { recursive: true });
      const buffer = Buffer.from(base64, 'base64');
      const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12);
      const fileName = `${Date.now()}-${hash}.${ext}`;
      const fullPath = path.join(assetDir, fileName);
      await fs.writeFile(fullPath, buffer);

      return {
        success: true,
        relativePath: `${ASSET_DIR_NAME}/${fileName}`,
        absolutePath: fullPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:export-document', async (_event: any, projectPath: string, format: 'html' | 'pdf' | 'docx', markdownContent: string) => {
    const defaultName = `canvas-export-${Date.now()}`;
    const ext = format === 'pdf' ? 'pdf' : format === 'docx' ? 'docx' : 'html';

    const result = await dialog.showSaveDialog({
      title: 'Export Document',
      defaultPath: path.join(projectPath, `${defaultName}.${ext}`),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'User cancelled the export.' };
    }

    try {
      const html = markdownToBasicHtml(markdownContent);

      if (format === 'html') {
        await fs.writeFile(result.filePath, html, 'utf-8');
        return { success: true, filePath: result.filePath };
      }

      if (format === 'pdf') {
        const printWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
          },
        });

        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        const pdf = await printWindow.webContents.printToPDF({ printBackground: true });
        await fs.writeFile(result.filePath, pdf);
        printWindow.destroy();
        return { success: true, filePath: result.filePath };
      }

      const docxModule = await import('docx');
      const lines = markdownContent.split('\n');
      const children = lines.map((line) => {
        if (line.startsWith('# ')) {
          return new docxModule.Paragraph({
            heading: docxModule.HeadingLevel.HEADING_1,
            children: [new docxModule.TextRun(line.slice(2))],
          });
        }
        if (line.startsWith('## ')) {
          return new docxModule.Paragraph({
            heading: docxModule.HeadingLevel.HEADING_2,
            children: [new docxModule.TextRun(line.slice(3))],
          });
        }
        return new docxModule.Paragraph({
          children: [new docxModule.TextRun(line)],
        });
      });

      const doc = new docxModule.Document({
        sections: [{ children }],
      });
      const buffer = await docxModule.Packer.toBuffer(doc);
      await fs.writeFile(result.filePath, buffer);
      return { success: true, filePath: result.filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:export-share-bundle', async (_event: any, projectPath: string, bundle: unknown) => {
    const result = await dialog.showSaveDialog({
      title: 'Export Share Bundle',
      defaultPath: path.join(projectPath, `canvas-share-${Date.now()}.aic`),
      filters: [{ name: 'AI Canvas Bundle', extensions: ['aic'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'User cancelled the export.' };
    }

    try {
      await fs.writeFile(result.filePath, JSON.stringify(bundle, null, 2), 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:import-share-bundle', async (_event) => {
    const result = await dialog.showOpenDialog({
      title: 'Import Share Bundle',
      properties: ['openFile'],
      filters: [{ name: 'AI Canvas Bundle', extensions: ['aic', 'json'] }],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'User cancelled the import.' };
    }

    try {
      const raw = await fs.readFile(result.filePaths[0], 'utf-8');
      const bundle = JSON.parse(raw) as unknown;
      return { success: true, bundle };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

  handleIpc('project:open-in-explorer', async (_event: any, projectPath: string) => {
    try {
      await shell.openPath(projectPath);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });

}
