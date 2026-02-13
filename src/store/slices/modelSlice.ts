import { StateCreator } from 'zustand';
import { AppState, ModelSlice, SelectedModels } from '../types';

const DEFAULT_SELECTED_MODELS: SelectedModels = {
  gemini: 'gemini-3-flash-preview',
  openai: 'gpt-5.2',
  anthropic: 'claude-haiku-4-5',
};

function resolveSelectedModels(models?: Partial<SelectedModels> | null): SelectedModels {
  return {
    gemini: models?.gemini === undefined ? DEFAULT_SELECTED_MODELS.gemini : models.gemini,
    openai: models?.openai === undefined ? DEFAULT_SELECTED_MODELS.openai : models.openai,
    anthropic: models?.anthropic === undefined ? DEFAULT_SELECTED_MODELS.anthropic : models.anthropic,
  };
}

export const createModelSlice: StateCreator<AppState, [], [], ModelSlice> = (set) => ({
  availableModels: { gemini: [], openai: [], anthropic: [] },
  selectedModels: resolveSelectedModels(),
  modelsLoading: false,

  setAvailableModels: (models) => set({ availableModels: models }),
  setSelectedModel: (provider, modelId) =>
    set((state) => ({
      selectedModels: { ...state.selectedModels, [provider]: modelId },
    })),
  restoreSelectedModels: (models) =>
    set({ selectedModels: resolveSelectedModels(models) }),
  setModelsLoading: (modelsLoading) => set({ modelsLoading }),
});
