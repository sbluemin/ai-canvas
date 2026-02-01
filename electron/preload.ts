import { contextBridge, ipcRenderer } from 'electron';

export interface ChatChunkData {
  text?: string;
  error?: string;
  done?: boolean;
}

export interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  showSaveDialog: () => ipcRenderer.invoke('dialog:showSaveDialog'),
  showOpenDialog: () => ipcRenderer.invoke('dialog:showOpenDialog'),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  
  chatStream: (prompt: string, history: ChatHistory[] = []) => ipcRenderer.invoke('chat:stream', prompt, history),
  onChatChunk: (callback: (data: ChatChunkData) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ChatChunkData) => callback(data);
    ipcRenderer.on('chat:chunk', handler);
    return () => ipcRenderer.removeListener('chat:chunk', handler);
  },
});
