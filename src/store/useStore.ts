import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: CanvasProvider;
}

export type AiPhase = 'idle' | 'evaluating' | 'updating' | 'succeeded' | 'failed';

export type CanvasProvider = 'gemini' | 'codex';

export interface AiRunState {
  runId: string;
  phase: AiPhase;
  message?: string;
  needsCanvasUpdate?: boolean;
  updatePlan?: string;
  canvasSnapshot?: string;
  error?: { phase: 'evaluating' | 'updating'; message: string };
}

export type ProviderAiRunState = Record<CanvasProvider, AiRunState | null>;

interface AppState {
  messages: Message[];
  activeCanvasProvider: CanvasProvider;
  geminiCanvasContent: string;
  codexCanvasContent: string;
  isLoading: boolean;
  currentFilePath: string | null;
  isDrawerOpen: boolean;
  isChatPopupOpen: boolean;
  isClosingChatPopup: boolean;
  shouldTriggerChatOpen: boolean;
  aiRun: AiRunState | null;
  providerAiRun: ProviderAiRunState;
  
  isAuthenticated: boolean;
  authLoading: boolean;
  isCodexAuthenticated: boolean;
  codexAuthLoading: boolean;
  isAnthropicAuthenticated: boolean;
  anthropicAuthLoading: boolean;

  addMessage: (role: 'user' | 'assistant', content: string, provider?: CanvasProvider) => void;
  updateLastMessage: (content: string, provider?: CanvasProvider) => void;
  setLastMessageContent: (content: string, provider?: CanvasProvider) => void;
  setCanvasContent: (content: string) => void;
  setProviderCanvasContent: (provider: CanvasProvider, content: string) => void;
  setAllCanvasContent: (content: string) => void;
  setActiveCanvasProvider: (provider: CanvasProvider) => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentFilePath: (path: string | null) => void;
  applyToCanvas: (content: string) => void;
  clearMessages: () => void;
  toggleDrawer: () => void;
  closeDrawer: () => void;
  toggleChatPopup: () => void;
  openChatPopup: () => void;
  closeChatPopup: () => void;
  requestCloseChatPopup: () => void;
  finishCloseChatPopup: () => void;
  triggerChatOpen: () => void;
  clearChatOpenTrigger: () => void;

  startAiRun: () => string;
  setAiPhase: (phase: AiPhase) => void;
  setAiRunResult: (result: Partial<AiRunState>) => void;
  clearAiRun: () => void;
  saveCanvasSnapshot: () => void;
  
  startProviderAiRun: (provider: CanvasProvider) => string;
  setProviderAiPhase: (provider: CanvasProvider, phase: AiPhase) => void;
  clearProviderAiRun: (provider: CanvasProvider) => void;
  
  setAuthStatus: (isAuthenticated: boolean) => void;
  setAuthLoading: (loading: boolean) => void;
  setCodexAuthStatus: (isAuthenticated: boolean) => void;
  setCodexAuthLoading: (loading: boolean) => void;
  setAnthropicAuthStatus: (isAuthenticated: boolean) => void;
  setAnthropicAuthLoading: (loading: boolean) => void;
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
  activeCanvasProvider: 'gemini',
  geminiCanvasContent: DEFAULT_CANVAS_CONTENT,
  codexCanvasContent: DEFAULT_CANVAS_CONTENT,
  isLoading: false,
  currentFilePath: null,
  isDrawerOpen: false,
  isChatPopupOpen: false,
  isClosingChatPopup: false,
  shouldTriggerChatOpen: false,
  aiRun: null,
  providerAiRun: { gemini: null, codex: null },

