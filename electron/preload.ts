import { contextBridge, ipcRenderer } from 'electron';

export interface ChatResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export interface ChatChunk {
  text?: string;
  error?: string;
  done?: boolean;
}

export type AiProvider = 'opencode';

export interface AiChatRequest {
  runId: string;
  prompt: string;
  history: { role: 'user' | 'assistant'; content: string; provider?: AiProvider }[];
  canvasContent: string;
  modelId?: string;
  variant?: string;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
  writingGoal?: {
    purpose: string;
    audience: string;
    tone: string;
    targetLength: 'short' | 'medium' | 'long';
  };
  fileMentions?: {
    id: string;
    fileName: string;
    filePath: string;
  }[];
}

export type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase_message_stream'; phase: 'evaluating' | 'updating'; message: string }
  | { runId: string; type: 'phase1_result'; message: string; needsCanvasUpdate: boolean; updatePlan?: string }
  | { runId: string; type: 'phase2_result'; message: string; canvasContent: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };

type ThemeMode = 'dark' | 'light' | 'system';
type RuntimeMode = 'auto' | 'local' | 'global';

interface RuntimeStatus {
  mode: RuntimeMode;
  activeRuntime: 'local' | 'global' | 'none';
  localInstalled: boolean;
  globalInstalled: boolean;
  onboardingDone: boolean;
  localBinaryPath: string;
  configDir: string;
}

interface RuntimeInstallProgress {
  projectPath: string;
  phase: 'downloading' | 'extracting' | 'finalizing' | 'done' | 'error';
  percent: number;
  receivedBytes?: number;
  totalBytes?: number;
}

interface RuntimeModelsRefreshedEvent {
  success: boolean;
  models?: Record<string, unknown[]>;
  error?: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  ai: {
    chat: (request: AiChatRequest): Promise<{ success: boolean; error?: string }> => 
      ipcRenderer.invoke('ai:chat', request),
    fetchModels: (): Promise<{ success: boolean; models?: Record<string, unknown[]>; error?: string }> =>
      ipcRenderer.invoke('ai:fetch-models'),
    onChatEvent: (callback: (event: AiChatEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, evt: AiChatEvent) => callback(evt);
      ipcRenderer.on('ai:chat:event', listener);
      return () => ipcRenderer.removeListener('ai:chat:event', listener);
    },
  },

