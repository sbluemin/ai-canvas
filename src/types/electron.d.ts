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

type AiProvider = 'gemini' | 'openai' | 'anthropic';

interface AiChatRequest {
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

type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase_message_stream'; phase: 'evaluating' | 'updating'; message: string }
  | { runId: string; type: 'phase1_result'; message: string; needsCanvasUpdate: boolean; updatePlan?: string }
  | { runId: string; type: 'phase2_result'; message: string; canvasContent: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };

interface ModelInfo {
  id: string;
  name: string;
  family?: string;
  releaseDate?: string;
  knowledge?: string;
  cost?: {
    input?: number;
    output?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
}

type AiProviderModels = Record<AiProvider, ModelInfo[]>;

interface AiAPI {
  chat: (request: AiChatRequest) => Promise<{ success: boolean; error?: string }>;
  fetchModels: () => Promise<{ success: boolean; models?: AiProviderModels; error?: string }>;
  onChatEvent: (callback: (event: AiChatEvent) => void) => () => void;
}

interface AuthOnlyProviderAPI {
  authStart: () => Promise<AuthResult>;
  authStatus: () => Promise<AuthStatus>;
  authLogout: () => Promise<AuthResult>;
}

interface ElectronAPI {
  platform: NodeJS.Platform;
  showSaveDialog: () => Promise<string | null>;
  showOpenDialog: () => Promise<string | null>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<string>;
  ai: AiAPI;
  gemini: AuthOnlyProviderAPI;
  codex: AuthOnlyProviderAPI;
  anthropic: AuthOnlyProviderAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