  addMessage: (role, content, provider) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          role,
          content,
          timestamp: new Date(),
          provider,
        },
      ],
    })),

  updateLastMessage: (content, provider) =>
    set((state) => {
      const messages = [...state.messages];
      const lastMsgIndex = provider
        ? messages.map((m, i) => ({ m, i })).filter(({ m }) => m.role === 'assistant' && m.provider === provider).pop()?.i
        : messages.length - 1;
      if (lastMsgIndex !== undefined && messages[lastMsgIndex]?.role === 'assistant') {
        messages[lastMsgIndex] = {
          ...messages[lastMsgIndex],
          content: messages[lastMsgIndex].content + content,
        };
      }
      return { messages };
    }),

  setLastMessageContent: (content, provider) =>
    set((state) => {
      const messages = [...state.messages];
      const lastMsgIndex = provider
        ? messages.map((m, i) => ({ m, i })).filter(({ m }) => m.role === 'assistant' && m.provider === provider).pop()?.i
        : messages.length - 1;
      if (lastMsgIndex !== undefined && messages[lastMsgIndex]?.role === 'assistant') {
        messages[lastMsgIndex] = {
          ...messages[lastMsgIndex],
          content,
        };
      }
      return { messages };
    }),

  setCanvasContent: (content) =>
    set((state) => {
      if (state.activeCanvasProvider === 'gemini') {
        return { geminiCanvasContent: content };
      } else {
        return { codexCanvasContent: content };
      }
    }),

  setProviderCanvasContent: (provider, content) =>
    set(() => {
      if (provider === 'gemini') {
        return { geminiCanvasContent: content };
      } else {
        return { codexCanvasContent: content };
      }
    }),

  setAllCanvasContent: (content) =>
    set({ geminiCanvasContent: content, codexCanvasContent: content }),

  setActiveCanvasProvider: (provider) => set({ activeCanvasProvider: provider }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setCurrentFilePath: (path) => set({ currentFilePath: path }),

  applyToCanvas: (content) =>
    set((state) => {
      const currentContent = state.activeCanvasProvider === 'gemini' 
        ? state.geminiCanvasContent 
        : state.codexCanvasContent;
      const newContent = currentContent + '\n\n' + content;
      if (state.activeCanvasProvider === 'gemini') {
        return { geminiCanvasContent: newContent };
      } else {
        return { codexCanvasContent: newContent };
      }
    }),

  clearMessages: () => set({ messages: [] }),

  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleChatPopup: () => set((state) => ({ isChatPopupOpen: !state.isChatPopupOpen })),
  openChatPopup: () => set({ isChatPopupOpen: true, isClosingChatPopup: false }),
  closeChatPopup: () => set({ isChatPopupOpen: false, isClosingChatPopup: false }),
  requestCloseChatPopup: () => set({ isClosingChatPopup: true }),
  finishCloseChatPopup: () => set({ isChatPopupOpen: false, isClosingChatPopup: false }),
  triggerChatOpen: () => set({ shouldTriggerChatOpen: true }),
  clearChatOpenTrigger: () => set({ shouldTriggerChatOpen: false }),

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

  saveCanvasSnapshot: () =>
    set((state) => {
      const currentContent = state.activeCanvasProvider === 'gemini' 
        ? state.geminiCanvasContent 
        : state.codexCanvasContent;
      return {
        aiRun: state.aiRun
          ? { ...state.aiRun, canvasSnapshot: currentContent }
          : null,
      };
    }),

  setAuthStatus: (isAuthenticated) => set({ isAuthenticated }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setCodexAuthStatus: (isCodexAuthenticated) => set({ isCodexAuthenticated }),
  setCodexAuthLoading: (codexAuthLoading) => set({ codexAuthLoading }),
  setAnthropicAuthStatus: (isAnthropicAuthenticated) => set({ isAnthropicAuthenticated }),
  setAnthropicAuthLoading: (anthropicAuthLoading) => set({ anthropicAuthLoading }),

  startProviderAiRun: (provider) => {
    const runId = generateRunId();
    set((state) => ({
      providerAiRun: {
        ...state.providerAiRun,
        [provider]: { runId, phase: 'evaluating' as AiPhase },
      },
    }));
    return runId;
  },

  setProviderAiPhase: (provider, phase) =>
    set((state) => ({
      providerAiRun: {
        ...state.providerAiRun,
        [provider]: state.providerAiRun[provider]
          ? { ...state.providerAiRun[provider], phase }
          : null,
      },
    })),

  clearProviderAiRun: (provider) =>
    set((state) => ({
      providerAiRun: {
        ...state.providerAiRun,
        [provider]: null,
      },
    })),
}));

export const selectCanvasContent = (state: AppState) =>
  state.activeCanvasProvider === 'gemini'
    ? state.geminiCanvasContent
    : state.codexCanvasContent;
