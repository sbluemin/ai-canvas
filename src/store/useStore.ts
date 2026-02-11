import { create } from 'zustand';
import { generateId } from '../utils';
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

interface AppState {
  messages: Message[];
  conversations: Conversation[];
  activeConversationId: string | null;
  canvasContent: string;
  isLoading: boolean;
  currentFilePath: string | null;
  isDrawerOpen: boolean;
  aiRun: AiRunState | null;
  activeProvider: AiProvider;
  errorPopup: ErrorInfo | null;
  toasts: ToastInfo[];
  isSettingsOpen: boolean;
  isExportModalOpen: boolean;
  settings: AppSettings;
  autosaveStatus: AutosaveStatus;
  
  // 프로젝트/캔버스 파일 관리
  projectPath: string | null;
  canvasFiles: string[];
  activeCanvasFile: string | null;
  
  // 인증 상태
  isAuthenticated: boolean;
  authLoading: boolean;
  isCodexAuthenticated: boolean;
  codexAuthLoading: boolean;
  isAnthropicAuthenticated: boolean;
  anthropicAuthLoading: boolean;

  // 모델 선택
  availableModels: AvailableModels;
  selectedModels: SelectedModels;
  modelsLoading: boolean;

  // 문서 작성 목표
  activeWritingGoal: WritingGoal | null;
  writingGoalPresets: WritingGoalPreset[];
  isWritingGoalOpen: boolean;

