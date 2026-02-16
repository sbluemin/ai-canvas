import { AiProvider, FileMention, ModelInfo, AvailableModels, SelectedModels, WritingGoal, WritingGoalPreset } from '../types/chat';

export type { AiProvider, FileMention, ModelInfo, AvailableModels, SelectedModels, WritingGoal, WritingGoalPreset };

export interface TreeEntry {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: TreeEntry[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: AiProvider;
  fileMentions?: FileMention[];
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
  canvasTree: TreeEntry[];
  isFileExplorerOpen: boolean;

  setCanvasContent: (content: string) => void;
  setCurrentFilePath: (path: string | null) => void;
  setProjectPath: (path: string | null) => void;
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

// DiffChunk: diff 라이브러리의 결과를 기반으로 한 개별 변경 블록
export interface DiffChunk {
  id: string;                          // 고유 ID (예: 'chunk-0', 'chunk-1')
  type: 'equal' | 'add' | 'remove';   // 변경 유형
  value: string;                       // 해당 블록의 텍스트
  selected: boolean;                   // 사용자가 적용할지 선택한 여부 (기본값: true)
}

// PendingCanvasPatch: 대기 중인 변경안
export interface PendingCanvasPatch {
  runId: string;                       // AI 실행 ID
  originalContent: string;             // 변경 전 원본 캔버스 내용
  proposedContent: string;             // AI가 제안한 변경 후 내용
  chunks: DiffChunk[];                 // diff 결과 chunk 배열
}

export interface DiffPreviewSlice {
  // PendingCanvasPatch: AI 제안 변경안 관리
  pendingCanvasPatch: PendingCanvasPatch | null;

  // PendingCanvasPatch 관리 액션
  setPendingCanvasPatch: (patch: PendingCanvasPatch) => void;
  toggleChunkSelection: (chunkId: string) => void;
  selectAllChunks: () => void;
  deselectAllChunks: () => void;
  applyPendingPatch: () => void;
  discardPendingPatch: () => void;
}

export type AppState = ChatSlice & UiSlice & ProjectSlice & ModelSlice & WritingGoalSlice & DiffPreviewSlice;
