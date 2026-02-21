import { AiProvider, FileMention, ModelInfo, AvailableModels, SelectedModels, WritingGoal, WritingGoalPreset } from '../types/chat';

export type { AiProvider, FileMention, ModelInfo, AvailableModels, SelectedModels, WritingGoal, WritingGoalPreset };

export interface TreeEntry {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: TreeEntry[];
}

export interface FeatureSummary {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  writingGoal?: WritingGoal | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: AiProvider;
  fileMentions?: FileMention[];
  thinkingActivities?: ThinkingActivity[];
  thinkingCollapsed?: boolean;
  thinkingStartedAt?: number;
  thinkingCompletedAt?: number;
}

export interface ThinkingActivity {
  id: string;
  kind: 'step_start' | 'tool_use' | 'thinking';
  label: string;
  status: 'pending' | 'completed';
  timestamp: number;
  detail?: string;
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

export type CanvasWidthMode = 'default' | 'wide' | 'responsive';

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

  addMessage: (role: 'user' | 'assistant', content: string, provider?: AiProvider, fileMentions?: FileMention[]) => void;
  removeLastUserMessage: () => void;
  removeLastAssistantMessage: () => void;
  updateLastMessage: (content: string) => void;
  setLastMessageContent: (content: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (conversationId: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  clearMessages: () => void;
  setMessages: (messages: Message[]) => void;
  appendLastAssistantThinkingActivity: (activity: { kind: 'step_start' | 'tool_use' | 'thinking'; label: string; detail?: string }) => void;
  completeLastAssistantThinkingActivity: () => void;
  completeLastAssistantThinking: () => void;
  setMessageThinkingCollapsed: (messageId: string, collapsed: boolean) => void;

  startAiRun: () => string;
  setAiPhase: (phase: AiPhase) => void;
  setAiRunResult: (result: Partial<AiRunState>) => void;
  clearAiRun: () => void;
  saveCanvasSnapshot: () => void;
}

export interface UiSlice {
  isDrawerOpen: boolean;
  errorPopup: ErrorInfo | null;
  toasts: ToastInfo[];
  isSettingsOpen: boolean;
  isExportModalOpen: boolean;
  isCommandPaletteOpen: boolean;
  settings: AppSettings;
  canvasWidthMode: CanvasWidthMode;

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
  toggleCommandPalette: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setTheme: (theme: AppSettings['theme']) => void;
  setCanvasWidthMode: (mode: CanvasWidthMode) => void;
}

export interface ProjectSlice {
  canvasContent: string;
  currentFilePath: string | null;
  projectPath: string | null;
  features: FeatureSummary[];
  activeFeatureId: string | null;
  canvasFiles: string[];
  activeCanvasFile: string | null;
  autosaveStatus: AutosaveStatus;
  canvasTree: TreeEntry[];
  isFileExplorerOpen: boolean;

  setCanvasContent: (content: string) => void;
  setCurrentFilePath: (path: string | null) => void;
  setProjectPath: (path: string | null) => void;
  setFeatures: (features: FeatureSummary[]) => void;
  setActiveFeatureId: (featureId: string | null) => void;
  setCanvasFiles: (files: string[]) => void;
  setActiveCanvasFile: (fileName: string | null) => void;
  setAutosaveStatus: (status: AutosaveStatus) => void;
  setCanvasTree: (tree: TreeEntry[]) => void;
  toggleFileExplorer: () => void;
  restoreState: (bundle: ShareBundle) => void;
}

export interface ModelSlice {
  availableModels: AvailableModels;
  selectedModels: SelectedModels;
  selectedVariant: string | null;
  modelsLoading: boolean;

  setAvailableModels: (models: AvailableModels) => void;
  setSelectedModel: (modelId: string | null) => void;
  setSelectedVariant: (variant: string | null) => void;
  restoreSelectedModels: (models?: Partial<SelectedModels> | null) => void;
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

export type RuntimeMode = 'auto' | 'local' | 'global';

export interface RuntimeStatus {
  mode: RuntimeMode;
  activeRuntime: 'local' | 'global' | 'none';
  localInstalled: boolean;
  globalInstalled: boolean;
  onboardingDone: boolean;
  localBinaryPath: string;
  configDir: string;
}

export interface RuntimeSlice {
  runtimeStatus: RuntimeStatus | null;
  runtimeBusy: boolean;
  runtimeError: string | null;
  isOnboardingOpen: boolean;
  onboardingDismissed: boolean;

  setRuntimeStatus: (status: RuntimeStatus | null) => void;
  setRuntimeBusy: (busy: boolean) => void;
  setRuntimeError: (error: string | null) => void;
  openOnboarding: () => void;
  closeOnboarding: () => void;
  setOnboardingDismissed: (dismissed: boolean) => void;
}

export type AppState = ChatSlice & UiSlice & ProjectSlice & ModelSlice & WritingGoalSlice & RuntimeSlice;
