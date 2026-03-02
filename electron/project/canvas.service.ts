import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveProjectDataDir } from './context';
import {
  ASSET_DIR_NAME,
  getCanvasFilePath,
  getCanvasFolderPath,
  isValidCanvasFileName,
  isValidCanvasFolderPath,
  type ServiceResult,
  ok,
  fail,
} from '../shared/utils';
import type { TreeEntry } from './types';

const PROJECT_FILE_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '.idea',
  '.vscode',
  'dist',
  'build',
  'release',
  'coverage',
  'out',
  'tmp',
  'temp',
]);

const PROJECT_FILE_IGNORE_FILES = new Set([
  '.DS_Store',
]);

const MAX_PROJECT_FILE_RESULTS = 5000;

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

async function collectProjectFilesRecursive(baseDir: string, currentDir: string, files: string[]): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (files.length >= MAX_PROJECT_FILE_RESULTS) {
      return;
    }

    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(baseDir, fullPath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || PROJECT_FILE_IGNORE_DIRS.has(entry.name)) {
        continue;
      }

      await collectProjectFilesRecursive(baseDir, fullPath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (PROJECT_FILE_IGNORE_FILES.has(entry.name)) {
      continue;
    }

    files.push(relPath);
  }
}

export async function initCanvasDir(projectPath: string): Promise<ServiceResult<{ path: string }>> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  try {
    await fs.mkdir(projectDataDir, { recursive: true });
    return ok({ path: projectDataDir });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function listCanvasFiles(projectPath: string): Promise<ServiceResult<{ files: string[] }>> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  try {
    const entries = await fs.readdir(projectDataDir, { withFileTypes: true });
    const mdFiles: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === ASSET_DIR_NAME) {
        continue;
      }

      const featureDir = path.join(projectDataDir, entry.name);
      const featureEntries = await fs.readdir(featureDir, { withFileTypes: true });
      for (const featureEntry of featureEntries) {
        if (featureEntry.isFile() && featureEntry.name.endsWith('.md')) {
          mdFiles.push(`${entry.name}/${featureEntry.name}`);
        }
      }
    }

    mdFiles.sort((a, b) => a.localeCompare(b));
    return ok({ files: mdFiles });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ files: [] });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function listCanvasTree(projectPath: string): Promise<ServiceResult<{ tree: TreeEntry[] }>> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  try {
    const tree = await readDirRecursive(projectDataDir, '');
    return ok({ tree });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ tree: [] });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function listProjectFiles(projectPath: string): Promise<ServiceResult<{ files: string[] }>> {
  try {
    await resolveProjectDataDir(projectPath);
    const files: string[] = [];
    await collectProjectFilesRecursive(projectPath, projectPath, files);
    files.sort((a, b) => a.localeCompare(b));
    return ok({ files });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ files: [] });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function createCanvasFolder(projectPath: string, folderPath: string): Promise<ServiceResult> {
  if (!isValidCanvasFolderPath(folderPath)) {
    return fail('Invalid folder path.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const fullPath = getCanvasFolderPath(projectDataDir, folderPath);
  try {
    await fs.mkdir(fullPath, { recursive: true });
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function deleteCanvasFolder(projectPath: string, folderPath: string): Promise<ServiceResult> {
  if (!isValidCanvasFolderPath(folderPath)) {
    return fail('Invalid folder path.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const fullPath = getCanvasFolderPath(projectDataDir, folderPath);
  try {
    await fs.rm(fullPath, { recursive: true, force: true });
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function renameCanvasFolder(projectPath: string, oldFolderPath: string, newFolderPath: string): Promise<ServiceResult> {
  if (!isValidCanvasFolderPath(oldFolderPath) || !isValidCanvasFolderPath(newFolderPath)) {
    return fail('Invalid folder path.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const oldFullPath = getCanvasFolderPath(projectDataDir, oldFolderPath);
  const newFullPath = getCanvasFolderPath(projectDataDir, newFolderPath);
  try {
    await fs.rename(oldFullPath, newFullPath);
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function readCanvasFile(projectPath: string, fileName: string): Promise<ServiceResult<{ content: string }>> {
  if (!isValidCanvasFileName(fileName)) {
    return fail('Invalid file name.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const filePath = getCanvasFilePath(projectDataDir, fileName);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return ok({ content });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function writeCanvasFile(projectPath: string, fileName: string, content: string): Promise<ServiceResult> {
  if (!isValidCanvasFileName(fileName)) {
    return fail('Invalid file name.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const filePath = getCanvasFilePath(projectDataDir, fileName);
  try {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function renameCanvasFile(projectPath: string, oldFileName: string, newFileName: string): Promise<ServiceResult> {
  if (!isValidCanvasFileName(oldFileName) || !isValidCanvasFileName(newFileName)) {
    return fail('Invalid file name.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const oldPath = getCanvasFilePath(projectDataDir, oldFileName);
  const newPath = getCanvasFilePath(projectDataDir, newFileName);
  try {
    await fs.rename(oldPath, newPath);
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function deleteCanvasFile(projectPath: string, fileName: string): Promise<ServiceResult> {
  if (!isValidCanvasFileName(fileName)) {
    return fail('Invalid file name.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const filePath = getCanvasFilePath(projectDataDir, fileName);
  try {
    await fs.unlink(filePath);
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function moveCanvasFile(projectPath: string, oldFilePath: string, newFilePath: string): Promise<ServiceResult> {
  if (!isValidCanvasFileName(oldFilePath) || !isValidCanvasFileName(newFilePath)) {
    return fail('Invalid file path.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const srcPath = getCanvasFilePath(projectDataDir, oldFilePath);
  const destPath = getCanvasFilePath(projectDataDir, newFilePath);
  try {
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });
    await fs.rename(srcPath, destPath);
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
