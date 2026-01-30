import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  showSaveDialog: () => ipcRenderer.invoke('dialog:showSaveDialog'),
  showOpenDialog: () => ipcRenderer.invoke('dialog:showOpenDialog'),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
});
