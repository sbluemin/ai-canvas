import { StateCreator } from 'zustand';
import { AppState, WritingGoalSlice } from '../types';

export const createWritingGoalSlice: StateCreator<AppState, [], [], WritingGoalSlice> = (set) => ({
  activeWritingGoal: null,
  writingGoalPresets: [],
  isWritingGoalOpen: false,

  setActiveWritingGoal: (goal) => set({ activeWritingGoal: goal }),
  setWritingGoalPresets: (presets) => set({ writingGoalPresets: presets }),
  addWritingGoalPreset: (preset) =>
    set((state) => ({ writingGoalPresets: [...state.writingGoalPresets, preset] })),
  removeWritingGoalPreset: (presetId) =>
    set((state) => ({
      writingGoalPresets: state.writingGoalPresets.filter((preset) => preset.id !== presetId),
    })),
  toggleWritingGoal: () => set((state) => ({ isWritingGoalOpen: !state.isWritingGoalOpen })),
  closeWritingGoal: () => set({ isWritingGoalOpen: false }),
});