  project: {
    openDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('project:open-directory'),
    initCanvasDir: (projectPath: string): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('project:init-canvas-dir', projectPath),
    listFeatures: (projectPath: string): Promise<{ success: boolean; features?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('project:list-features', projectPath),
    createFeature: (projectPath: string, featureId: string, name: string): Promise<{ success: boolean; feature?: unknown; error?: string }> =>
      ipcRenderer.invoke('project:create-feature', projectPath, featureId, name),
    renameFeature: (projectPath: string, oldFeatureId: string, newFeatureId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:rename-feature', projectPath, oldFeatureId, newFeatureId),
    deleteFeature: (projectPath: string, featureId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:delete-feature', projectPath, featureId),
    readFeatureMeta: (projectPath: string, featureId: string): Promise<{ success: boolean; meta?: unknown; error?: string }> =>
      ipcRenderer.invoke('project:read-feature-meta', projectPath, featureId),
    writeFeatureMeta: (projectPath: string, featureId: string, meta: unknown): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:write-feature-meta', projectPath, featureId, meta),
    listFeatureCanvasFiles: (projectPath: string, featureId: string): Promise<{ success: boolean; files?: string[]; error?: string }> =>
      ipcRenderer.invoke('project:list-feature-canvas-files', projectPath, featureId),
    readWorkspace: (projectPath: string): Promise<{ success: boolean; workspace?: unknown; error?: string }> =>
      ipcRenderer.invoke('project:read-workspace', projectPath),
    writeWorkspace: (projectPath: string, workspace: unknown): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:write-workspace', projectPath, workspace),
    readAutosaveStatus: (projectPath: string): Promise<{ success: boolean; status?: unknown; error?: string }> =>
      ipcRenderer.invoke('project:read-autosave-status', projectPath),
    writeAutosaveStatus: (projectPath: string, status: unknown): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:write-autosave-status', projectPath, status),
    readCanvasFile: (projectPath: string, fileName: string): Promise<{ success: boolean; content?: string; error?: string }> =>
      ipcRenderer.invoke('project:read-canvas-file', projectPath, fileName),
    writeCanvasFile: (projectPath: string, fileName: string, content: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:write-canvas-file', projectPath, fileName, content),
    renameCanvasFile: (projectPath: string, oldFileName: string, newFileName: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:rename-canvas-file', projectPath, oldFileName, newFileName),
    deleteCanvasFile: (projectPath: string, fileName: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:delete-canvas-file', projectPath, fileName),
    readChatSession: (projectPath: string, featureId: string): Promise<{ success: boolean; messages?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('project:read-chat-session', projectPath, featureId),
    writeChatSession: (projectPath: string, featureId: string, messages: unknown[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:write-chat-session', projectPath, featureId, messages),
    saveImageAsset: (projectPath: string, base64: string, mimeType: string): Promise<{ success: boolean; relativePath?: string; absolutePath?: string; error?: string }> =>
      ipcRenderer.invoke('project:save-image-asset', projectPath, base64, mimeType),
    exportDocument: (projectPath: string, format: 'html' | 'pdf' | 'docx', markdownContent: string): Promise<{ success: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke('project:export-document', projectPath, format, markdownContent),
    exportShareBundle: (projectPath: string, bundle: unknown): Promise<{ success: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke('project:export-share-bundle', projectPath, bundle),
    importShareBundle: (): Promise<{ success: boolean; bundle?: unknown; error?: string }> =>
      ipcRenderer.invoke('project:import-share-bundle'),
    createDefaultCanvas: (projectPath: string): Promise<{ success: boolean; fileName?: string; error?: string }> =>
      ipcRenderer.invoke('project:create-default-canvas', projectPath),
    openInExplorer: (projectPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:open-in-explorer', projectPath),
    listCanvasTree: (projectPath: string): Promise<{ success: boolean; tree?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('project:list-canvas-tree', projectPath),
    listProjectFiles: (projectPath: string): Promise<{ success: boolean; files?: string[]; error?: string }> =>
      ipcRenderer.invoke('project:list-project-files', projectPath),
    createCanvasFolder: (projectPath: string, folderPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:create-canvas-folder', projectPath, folderPath),
    deleteCanvasFolder: (projectPath: string, folderPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:delete-canvas-folder', projectPath, folderPath),
    moveCanvasFile: (projectPath: string, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:move-canvas-file', projectPath, oldPath, newPath),
    renameCanvasFolder: (projectPath: string, oldFolderPath: string, newFolderPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:rename-canvas-folder', projectPath, oldFolderPath, newFolderPath),
  },
  settings: {
    read: (): Promise<{ success: boolean; settings?: { theme: ThemeMode }; error?: string }> =>
      ipcRenderer.invoke('settings:read'),
    write: (settings: { theme: ThemeMode }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('settings:write', settings),
  },
  runtime: {
    checkStatus: (projectPath: string | null): Promise<{ success: boolean; data?: RuntimeStatus; error?: string }> =>
      ipcRenderer.invoke('runtime:check-status', projectPath),
    setMode: (projectPath: string, mode: RuntimeMode): Promise<{ success: boolean; data?: RuntimeStatus; error?: string }> =>
      ipcRenderer.invoke('runtime:set-mode', projectPath, mode),
    installLocal: (projectPath: string): Promise<{ success: boolean; data?: RuntimeStatus; error?: string }> =>
      ipcRenderer.invoke('runtime:install-local', projectPath),
    openAuthTerminal: (projectPath: string | null): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('runtime:open-auth-terminal', projectPath),
    openTerminal: (projectPath: string | null): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('runtime:open-terminal', projectPath),
    completeOnboarding: (projectPath: string): Promise<{ success: boolean; data?: RuntimeStatus; error?: string }> =>
      ipcRenderer.invoke('runtime:complete-onboarding', projectPath),
    clearContext: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('runtime:clear-context'),
    onInstallProgress: (callback: (progress: RuntimeInstallProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: RuntimeInstallProgress) => callback(progress);
      ipcRenderer.on('runtime:install-progress', listener);
      return () => ipcRenderer.removeListener('runtime:install-progress', listener);
    },
    onModelsRefreshed: (callback: (event: RuntimeModelsRefreshedEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: RuntimeModelsRefreshedEvent) => callback(payload);
      ipcRenderer.on('runtime:models-refreshed', listener);
      return () => ipcRenderer.removeListener('runtime:models-refreshed', listener);
    },
  },
  window: {
    showEmojiPanel: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('window:show-emoji-panel'),
  },
});
