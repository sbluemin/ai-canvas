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

type AiProvider = 'pi';

interface AiChatRequest {
  runId: string;
  prompt: string;
  history: { role: 'user' | 'assistant'; content: string; provider?: AiProvider }[];
  canvasContent: string;
  modelId?: string;
  variant?: string;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
  writingGoal?: {
    purpose: string;
    audience: string;
    tone: string;
    targetLength: 'short' | 'medium' | 'long';
  };
  fileMentions?: {
    id: string;
    fileName: string;
    filePath: string;
  }[];
}

type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase_message_stream'; phase: 'evaluating' | 'updating'; message: string }
  | {
      runId: string;
      type: 'thinking_stream';
      phase: 'evaluating' | 'updating';
      activity:
        | { kind: 'thought'; text: string }
        | { kind: 'step'; label: string; tool?: string; target?: string }
        | { kind: 'step_finish' };
    }
  | { runId: string; type: 'canvas_content_stream'; content: string }
  | { runId: string; type: 'chat_result'; message: string; canvasContent?: string; doneMessage?: string }
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

type AiProviderModels = Record<'pi', ModelInfo[]>;

interface AiAPI {
  chat: (request: AiChatRequest) => Promise<{ success: boolean; error?: string }>;
  fetchModels: () => Promise<{ success: boolean; models?: AiProviderModels; error?: string }>;
  onChatEvent: (callback: (event: AiChatEvent) => void) => () => void;
}

interface ProjectAPI {
  openDirectory: () => Promise<string | null>;
  initCanvasDir: (projectPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  listFeatures: (projectPath: string) => Promise<{ success: boolean; features?: unknown[]; error?: string }>;
  createFeature: (projectPath: string, featureId: string, name: string) => Promise<{ success: boolean; feature?: unknown; error?: string }>;
  renameFeature: (projectPath: string, oldFeatureId: string, newFeatureId: string) => Promise<{ success: boolean; error?: string }>;
  deleteFeature: (projectPath: string, featureId: string) => Promise<{ success: boolean; error?: string }>;
  readFeatureMeta: (projectPath: string, featureId: string) => Promise<{ success: boolean; meta?: unknown; error?: string }>;
  writeFeatureMeta: (projectPath: string, featureId: string, meta: unknown) => Promise<{ success: boolean; error?: string }>;
  listFeatureCanvasFiles: (projectPath: string, featureId: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
  readWorkspace: (projectPath: string) => Promise<{ success: boolean; workspace?: unknown; error?: string }>;
  writeWorkspace: (projectPath: string, workspace: unknown) => Promise<{ success: boolean; error?: string }>;
  readAutosaveStatus: (projectPath: string) => Promise<{ success: boolean; status?: unknown; error?: string }>;
  writeAutosaveStatus: (projectPath: string, status: unknown) => Promise<{ success: boolean; error?: string }>;
  readCanvasFile: (projectPath: string, fileName: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeCanvasFile: (projectPath: string, fileName: string, content: string) => Promise<{ success: boolean; error?: string }>;
  renameCanvasFile: (projectPath: string, oldFileName: string, newFileName: string) => Promise<{ success: boolean; error?: string }>;
  deleteCanvasFile: (projectPath: string, fileName: string) => Promise<{ success: boolean; error?: string }>;
  readChatSession: (projectPath: string, featureId: string) => Promise<{ success: boolean; messages?: unknown[]; error?: string }>;
  writeChatSession: (projectPath: string, featureId: string, messages: unknown[]) => Promise<{ success: boolean; error?: string }>;
  saveImageAsset: (projectPath: string, base64: string, mimeType: string) => Promise<{ success: boolean; relativePath?: string; absolutePath?: string; error?: string }>;
  exportDocument: (projectPath: string, format: 'html' | 'pdf' | 'docx', markdownContent: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  exportShareBundle: (projectPath: string, bundle: unknown) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  importShareBundle: () => Promise<{ success: boolean; bundle?: unknown; error?: string }>;
  createDefaultCanvas: (projectPath: string) => Promise<{ success: boolean; fileName?: string; error?: string }>;
  openInExplorer: (projectPath: string) => Promise<{ success: boolean; error?: string }>;
  listCanvasTree: (projectPath: string) => Promise<{ success: boolean; tree?: unknown[]; error?: string }>;
  listProjectFiles: (projectPath: string) => Promise<{ success: boolean; files?: string[]; error?: string }>;
  createCanvasFolder: (projectPath: string, folderPath: string) => Promise<{ success: boolean; error?: string }>;
  deleteCanvasFolder: (projectPath: string, folderPath: string) => Promise<{ success: boolean; error?: string }>;
  moveCanvasFile: (projectPath: string, oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
  renameCanvasFolder: (projectPath: string, oldFolderPath: string, newFolderPath: string) => Promise<{ success: boolean; error?: string }>;
}

interface WindowAPI {
  showEmojiPanel: () => Promise<{ success: boolean; error?: string }>;
}

type ThemeMode = 'dark' | 'light' | 'system';

interface SettingsAPI {
  read: () => Promise<{ success: boolean; settings?: { theme: ThemeMode }; error?: string }>;
  write: (settings: { theme: ThemeMode }) => Promise<{ success: boolean; error?: string }>;
}

interface RuntimeStatus {
  activeRuntime: 'global' | 'none';
  globalInstalled: boolean;
  onboardingDone: boolean;
}

interface RuntimeModelsRefreshedEvent {
  success: boolean;
  models?: Record<string, unknown[]>;
  error?: string;
}

type RuntimeAuthProviderId = 'anthropic' | 'openai-codex' | 'github-copilot';

interface RuntimeAuthProvider {
  id: RuntimeAuthProviderId;
  label: string;
  apiKeySupported: boolean;
  oauthSupported: boolean;
  connected: boolean;
  credentialType: 'api_key' | 'oauth' | null;
}

interface RuntimeAuthSnapshot {
  providers: RuntimeAuthProvider[];
  status: RuntimeStatus;
}

interface RuntimeAPI {
  checkStatus: (projectPath?: string | null) => Promise<{ success: boolean; data?: RuntimeStatus; error?: string }>;
  listAuthProviders: (projectPath?: string | null) => Promise<{ success: boolean; data?: RuntimeAuthSnapshot; error?: string }>;
  setApiKey: (providerId: RuntimeAuthProviderId, key: string, projectPath?: string | null) => Promise<{ success: boolean; data?: RuntimeAuthSnapshot; error?: string }>;
  loginOAuth: (providerId: RuntimeAuthProviderId, projectPath?: string | null) => Promise<{ success: boolean; data?: RuntimeAuthSnapshot; error?: string }>;
  logoutProvider: (providerId: RuntimeAuthProviderId, projectPath?: string | null) => Promise<{ success: boolean; data?: RuntimeAuthSnapshot; error?: string }>;
  completeOnboarding: (projectPath?: string | null) => Promise<{ success: boolean; data?: RuntimeStatus; error?: string }>;
  clearContext: () => Promise<{ success: boolean; error?: string }>;
  onModelsRefreshed: (callback: (event: RuntimeModelsRefreshedEvent) => void) => () => void;
}

interface ElectronAPI {
  platform: NodeJS.Platform;
  ai: AiAPI;
  project: ProjectAPI;
  settings: SettingsAPI;
  runtime: RuntimeAPI;
  window: WindowAPI;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
