import { StateCreator } from 'zustand';
import { AppState, RuntimeSlice } from '../types';

export const createRuntimeSlice: StateCreator<AppState, [], [], RuntimeSlice> = (set) => ({
  runtimeStatus: null,
  runtimeBusy: false,
  runtimeError: null,
  isOnboardingOpen: false,
  onboardingDismissed: false,

  setRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }),
  setRuntimeBusy: (runtimeBusy) => set({ runtimeBusy }),
  setRuntimeError: (runtimeError) => set({ runtimeError }),
  openOnboarding: () => set({ isOnboardingOpen: true }),
  closeOnboarding: () => set({ isOnboardingOpen: false }),
  setOnboardingDismissed: (onboardingDismissed) => set({ onboardingDismissed }),
});
