/**
 * project IPC 핸들러 — 얇은 라우팅 레이어
 *
 * 비즈니스 로직은 services/project.service.ts에 위임하고,
 * 이 파일은 IPC 채널 등록과 Electron API(dialog, shell) 호출만 담당한다.
 */
import { dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { handleIpc, AI_CANVAS_DIR } from '../core';
import { exportDocument } from '../services/export.service';
import * as projectService from '../services/project.service';

export function registerProjectHandlers() {
  // ─── 디렉토리 선택 (Electron dialog API) ───

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

  // ─── 캔버스 디렉토리 초기화 ───

  handleIpc('project:init-canvas-dir', async (_event: any, projectPath: string) => {
    const result = await projectService.initCanvasDir(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, path: result.data!.path };
  });

  // ─── 파일 목록 ───

  handleIpc('project:list-canvas-files', async (_event: any, projectPath: string) => {
    const result = await projectService.listCanvasFiles(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, files: result.data!.files };
  });

  handleIpc('project:list-canvas-tree', async (_event: any, projectPath: string) => {
    const result = await projectService.listCanvasTree(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, tree: result.data!.tree };
  });

  handleIpc('project:list-project-files', async (_event: any, projectPath: string) => {
    const result = await projectService.listProjectFiles(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, files: result.data!.files };
  });

  // ─── 폴더 CRUD ───

  handleIpc('project:create-canvas-folder', async (_event: any, projectPath: string, folderPath: string) => {
    return projectService.createCanvasFolder(projectPath, folderPath);
  });

  handleIpc('project:delete-canvas-folder', async (_event: any, projectPath: string, folderPath: string) => {
    return projectService.deleteCanvasFolder(projectPath, folderPath);
  });

  handleIpc('project:rename-canvas-folder', async (_event: any, projectPath: string, oldFolderPath: string, newFolderPath: string) => {
    return projectService.renameCanvasFolder(projectPath, oldFolderPath, newFolderPath);
  });

  // ─── 파일 CRUD ───

  handleIpc('project:read-canvas-file', async (_event: any, projectPath: string, fileName: string) => {
    const result = await projectService.readCanvasFile(projectPath, fileName);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, content: result.data!.content };
  });

  handleIpc('project:write-canvas-file', async (_event: any, projectPath: string, fileName: string, content: string) => {
    return projectService.writeCanvasFile(projectPath, fileName, content);
  });

  handleIpc('project:rename-canvas-file', async (_event: any, projectPath: string, oldFileName: string, newFileName: string) => {
    return projectService.renameCanvasFile(projectPath, oldFileName, newFileName);
  });

  handleIpc('project:delete-canvas-file', async (_event: any, projectPath: string, fileName: string) => {
    return projectService.deleteCanvasFile(projectPath, fileName);
  });

  handleIpc('project:move-canvas-file', async (_event: any, projectPath: string, oldPath: string, newPath: string) => {
    return projectService.moveCanvasFile(projectPath, oldPath, newPath);
  });

  handleIpc('project:create-default-canvas', async (_event: any, projectPath: string) => {
    const result = await projectService.createDefaultCanvas(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, fileName: result.data!.fileName };
  });

  // ─── 세션/워크스페이스/자동저장 ───

  handleIpc('project:read-chat-session', async (_event: any, projectPath: string) => {
    const result = await projectService.readChatSession(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, messages: result.data!.messages };
  });

  handleIpc('project:write-chat-session', async (_event: any, projectPath: string, messages: unknown[]) => {
    return projectService.writeChatSession(projectPath, messages);
  });

  handleIpc('project:read-workspace', async (_event: any, projectPath: string) => {
    const result = await projectService.readWorkspace(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, workspace: result.data!.workspace };
  });

  handleIpc('project:write-workspace', async (_event: any, projectPath: string, workspace: unknown) => {
    return projectService.writeWorkspace(projectPath, workspace);
  });

  handleIpc('project:read-autosave-status', async (_event: any, projectPath: string) => {
    const result = await projectService.readAutosaveStatus(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, status: result.data!.status };
  });

  handleIpc('project:write-autosave-status', async (_event: any, projectPath: string, status: unknown) => {
    return projectService.writeAutosaveStatus(projectPath, status);
  });

  // ─── 이미지 에셋 ───

  handleIpc('project:save-image-asset', async (_event: any, projectPath: string, base64: string, mimeType: string) => {
    const result = await projectService.saveImageAsset(projectPath, base64, mimeType);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, relativePath: result.data!.relativePath, absolutePath: result.data!.absolutePath };
  });

  // ─── Export (dialog + 서비스 조합) ───

  handleIpc('project:export-document', async (_event: any, projectPath: string, format: 'html' | 'pdf' | 'docx', markdownContent: string) => {
    const defaultName = `canvas-export-${Date.now()}`;
    const ext = format === 'pdf' ? 'pdf' : format === 'docx' ? 'docx' : 'html';

    const dialogResult = await dialog.showSaveDialog({
      title: 'Export Document',
      defaultPath: path.join(projectPath, `${defaultName}.${ext}`),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { success: false, error: 'User cancelled the export.' };
    }

    return exportDocument(dialogResult.filePath, format, markdownContent);
  });

  // ─── Share Bundle (Electron dialog + 파일 I/O) ───

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
      return { success: false, error: error instanceof Error ? error.message : String(error) };
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
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ─── 탐색기 열기 ───

  handleIpc('project:open-in-explorer', async (_event: any, projectPath: string) => {
    try {
      await shell.openPath(projectPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
