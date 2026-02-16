/**
 * 프로젝트 서비스 — 캔버스 파일 시스템 비즈니스 로직
 *
 * IPC 핸들러에서 비즈니스 로직을 분리하여,
 * 핸들러는 얇은 라우팅 레이어로만 동작하도록 한다.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import {
  AI_CANVAS_DIR,
  DEFAULT_CANVAS_NAME,
  DEFAULT_CANVAS_CONTENT,
  ASSET_DIR_NAME,
  getCanvasFilePath,
  getCanvasFolderPath,
  isValidCanvasFileName,
  isValidCanvasFolderPath,
  getChatSessionPath,
  getWorkspacePath,
  getAutosaveStatusPath,
  getAssetsDirPath,
} from '../core';

// ─── 결과 타입 ───

export interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

function ok<T>(data?: T): ServiceResult<T> {
  return { success: true, data };
}

function fail<T = void>(error: string): ServiceResult<T> {
  return { success: false, error };
}

// ─── 캔버스 디렉토리 ───

export async function initCanvasDir(projectPath: string): Promise<ServiceResult<{ path: string }>> {
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  try {
    await fs.mkdir(canvasDir, { recursive: true });
    return ok({ path: canvasDir });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

// ─── 캔버스 파일 목록 ───

export async function listCanvasFiles(projectPath: string): Promise<ServiceResult<{ files: string[] }>> {
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  try {
    const entries = await fs.readdir(canvasDir, { withFileTypes: true });
    const mdFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name);
    return ok({ files: mdFiles });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ files: [] });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

// ─── 캔버스 트리 구조 ───

interface TreeEntry {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: TreeEntry[];
}

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

export async function listCanvasTree(projectPath: string): Promise<ServiceResult<{ tree: TreeEntry[] }>> {
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  try {
    const tree = await readDirRecursive(canvasDir, '');
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

// ─── 캔버스 폴더 CRUD ───

export async function createCanvasFolder(projectPath: string, folderPath: string): Promise<ServiceResult> {
  if (!isValidCanvasFolderPath(folderPath)) {
    return fail('Invalid folder path.');
  }
  const fullPath = getCanvasFolderPath(projectPath, folderPath);
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
  const fullPath = getCanvasFolderPath(projectPath, folderPath);
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
  const oldFullPath = getCanvasFolderPath(projectPath, oldFolderPath);
  const newFullPath = getCanvasFolderPath(projectPath, newFolderPath);
  try {
    await fs.rename(oldFullPath, newFullPath);
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

// ─── 캔버스 파일 CRUD ───

export async function readCanvasFile(projectPath: string, fileName: string): Promise<ServiceResult<{ content: string }>> {
  if (!isValidCanvasFileName(fileName)) {
    return fail('Invalid file name.');
  }
  const filePath = getCanvasFilePath(projectPath, fileName);
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
  const filePath = getCanvasFilePath(projectPath, fileName);
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
  const oldPath = getCanvasFilePath(projectPath, oldFileName);
  const newPath = getCanvasFilePath(projectPath, newFileName);
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
  const filePath = getCanvasFilePath(projectPath, fileName);
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
  const srcPath = getCanvasFilePath(projectPath, oldFilePath);
  const destPath = getCanvasFilePath(projectPath, newFilePath);
  try {
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });
    await fs.rename(srcPath, destPath);
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function createDefaultCanvas(projectPath: string): Promise<ServiceResult<{ fileName: string }>> {
  const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
  const filePath = path.join(canvasDir, DEFAULT_CANVAS_NAME);
  try {
    await fs.mkdir(canvasDir, { recursive: true });
    await fs.writeFile(filePath, DEFAULT_CANVAS_CONTENT, 'utf-8');
    return ok({ fileName: DEFAULT_CANVAS_NAME });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

// ─── 영속화 데이터 (session, workspace, autosave) ───

export async function readChatSession(projectPath: string): Promise<ServiceResult<{ messages: unknown[] }>> {
  const filePath = getChatSessionPath(projectPath);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return ok({ messages: [] });
    }
    return ok({ messages: parsed });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ messages: [] });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function writeChatSession(projectPath: string, messages: unknown[]): Promise<ServiceResult> {
  const filePath = getChatSessionPath(projectPath);
  try {
    const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
    await fs.mkdir(canvasDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(messages), 'utf-8');
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function readWorkspace(projectPath: string): Promise<ServiceResult<{ workspace: unknown }>> {
  const workspacePath = getWorkspacePath(projectPath);
  try {
    const raw = await fs.readFile(workspacePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return ok({ workspace: parsed });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ workspace: null });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function writeWorkspace(projectPath: string, workspace: unknown): Promise<ServiceResult> {
  const workspacePath = getWorkspacePath(projectPath);
  try {
    const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
    await fs.mkdir(canvasDir, { recursive: true });
    await fs.writeFile(workspacePath, JSON.stringify(workspace), 'utf-8');
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function readAutosaveStatus(projectPath: string): Promise<ServiceResult<{ status: unknown }>> {
  const autosaveStatusPath = getAutosaveStatusPath(projectPath);
  try {
    const raw = await fs.readFile(autosaveStatusPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return ok({ status: parsed });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ status: null });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function writeAutosaveStatus(projectPath: string, status: unknown): Promise<ServiceResult> {
  const autosaveStatusPath = getAutosaveStatusPath(projectPath);
  try {
    const canvasDir = path.join(projectPath, AI_CANVAS_DIR);
    await fs.mkdir(canvasDir, { recursive: true });
    await fs.writeFile(autosaveStatusPath, JSON.stringify(status), 'utf-8');
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

// ─── 이미지 에셋 ───

export async function saveImageAsset(
  projectPath: string,
  base64: string,
  mimeType: string
): Promise<ServiceResult<{ relativePath: string; absolutePath: string }>> {
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

    return ok({
      relativePath: `${ASSET_DIR_NAME}/${fileName}`,
      absolutePath: fullPath,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
