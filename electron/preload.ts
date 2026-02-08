import { contextBridge, ipcRenderer } from 'electron';

export interface AuthStatus {
  isAuthenticated: boolean;
  expiresAt?: number;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}

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

export type AiProvider = 'gemini' | 'openai' | 'anthropic';

export interface AiChatRequest {
  runId: string;
  provider: AiProvider;
  prompt: string;
  history: { role: 'user' | 'assistant'; content: string; provider?: AiProvider }[];
  canvasContent: string;
  modelId?: string;
  selection?: {
    text: string;
    before: string;
    after: string;
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
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  
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

  gemini: {
    authStart: (): Promise<AuthResult> => ipcRenderer.invoke('gemini:auth:start'),
    authStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('gemini:auth:status'),
    authLogout: (): Promise<AuthResult> => ipcRenderer.invoke('gemini:auth:logout'),
  },

  codex: {
    authStart: (): Promise<AuthResult> => ipcRenderer.invoke('codex:auth:start'),
    authStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('codex:auth:status'),
    authLogout: (): Promise<AuthResult> => ipcRenderer.invoke('codex:auth:logout'),
  },

  anthropic: {
    authStart: (): Promise<AuthResult> => ipcRenderer.invoke('anthropic:auth:start'),
    authStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('anthropic:auth:status'),
    authLogout: (): Promise<AuthResult> => ipcRenderer.invoke('anthropic:auth:logout'),
  },

  project: {
    openDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('project:open-directory'),
    initCanvasDir: (projectPath: string): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('project:init-canvas-dir', projectPath),
    listCanvasFiles: (projectPath: string): Promise<{ success: boolean; files?: string[]; error?: string }> =>
      ipcRenderer.invoke('project:list-canvas-files', projectPath),
    readCanvasFile: (projectPath: string, fileName: string): Promise<{ success: boolean; content?: string; error?: string }> =>
      ipcRenderer.invoke('project:read-canvas-file', projectPath, fileName),
    writeCanvasFile: (projectPath: string, fileName: string, content: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:write-canvas-file', projectPath, fileName, content),
    createDefaultCanvas: (projectPath: string): Promise<{ success: boolean; fileName?: string; error?: string }> =>
      ipcRenderer.invoke('project:create-default-canvas', projectPath),
  },
});
