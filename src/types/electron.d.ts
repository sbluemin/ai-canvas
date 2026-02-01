interface ChatChunkData {
  text?: string;
  error?: string;
  done?: boolean;
}

interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  system?: string;
}

interface ElectronAPI {
  platform: NodeJS.Platform;
  showSaveDialog: () => Promise<string | null>;
  showOpenDialog: () => Promise<string | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<string>;
  chatStream: (prompt: string, history?: ChatHistory[], options?: ChatOptions) => Promise<{ success: boolean; error?: string }>;
  onChatChunk: (callback: (data: ChatChunkData) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
