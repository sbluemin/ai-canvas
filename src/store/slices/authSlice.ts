import { StateCreator } from 'zustand';
import { AppState, AuthSlice } from '../types';

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
  isAuthenticated: false,
  authLoading: true,
  isCodexAuthenticated: false,
  codexAuthLoading: true,
  isAnthropicAuthenticated: false,
  anthropicAuthLoading: true,

  setAuthStatus: (isAuthenticated) => set({ isAuthenticated }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setCodexAuthStatus: (isCodexAuthenticated) => set({ isCodexAuthenticated }),
  setCodexAuthLoading: (codexAuthLoading) => set({ codexAuthLoading }),
  setAnthropicAuthStatus: (isAnthropicAuthenticated) => set({ isAnthropicAuthenticated }),
  setAnthropicAuthLoading: (anthropicAuthLoading) => set({ anthropicAuthLoading }),
});
