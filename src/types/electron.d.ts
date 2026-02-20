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

type AiProvider = 'opencode';

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

type AiProviderModels = Record<'opencode', ModelInfo[]>;

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

type RuntimeMode = 'auto' | 'local' | 'global';

interface RuntimeStatus {
  mode: RuntimeMode;
  activeRuntime: 'local' | 'global' | 'none';
  localInstalled: boolean;
  globalInstalled: boolean;
  onboardingDone: boolean;
  localBinaryPath: string;
  configDir: string;
}

interface RuntimeInstallProgress {
  projectPath: string;
  phase: 'downloading' | 'extracting' | 'finalizing' | 'done' | 'error';
  percent: number;
  receivedBytes?: number;
  totalBytes?: number;
}

interface RuntimeModelsRefreshedEvent {
  success: boolean;
  models?: Record<string, unknown[]>;
  error?: string;
}

interface RuntimeAPI {
  checkStatus: (projectPath: string | null) => Promise<{ success: boolean; data?: RuntimeStatus; error?: string }>;
  setMode: (projectPath: string, mode: RuntimeMode) => Promise<{ success: boolean; data?: RuntimeStatus; error?: string }>;
  installLocal: (projectPath: string) => Promise<{ success: boolean; data?: RuntimeStatus; error?: string }>;
  openAuthTerminal: (projectPath: string | null) => Promise<{ success: boolean; error?: string }>;
  openTerminal: (projectPath: string | null) => Promise<{ success: boolean; error?: string }>;
  completeOnboarding: (projectPath: string) => Promise<{ success: boolean; data?: RuntimeStatus; error?: string }>;
  clearContext: () => Promise<{ success: boolean; error?: string }>;
  onInstallProgress: (callback: (progress: RuntimeInstallProgress) => void) => () => void;
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
