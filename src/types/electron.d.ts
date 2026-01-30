interface ElectronAPI {
  platform: NodeJS.Platform;
  showSaveDialog: () => Promise<string | null>;
  showOpenDialog: () => Promise<string | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
