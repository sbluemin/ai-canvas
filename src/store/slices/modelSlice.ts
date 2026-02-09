import { StateCreator } from 'zustand';
import { AppState, ModelSlice } from '../types';

export const createModelSlice: StateCreator<AppState, [], [], ModelSlice> = (set) => ({
  availableModels: { gemini: [], openai: [], anthropic: [] },
  selectedModels: {
    gemini: 'gemini-3-flash-preview',
    openai: 'gpt-5.2',
    anthropic: 'claude-haiku-4-5',
  },
  modelsLoading: false,

  setAvailableModels: (models) => set({ availableModels: models }),
  setSelectedModel: (provider, modelId) =>
    set((state) => ({
      selectedModels: { ...state.selectedModels, [provider]: modelId },
    })),
  setModelsLoading: (modelsLoading) => set({ modelsLoading }),
});
