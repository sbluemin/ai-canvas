import { AiProvider, ModelInfo, AvailableModels, SelectedModels, WritingGoal, WritingGoalPreset } from '../types/chat';

export type { AiProvider, ModelInfo, AvailableModels, SelectedModels, WritingGoal, WritingGoalPreset };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: AiProvider;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface AutosaveStatus {
  state: 'idle' | 'saving' | 'saved' | 'error';
  updatedAt?: number;
  message?: string;
}

export type AiPhase = 'idle' | 'evaluating' | 'updating' | 'succeeded' | 'failed';

export interface AiRunState {
  runId: string;
  phase: AiPhase;
  message?: string;
  needsCanvasUpdate?: boolean;
  updatePlan?: string;
  canvasSnapshot?: string;
  error?: { phase: 'evaluating' | 'updating'; message: string };
}

export interface ErrorInfo {
  title: string;
  message: string;
  details?: string;
}

export interface ToastInfo {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
}

export interface ShareBundle {
  version: string;
  createdAt: string;
  conversations: any[];
  activeConversationId: string | null;
  canvasFiles: string[];
  canvasContent: string;
  autosaveStatus: AutosaveStatus;
}

export interface ChatSlice {
  messages: Message[];
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  aiRun: AiRunState | null;
  activeProvider: AiProvider;

  addMessage: (role: 'user' | 'assistant', content: string, provider?: AiProvider) => void;
  removeLastUserMessage: () => void;
  removeLastAssistantMessage: () => void;
  updateLastMessage: (content: string) => void;
  setLastMessageContent: (content: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (conversationId: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  clearMessages: () => void;
  setMessages: (messages: Message[]) => void;

  startAiRun: () => string;
  setAiPhase: (phase: AiPhase) => void;
  setAiRunResult: (result: Partial<AiRunState>) => void;
  clearAiRun: () => void;
  setActiveProvider: (provider: AiProvider) => void;
  saveCanvasSnapshot: () => void;
}

export interface UiSlice {
  isDrawerOpen: boolean;
  errorPopup: ErrorInfo | null;
  toasts: ToastInfo[];
  isSettingsOpen: boolean;
  isExportModalOpen: boolean;
  settings: AppSettings;

  toggleDrawer: () => void;
  closeDrawer: () => void;
  showError: (error: ErrorInfo) => void;
  clearError: () => void;
  addToast: (type: ToastInfo['type'], message: string) => void;
  removeToast: (id: string) => void;
  toggleSettings: () => void;
  closeSettings: () => void;
  toggleExportModal: () => void;
  closeExportModal: () => void;
  setTheme: (theme: AppSettings['theme']) => void;
}

export interface ProjectSlice {
  canvasContent: string;
  currentFilePath: string | null;
  projectPath: string | null;
  canvasFiles: string[];
  activeCanvasFile: string | null;
  autosaveStatus: AutosaveStatus;

  setCanvasContent: (content: string) => void;
  setCurrentFilePath: (path: string | null) => void;
  setProjectPath: (path: string | null) => void;
  setCanvasFiles: (files: string[]) => void;
  setActiveCanvasFile: (fileName: string | null) => void;
  setAutosaveStatus: (status: AutosaveStatus) => void;
  restoreState: (bundle: ShareBundle) => void;
}

export interface AuthSlice {
  isAuthenticated: boolean;
  authLoading: boolean;
  isCodexAuthenticated: boolean;
  codexAuthLoading: boolean;
  isAnthropicAuthenticated: boolean;
  anthropicAuthLoading: boolean;

  setAuthStatus: (isAuthenticated: boolean) => void;
  setAuthLoading: (loading: boolean) => void;
  setCodexAuthStatus: (isAuthenticated: boolean) => void;
  setCodexAuthLoading: (loading: boolean) => void;
  setAnthropicAuthStatus: (isAuthenticated: boolean) => void;
  setAnthropicAuthLoading: (loading: boolean) => void;
}

export interface ModelSlice {
  availableModels: AvailableModels;
  selectedModels: SelectedModels;
  modelsLoading: boolean;

  setAvailableModels: (models: AvailableModels) => void;
  setSelectedModel: (provider: AiProvider, modelId: string | null) => void;
  setModelsLoading: (loading: boolean) => void;
}

export interface WritingGoalSlice {
  activeWritingGoal: WritingGoal | null;
  writingGoalPresets: WritingGoalPreset[];
  isWritingGoalOpen: boolean;

  setActiveWritingGoal: (goal: WritingGoal | null) => void;
  setWritingGoalPresets: (presets: WritingGoalPreset[]) => void;
  addWritingGoalPreset: (preset: WritingGoalPreset) => void;
  removeWritingGoalPreset: (presetId: string) => void;
  toggleWritingGoal: () => void;
  closeWritingGoal: () => void;
}

export type AppState = ChatSlice & UiSlice & ProjectSlice & AuthSlice & ModelSlice & WritingGoalSlice;
