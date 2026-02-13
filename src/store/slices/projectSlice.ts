import { StateCreator } from 'zustand';
import { AppState, ProjectSlice, Message } from '../types';
import { DEFAULT_CANVAS_CONTENT } from '../utils';

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set) => ({
  canvasContent: DEFAULT_CANVAS_CONTENT,
  currentFilePath: null,
  projectPath: null,
  canvasFiles: [],
  activeCanvasFile: null,
  autosaveStatus: {
    state: 'idle',
  },
  canvasTree: [],
  isFileExplorerOpen: false,

  setCanvasContent: (content) => set({ canvasContent: content }),
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  setProjectPath: (projectPath) => set({ projectPath }),
  setCanvasFiles: (canvasFiles) => set({ canvasFiles }),
  setActiveCanvasFile: (activeCanvasFile) => set({ activeCanvasFile }),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
  setCanvasTree: (canvasTree) => set({ canvasTree }),
  toggleFileExplorer: () => set((state) => ({ isFileExplorerOpen: !state.isFileExplorerOpen })),

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
});
