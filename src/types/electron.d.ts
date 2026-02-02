interface AuthStatus {
  isAuthenticated: boolean;
  expiresAt?: number;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

interface ChatResponse {
  success: boolean;
  content?: string;
  error?: string;
}

interface ChatChunk {
  text?: string;
  error?: string;
  done?: boolean;
}

interface GeminiAPI {
  authStart: () => Promise<AuthResult>;
  authStatus: () => Promise<AuthStatus>;
  authLogout: () => Promise<AuthResult>;
  chat: (prompt: string) => Promise<ChatResponse>;
  onChatChunk: (callback: (chunk: ChatChunk) => void) => () => void;
}

interface ElectronAPI {
  platform: NodeJS.Platform;
  showSaveDialog: () => Promise<string | null>;
  showOpenDialog: () => Promise<string | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<string>;
  gemini: GeminiAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