  addMessage: (role: 'user' | 'assistant', content: string, provider?: AiProvider) => void;
  removeLastUserMessage: () => void;
  removeLastAssistantMessage: () => void;
  updateLastMessage: (content: string) => void;
  setLastMessageContent: (content: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversationId: (conversationId: string | null) => void;
  setCanvasContent: (content: string) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentFilePath: (path: string | null) => void;
  clearMessages: () => void;
  setMessages: (messages: Message[]) => void;
  toggleDrawer: () => void;
  closeDrawer: () => void;

  startAiRun: () => string;
  setAiPhase: (phase: AiPhase) => void;
  setAiRunResult: (result: Partial<AiRunState>) => void;
  clearAiRun: () => void;
  setActiveProvider: (provider: AiProvider) => void;
  saveCanvasSnapshot: () => void;
  
  setAuthStatus: (isAuthenticated: boolean) => void;
  setAuthLoading: (loading: boolean) => void;
  setCodexAuthStatus: (isAuthenticated: boolean) => void;
  setCodexAuthLoading: (loading: boolean) => void;
  setAnthropicAuthStatus: (isAuthenticated: boolean) => void;
  setAnthropicAuthLoading: (loading: boolean) => void;
  
  setAvailableModels: (models: AvailableModels) => void;
  setSelectedModel: (provider: AiProvider, modelId: string | null) => void;
  setModelsLoading: (loading: boolean) => void;
  
  // 프로젝트/캔버스 파일 관리 액션
  setProjectPath: (path: string | null) => void;
  setCanvasFiles: (files: string[]) => void;
  setActiveCanvasFile: (fileName: string | null) => void;
  
  showError: (error: ErrorInfo) => void;
  clearError: () => void;
  addToast: (type: ToastInfo['type'], message: string) => void;
  removeToast: (id: string) => void;
  toggleSettings: () => void;
  closeSettings: () => void;
  toggleExportModal: () => void;
  closeExportModal: () => void;
  setTheme: (theme: AppSettings['theme']) => void;
  setAutosaveStatus: (status: AutosaveStatus) => void;
  restoreState: (bundle: ShareBundle) => void;
  
  setActiveWritingGoal: (goal: WritingGoal | null) => void;
  setWritingGoalPresets: (presets: WritingGoalPreset[]) => void;
  addWritingGoalPreset: (preset: WritingGoalPreset) => void;
  removeWritingGoalPreset: (presetId: string) => void;
  toggleWritingGoal: () => void;
  closeWritingGoal: () => void;
}



const DEFAULT_WRITING_GOAL_PRESETS: WritingGoalPreset[] = [
  {
    id: 'meeting-notes',
    name: '회의록',
    goal: { purpose: '회의 내용 정리 및 결정사항 기록', audience: '팀원', tone: '간결하고 명확한', targetLength: 'medium' },
  },
  {
    id: 'proposal',
    name: '제안서',
    goal: { purpose: '프로젝트 또는 아이디어 제안', audience: '의사결정자/경영진', tone: '격식체, 전문적', targetLength: 'long' },
  },
  {
    id: 'tech-doc',
    name: '기술 문서',
    goal: { purpose: '기술 사양 및 구현 가이드 작성', audience: '개발자', tone: '정확하고 체계적인', targetLength: 'long' },
  },
  {
    id: 'blog-post',
    name: '블로그 포스트',
    goal: { purpose: '지식 공유 및 인사이트 전달', audience: '일반 독자', tone: '친근하고 이해하기 쉬운', targetLength: 'medium' },
  },
];

const DEFAULT_CANVAS_CONTENT = `# AI Canvas - 재사용 가능한 코어 아키텍처

## 기술 스택 개요

| 구분 | 선택된 기술 | 용도 및 특징 |
|------|-------------|--------------|
| 프레임워크 | React 19 + TypeScript | 최신 React 기능과 타입 안전성 |
| 빌드 도구 | Vite | 빠른 HMR과 최적화된 빌드 |
| 데스크톱 | Electron 34 | 크로스 플랫폼 데스크톱 앱 |
| 서버 | Express 4 | 경량 웹 서버 |
| 상태 관리 | Zustand | 간결하고 직관적인 상태 관리 |
| 에디터 | Milkdown | 플러그인 기반 마크다운 에디터 |

## 프로젝트 구조

\`\`\`
AICanvas/
├── src/
│   ├── components/
│   │   ├── ChatPanel.tsx        # AI 채팅 인터페이스
│   │   ├── CanvasPanel.tsx      # 마크다운 에디터 패널
│   │   ├── MilkdownEditor.tsx   # Milkdown 래퍼
│   │   ├── EditorToolbar.tsx    # 에디터 도구모음
│   │   └── SelectionPopup.tsx   # 텍스트 선택 팝업
│   ├── store/
│   │   └── useStore.ts          # Zustand 스토어
│   ├── lib/
│   │   └── api.ts               # API 추상화
│   └── App.tsx                  # 루트 컴포넌트
├── electron/
│   ├── main.ts                  # Electron 메인
│   └── preload.ts               # 프리로드 스크립트
└── server/
    └── index.ts                 # Express 서버
\`\`\`

## 주요 특징

- **멀티 플랫폼**: Electron 데스크톱 + 웹 브라우저 동시 지원
- **실시간 AI 채팅**: SSE 기반 스트리밍 응답
- **마크다운 WYSIWYG**: Milkdown 기반 풍부한 편집 경험
- **다크 테마**: Gemini Canvas 스타일의 모던 UI
`;

export const useStore = create<AppState>((set) => ({
  messages: [],
  conversations: [],
  activeConversationId: null,
  isAuthenticated: false,
  authLoading: true,
  isCodexAuthenticated: false,
  codexAuthLoading: true,
  isAnthropicAuthenticated: false,
  anthropicAuthLoading: true,
  availableModels: { gemini: [], openai: [], anthropic: [] },
  selectedModels: {
    gemini: 'gemini-3-flash-preview',
    openai: 'gpt-5.2',
    anthropic: 'claude-haiku-4-5',
  },
  modelsLoading: false,
  activeWritingGoal: null,
  writingGoalPresets: DEFAULT_WRITING_GOAL_PRESETS,
  isWritingGoalOpen: false,
  canvasContent: DEFAULT_CANVAS_CONTENT,
  isLoading: false,
  currentFilePath: null,
  isDrawerOpen: false,
  aiRun: null,
  activeProvider: 'gemini',
  errorPopup: null,
  toasts: [],
  isSettingsOpen: false,
  isExportModalOpen: false,
  settings: {
    theme: 'dark',
  },
  autosaveStatus: {
    state: 'idle',
  },
  projectPath: null,
  canvasFiles: [],
  activeCanvasFile: null,

  addMessage: (role, content, provider?) =>
    set((state) => {
      const nextMessage: Message = {
        id: generateId(),
        role,
        content,
        timestamp: new Date(),
        ...(provider ? { provider } : {}),
      };
      const nextMessages = [...state.messages, nextMessage];
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages: nextMessages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages: nextMessages, conversations: nextConversations };
    }),

  removeLastUserMessage: () =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        messages.pop();
      }
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  removeLastAssistantMessage: () =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages.pop();
      }
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content: messages[messages.length - 1].content + content,
        };
      }
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  setLastMessageContent: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content,
        };
      }
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  setConversations: (conversations) => set({ conversations }),

  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),

  setCanvasContent: (content) => set({ canvasContent: content }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setCurrentFilePath: (path) => set({ currentFilePath: path }),

  clearMessages: () => set({ messages: [] }),

  setMessages: (messages) =>
    set((state) => {
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  closeDrawer: () => set({ isDrawerOpen: false }),

  startAiRun: () => {
    const runId = generateId();
    set({
      aiRun: {
        runId,
        phase: 'evaluating',
      },
    });
    return runId;
  },

  setAiPhase: (phase) =>
    set((state) => ({
      aiRun: state.aiRun ? { ...state.aiRun, phase } : null,
    })),

  setAiRunResult: (result) =>
    set((state) => ({
      aiRun: state.aiRun ? { ...state.aiRun, ...result } : null,
    })),

  clearAiRun: () => set({ aiRun: null }),
  setActiveProvider: (provider) => set({ activeProvider: provider }),

  saveCanvasSnapshot: () =>
    set((state) => ({
      aiRun: state.aiRun
        ? { ...state.aiRun, canvasSnapshot: state.canvasContent }
        : null,
    })),

  setAuthStatus: (isAuthenticated) => set({ isAuthenticated }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setCodexAuthStatus: (isCodexAuthenticated) => set({ isCodexAuthenticated }),
  setCodexAuthLoading: (codexAuthLoading) => set({ codexAuthLoading }),
  setAnthropicAuthStatus: (isAnthropicAuthenticated) => set({ isAnthropicAuthenticated }),
  setAnthropicAuthLoading: (anthropicAuthLoading) => set({ anthropicAuthLoading }),
  
  setAvailableModels: (models) => set({ availableModels: models }),
  setSelectedModel: (provider, modelId) =>
    set((state) => ({
      selectedModels: { ...state.selectedModels, [provider]: modelId },
    })),
  setModelsLoading: (modelsLoading) => set({ modelsLoading }),
  
  setProjectPath: (projectPath) => set({ projectPath }),
  setCanvasFiles: (canvasFiles) => set({ canvasFiles }),
  setActiveCanvasFile: (activeCanvasFile) => set({ activeCanvasFile }),
  
  showError: (error) => set({ errorPopup: error }),
  clearError: () => set({ errorPopup: null }),

  addToast: (type, message) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: generateId(),
          type,
          message,
        },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
  closeSettings: () => set({ isSettingsOpen: false }),
  toggleExportModal: () => set((state) => ({ isExportModalOpen: !state.isExportModalOpen })),
  closeExportModal: () => set({ isExportModalOpen: false }),
  setTheme: (theme) => set((state) => ({ settings: { ...state.settings, theme } })),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
  
  setActiveWritingGoal: (goal) => set({ activeWritingGoal: goal }),
  setWritingGoalPresets: (presets) => set({ writingGoalPresets: presets }),
  addWritingGoalPreset: (preset) =>
    set((state) => ({ writingGoalPresets: [...state.writingGoalPresets, preset] })),
  removeWritingGoalPreset: (presetId) =>
    set((state) => ({
      writingGoalPresets: state.writingGoalPresets.filter((p) => p.id !== presetId),
    })),
  toggleWritingGoal: () => set((state) => ({ isWritingGoalOpen: !state.isWritingGoalOpen })),
  closeWritingGoal: () => set({ isWritingGoalOpen: false }),
  restoreState: (bundle) =>
    set(() => {
      const conversations = Array.isArray(bundle.conversations)
        ? bundle.conversations.map((c: any) => ({
            ...c,
            messages: Array.isArray(c.messages)
              ? c.messages.map((m: any) => ({
                  ...m,
                  timestamp: new Date(m.timestamp),
                }))
              : [],
          }))
        : [];

      const activeConversationId = bundle.activeConversationId;
      let activeMessages: Message[] = [];
      if (activeConversationId) {
        const activeConv = conversations.find((c: any) => c.id === activeConversationId);
        if (activeConv) {
          activeMessages = activeConv.messages;
        }
      }

      return {
        conversations,
        activeConversationId,
        messages: activeMessages,
        canvasFiles: bundle.canvasFiles || [],
        canvasContent: bundle.canvasContent || '',
        autosaveStatus: bundle.autosaveStatus || { state: 'idle' },
        aiRun: null,
        errorPopup: null,
      };
    }),
}));
