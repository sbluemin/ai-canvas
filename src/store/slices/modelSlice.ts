import { StateCreator } from 'zustand';
import { AppState, ModelSlice, SelectedModels } from '../types';

const DEFAULT_SELECTED_MODELS: SelectedModels = {
  opencode: null,
};

function resolveSelectedModels(models?: Partial<SelectedModels> | null): SelectedModels {
  return {
    opencode: models?.opencode === undefined ? DEFAULT_SELECTED_MODELS.opencode : models.opencode,
  };
}

export const createModelSlice: StateCreator<AppState, [], [], ModelSlice> = (set) => ({
  availableModels: { opencode: [] },
  selectedModels: resolveSelectedModels(),
  selectedVariant: null,
  modelsLoading: false,

  setAvailableModels: (models) => set({ availableModels: models }),
  setSelectedModel: (modelId) =>
    set((state) => ({ selectedModels: { ...state.selectedModels, opencode: modelId } })),
  setSelectedVariant: (variant) => set({ selectedVariant: variant }),
  restoreSelectedModels: (models) =>
    set({ selectedModels: resolveSelectedModels(models) }),
  setModelsLoading: (modelsLoading) => set({ modelsLoading }),
});
