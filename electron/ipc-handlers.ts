import { app, BrowserWindow, dialog, type IpcMainInvokeEvent, shell } from 'electron';
import Store from 'electron-store';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AI_CANVAS_DIR, handleIpc } from './utils';
import { executeAiChatWorkflow } from './ai-workflow';
import type { AiChatRequest } from './ai-types';
import { fetchModelsFromApi } from './ai-models';
import { exportDocument } from './export.service';
import * as projectService from './project.service';
import * as runtimeService from './runtime.service';

export type ThemeMode = 'dark' | 'light' | 'system';

type AppSettingsStoreSchema = {
  theme?: ThemeMode;
};

const appSettingsStore = new Store<AppSettingsStoreSchema>({ name: 'app-settings' });

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function readStoredThemeMode(): ThemeMode {
  const theme = appSettingsStore.get('theme');
  return isThemeMode(theme) ? theme : 'dark';
}

export function registerIpcHandlers(
  createWindow: () => BrowserWindow,
  onThemeChanged?: (theme: ThemeMode) => void,
) {
  handleIpc('project:open-directory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Select Project Folder' });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  handleIpc('project:init-canvas-dir', async (_event: any, projectPath: string) => {
    const result = await projectService.initCanvasDir(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, path: result.data!.path };
  });

  handleIpc('project:list-features', async (_event: any, projectPath: string) => {
    const result = await projectService.listFeatures(projectPath);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, features: result.data!.features };
  });

  handleIpc('project:create-feature', async (_event: any, projectPath: string, featureId: string, name: string) => {
    const result = await projectService.createFeature(projectPath, featureId, name);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, feature: result.data!.feature };
  });

  handleIpc('project:rename-feature', async (_event: any, projectPath: string, oldFeatureId: string, newFeatureId: string) => {
    return projectService.renameFeature(projectPath, oldFeatureId, newFeatureId);
  });

  handleIpc('project:delete-feature', async (_event: any, projectPath: string, featureId: string) => {
    return projectService.deleteFeature(projectPath, featureId);
  });

  handleIpc('project:read-feature-meta', async (_event: any, projectPath: string, featureId: string) => {
    const result = await projectService.readFeatureMeta(projectPath, featureId);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, meta: result.data!.meta };
  });

  handleIpc('project:write-feature-meta', async (_event: any, projectPath: string, featureId: string, meta: unknown) => {
    return projectService.writeFeatureMeta(projectPath, featureId, meta as projectService.FeatureMeta);
  });

  handleIpc('project:list-feature-canvas-files', async (_event: any, projectPath: string, featureId: string) => {
    const result = await projectService.listFeatureCanvasFiles(projectPath, featureId);
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

  handleIpc('project:create-canvas-folder', async (_event: any, projectPath: string, folderPath: string) => {
    return projectService.createCanvasFolder(projectPath, folderPath);
  });

  handleIpc('project:delete-canvas-folder', async (_event: any, projectPath: string, folderPath: string) => {
    return projectService.deleteCanvasFolder(projectPath, folderPath);
  });

  handleIpc('project:rename-canvas-folder', async (_event: any, projectPath: string, oldFolderPath: string, newFolderPath: string) => {
    return projectService.renameCanvasFolder(projectPath, oldFolderPath, newFolderPath);
  });

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

  handleIpc('project:read-chat-session', async (_event: any, projectPath: string, featureId: string) => {
    const result = await projectService.readChatSession(projectPath, featureId);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, messages: result.data!.messages };
  });

  handleIpc('project:write-chat-session', async (_event: any, projectPath: string, featureId: string, messages: unknown[]) => {
    return projectService.writeChatSession(projectPath, featureId, messages);
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

  handleIpc('project:save-image-asset', async (_event: any, projectPath: string, base64: string, mimeType: string) => {
    const result = await projectService.saveImageAsset(projectPath, base64, mimeType);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, relativePath: result.data!.relativePath, absolutePath: result.data!.absolutePath };
  });

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

  handleIpc('project:import-share-bundle', async (_event: IpcMainInvokeEvent) => {
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

  handleIpc('project:open-in-explorer', async (_event: any, projectPath: string) => {
    try {
      await shell.openPath(projectPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  handleIpc('ai:chat', async (event: any, request: AiChatRequest) => {
    await executeAiChatWorkflow(event, request);
    return { success: true };
  });

  handleIpc('ai:fetch-models', async () => {
    const models = await fetchModelsFromApi();
    return { success: true, models };
  });

  handleIpc('settings:read', async () => {
    return {
      success: true,
      settings: {
        theme: readStoredThemeMode(),
      },
    };
  });

  handleIpc('settings:write', async (_event: unknown, settings: { theme?: unknown }) => {
    if (!isThemeMode(settings?.theme)) {
      return { success: false, error: 'Invalid theme value' };
    }

    appSettingsStore.set('theme', settings.theme);
    onThemeChanged?.(settings.theme);
    return { success: true };
  });

  handleIpc('runtime:check-status', async (_event: unknown, projectPath: string | null) => {
    return runtimeService.checkRuntimeStatus(projectPath);
  });

  handleIpc('runtime:set-mode', async (_event: unknown, projectPath: string, mode: 'auto' | 'local' | 'global') => {
    return runtimeService.setRuntimeMode(projectPath, mode);
  });

  handleIpc('runtime:install-local', async (event, projectPath: string) => {
    return runtimeService.installLocalRuntime(projectPath, (progress) => {
      event.sender.send('runtime:install-progress', progress);
    });
  });

  handleIpc('runtime:open-auth-terminal', async (event, projectPath: string | null) => {
    return runtimeService.openAuthTerminal(projectPath, async (result) => {
      if (!result.success) {
        event.sender.send('runtime:models-refreshed', { success: false, error: result.error });
        return;
      }

      try {
        await runtimeService.checkRuntimeStatus(projectPath);
        const models = await fetchModelsFromApi();
        event.sender.send('runtime:models-refreshed', { success: true, models });
      } catch (error) {
        event.sender.send('runtime:models-refreshed', {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  });

  handleIpc('runtime:open-terminal', async (_event, projectPath: string | null) => {
    return runtimeService.openRuntimeTerminal(projectPath);
  });

  handleIpc('runtime:complete-onboarding', async (_event: unknown, projectPath: string) => {
    return runtimeService.completeRuntimeOnboarding(projectPath);
  });

  handleIpc('runtime:clear-context', async () => {
    runtimeService.clearRuntimeContext();
    return { success: true };
  });

  handleIpc('window:show-emoji-panel', async () => {
    app.showEmojiPanel();
    return { success: true };
  });
}
