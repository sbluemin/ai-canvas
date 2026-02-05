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

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  showSaveDialog: () => ipcRenderer.invoke('dialog:showSaveDialog'),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  
  gemini: {
    authStart: (): Promise<AuthResult> => ipcRenderer.invoke('gemini:auth:start'),
    authStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('gemini:auth:status'),
    authLogout: (): Promise<AuthResult> => ipcRenderer.invoke('gemini:auth:logout'),
    chat: (prompt: string): Promise<ChatResponse> => ipcRenderer.invoke('gemini:chat', prompt),
    onChatChunk: (callback: (chunk: ChatChunk) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, chunk: ChatChunk) => callback(chunk);
      ipcRenderer.on('gemini:chat:chunk', listener);
      return () => ipcRenderer.removeListener('gemini:chat:chunk', listener);
    },
  },

  codex: {
    authStart: (): Promise<AuthResult> => ipcRenderer.invoke('codex:auth:start'),
    authStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('codex:auth:status'),
    authLogout: (): Promise<AuthResult> => ipcRenderer.invoke('codex:auth:logout'),
    chat: (prompt: string): Promise<ChatResponse> => ipcRenderer.invoke('codex:chat', prompt),
    onChatChunk: (callback: (chunk: ChatChunk) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, chunk: ChatChunk) => callback(chunk);
      ipcRenderer.on('codex:chat:chunk', listener);
      return () => ipcRenderer.removeListener('codex:chat:chunk', listener);
    },
  },

  anthropic: {
    authStart: (): Promise<AuthResult> => ipcRenderer.invoke('anthropic:auth:start'),
    authStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('anthropic:auth:status'),
    authLogout: (): Promise<AuthResult> => ipcRenderer.invoke('anthropic:auth:logout'),
  },
});
