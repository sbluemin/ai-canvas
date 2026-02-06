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

export type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'copilot';

export interface AiChatRequest {
  runId: string;
  provider: AiProvider;
  prompt: string;
  history: { role: 'user' | 'assistant'; content: string; provider?: AiProvider }[];
  canvasContent: string;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
}

export type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
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

  copilot: {
    authStart: (): Promise<AuthResult> => ipcRenderer.invoke('copilot:auth:start'),
    authStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('copilot:auth:status'),
    authLogout: (): Promise<AuthResult> => ipcRenderer.invoke('copilot:auth:logout'),
  },
});
