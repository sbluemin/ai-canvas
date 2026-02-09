import { StateCreator } from 'zustand';
import { AppState, ProjectSlice } from '../types';
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

  setCanvasContent: (content) => set({ canvasContent: content }),
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  setProjectPath: (projectPath) => set({ projectPath }),
  setCanvasFiles: (canvasFiles) => set({ canvasFiles }),
  setActiveCanvasFile: (activeCanvasFile) => set({ activeCanvasFile }),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
});
