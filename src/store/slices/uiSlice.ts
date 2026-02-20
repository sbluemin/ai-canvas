import { StateCreator } from 'zustand';
import { AppState, UiSlice } from '../types';
import { generateId } from '../utils';

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set) => ({
  isDrawerOpen: false,
  errorPopup: null,
  toasts: [],
  isSettingsOpen: false,
  isExportModalOpen: false,
  isCommandPaletteOpen: false,
  canvasWidthMode: 'default',
  settings: {
    theme: 'dark',
  },

  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
  closeDrawer: () => set({ isDrawerOpen: false }),

  showError: (error) => set({ errorPopup: error }),
  clearError: () => set({ errorPopup: null }),

  addToast: (type, message) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          id: generateId(),
          type,
          message,
        },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),

  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
  closeSettings: () => set({ isSettingsOpen: false }),

  toggleExportModal: () => set((state) => ({ isExportModalOpen: !state.isExportModalOpen })),
  closeExportModal: () => set({ isExportModalOpen: false }),

  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),

  setTheme: (theme) => set((state) => ({ settings: { ...state.settings, theme } })),
  setCanvasWidthMode: (mode) => set({ canvasWidthMode: mode }),
});
