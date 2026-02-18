import { create } from 'zustand';
import { AppState } from './types';
import { createChatSlice } from './slices/chatSlice';
import { createUiSlice } from './slices/uiSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createModelSlice } from './slices/modelSlice';
import { createWritingGoalSlice } from './slices/writingGoalSlice';
import { createDiffPreviewSlice } from './slices/diffPreviewSlice';
import { createRuntimeSlice } from './slices/runtimeSlice';

export * from './types';

export const useStore = create<AppState>()((...a) => ({
  ...createChatSlice(...a),
  ...createUiSlice(...a),
  ...createProjectSlice(...a),
  ...createModelSlice(...a),
  ...createWritingGoalSlice(...a),
  ...createDiffPreviewSlice(...a),
  ...createRuntimeSlice(...a),
}));
