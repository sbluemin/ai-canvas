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

interface ProjectAPI {
  openDirectory: () => Promise<string | null>;
  initCanvasDir: (projectPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  listCanvasFiles: (projectPath: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
  readWorkspace: (projectPath: string) => Promise<{ success: boolean; workspace?: unknown; error?: string }>;
  writeWorkspace: (projectPath: string, workspace: unknown) => Promise<{ success: boolean; error?: string }>;
  readAutosaveStatus: (projectPath: string) => Promise<{ success: boolean; status?: unknown; error?: string }>;
  writeAutosaveStatus: (projectPath: string, status: unknown) => Promise<{ success: boolean; error?: string }>;
  readCanvasFile: (projectPath: string, fileName: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeCanvasFile: (projectPath: string, fileName: string, content: string) => Promise<{ success: boolean; error?: string }>;
  renameCanvasFile: (projectPath: string, oldFileName: string, newFileName: string) => Promise<{ success: boolean; error?: string }>;
  deleteCanvasFile: (projectPath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
  readChatSession: (projectPath: string) => Promise<{ success: boolean; messages?: unknown[]; error?: string }>;
  writeChatSession: (projectPath: string, messages: unknown[]) => Promise<{ success: boolean; error?: string }>;
  saveImageAsset: (projectPath: string, base64: string, mimeType: string) => Promise<{ success: boolean; relativePath?: string; absolutePath?: string; error?: string }>;
  exportDocument: (projectPath: string, format: 'html' | 'pdf' | 'docx', markdownContent: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  exportShareBundle: (projectPath: string, bundle: unknown) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  importShareBundle: () => Promise<{ success: boolean; bundle?: unknown; error?: string }>;
  createDefaultCanvas: (projectPath: string) => Promise<{ success: boolean; fileName?: string; error?: string }>;
  openInExplorer: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
}

interface WindowAPI {
  create: () => Promise<{ success: boolean; error?: string }>;
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
  project: ProjectAPI;
  window: WindowAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
