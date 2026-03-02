import { StateCreator } from 'zustand';
import { AppState, ModelSlice, SelectedModels } from '../types';

const DEFAULT_SELECTED_MODELS: SelectedModels = {
  pi: null,
};

function resolveSelectedModels(models?: Partial<SelectedModels> | null): SelectedModels {
  return {
    pi: models?.pi === undefined ? DEFAULT_SELECTED_MODELS.pi : models.pi,
  };
}

export const createModelSlice: StateCreator<AppState, [], [], ModelSlice> = (set) => ({
  availableModels: { pi: [] },
  selectedModels: resolveSelectedModels(),
  selectedVariant: null,
  modelsLoading: false,

  setAvailableModels: (models) => set({ availableModels: models }),
  setSelectedModel: (modelId) =>
    set((state) => ({ selectedModels: { ...state.selectedModels, pi: modelId } })),
  setSelectedVariant: (variant) => set({ selectedVariant: variant }),
  restoreSelectedModels: (models) =>
    set({ selectedModels: resolveSelectedModels(models) }),
  setModelsLoading: (modelsLoading) => set({ modelsLoading }),
});
