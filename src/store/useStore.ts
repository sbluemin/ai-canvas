import { create } from 'zustand';
import { AiProvider, ModelInfo, AvailableModels, SelectedModels } from '../types/chat';

export type { AiProvider, ModelInfo, AvailableModels, SelectedModels };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: AiProvider;
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

interface AppState {
  messages: Message[];
  canvasContent: string;
  isLoading: boolean;
  currentFilePath: string | null;
  isDrawerOpen: boolean;
  aiRun: AiRunState | null;
  activeProvider: AiProvider;
  errorPopup: ErrorInfo | null;
  
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

  addMessage: (role: 'user' | 'assistant', content: string, provider?: AiProvider) => void;
  removeLastUserMessage: () => void;
  removeLastAssistantMessage: () => void;
  updateLastMessage: (content: string) => void;
  setLastMessageContent: (content: string) => void;
  setCanvasContent: (content: string) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentFilePath: (path: string | null) => void;
  applyToCanvas: (content: string) => void;
  clearMessages: () => void;
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
  
  showError: (error: ErrorInfo) => void;
  clearError: () => void;
}

function generateRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
  isAuthenticated: false,
  authLoading: true,
  isCodexAuthenticated: false,
  codexAuthLoading: true,
  isAnthropicAuthenticated: false,
  anthropicAuthLoading: true,
  availableModels: { gemini: [], openai: [], anthropic: [] },
  selectedModels: { gemini: null, openai: null, anthropic: null },
  modelsLoading: false,
  canvasContent: DEFAULT_CANVAS_CONTENT,
  isLoading: false,
  currentFilePath: null,
  isDrawerOpen: false,
  aiRun: null,
  activeProvider: 'gemini',
  errorPopup: null,

  addMessage: (role, content, provider?) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role,
          content,
          timestamp: new Date(),
          ...(provider ? { provider } : {}),
        },
      ],
    })),

  removeLastUserMessage: () =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        messages.pop();
      }
      return { messages };
    }),

  removeLastAssistantMessage: () =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages.pop();
      }
      return { messages };
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
      return { messages };
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
      return { messages };
    }),

  setCanvasContent: (content) => set({ canvasContent: content }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setCurrentFilePath: (path) => set({ currentFilePath: path }),

  applyToCanvas: (content) =>
    set((state) => ({
      canvasContent: state.canvasContent + '\n\n' + content,
    })),

  clearMessages: () => set({ messages: [] }),

  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  closeDrawer: () => set({ isDrawerOpen: false }),

  startAiRun: () => {
    const runId = generateRunId();
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
  
  showError: (error) => set({ errorPopup: error }),
  clearError: () => set({ errorPopup: null }),
}));
