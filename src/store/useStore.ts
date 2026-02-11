import { create } from 'zustand';
import { AppState } from './types';
import { createChatSlice } from './slices/chatSlice';
import { createUiSlice } from './slices/uiSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createAuthSlice } from './slices/authSlice';
import { createModelSlice } from './slices/modelSlice';

export * from './types';

export const useStore = create<AppState>()((...a) => ({
  ...createChatSlice(...a),
  ...createUiSlice(...a),
  ...createProjectSlice(...a),
  ...createAuthSlice(...a),
  ...createModelSlice(...a),
}));
