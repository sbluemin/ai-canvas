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
}

export type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase_message_stream'; phase: 'evaluating' | 'updating'; message: string }
  | { runId: string; type: 'phase1_result'; message: string; needsCanvasUpdate: boolean; updatePlan?: string }
  | { runId: string; type: 'phase2_result'; message: string; canvasContent: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  showSaveDialog: () => ipcRenderer.invoke('dialog:showSaveDialog'),
  showOpenDialog: () => ipcRenderer.invoke('dialog:showOpenDialog'),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  
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
    listCanvasFiles: (projectPath: string): Promise<{ success: boolean; files?: string[]; error?: string }> =>
      ipcRenderer.invoke('project:list-canvas-files', projectPath),
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
    readChatSession: (projectPath: string): Promise<{ success: boolean; messages?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('project:read-chat-session', projectPath),
    writeChatSession: (projectPath: string, messages: unknown[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:write-chat-session', projectPath, messages),
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
    createCanvasFolder: (projectPath: string, folderPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:create-canvas-folder', projectPath, folderPath),
    deleteCanvasFolder: (projectPath: string, folderPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:delete-canvas-folder', projectPath, folderPath),
    moveCanvasFile: (projectPath: string, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:move-canvas-file', projectPath, oldPath, newPath),
    renameCanvasFolder: (projectPath: string, oldFolderPath: string, newFolderPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:rename-canvas-folder', projectPath, oldFolderPath, newFolderPath),
    readVersionHistory: (projectPath: string): Promise<{ success: boolean; snapshots?: unknown[]; error?: string }> =>
      ipcRenderer.invoke('project:read-version-history', projectPath),
    writeVersionHistory: (projectPath: string, snapshots: unknown[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:write-version-history', projectPath, snapshots),
  },
  window: {
    create: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('window:create'),
  },
});
