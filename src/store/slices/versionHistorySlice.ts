import { StateCreator } from 'zustand';
import { AppState, VersionHistorySlice, SnapshotTrigger } from '../types';
import { generateId } from '../../utils/id';

const MAX_SNAPSHOTS = 50;

export const createVersionHistorySlice: StateCreator<AppState, [], [], VersionHistorySlice> = (set) => ({
  canvasSnapshots: [],
  isVersionHistoryOpen: false,

  addSnapshot: (trigger: SnapshotTrigger, description?: string) => set((state) => {
    const { canvasContent, activeCanvasFile } = state;
    if (!activeCanvasFile || !canvasContent) return state;

    const snapshot = {
      id: generateId('snap'),
      timestamp: Date.now(),
      content: canvasContent,
      trigger,
      fileName: activeCanvasFile,
      description,
    };

    // 같은 파일의 스냅샷만 필터링하여 제한 적용
    const fileSnapshots = state.canvasSnapshots.filter(s => s.fileName === activeCanvasFile);
    const otherSnapshots = state.canvasSnapshots.filter(s => s.fileName !== activeCanvasFile);

    let updatedFileSnapshots = [snapshot, ...fileSnapshots];
    if (updatedFileSnapshots.length > MAX_SNAPSHOTS) {
      updatedFileSnapshots = updatedFileSnapshots.slice(0, MAX_SNAPSHOTS);
    }

    return {
      canvasSnapshots: [...updatedFileSnapshots, ...otherSnapshots],
    };
  }),

  revertToSnapshot: (snapshotId: string) => set((state) => {
    const snapshot = state.canvasSnapshots.find(s => s.id === snapshotId);
    if (!snapshot) return state;

    return {
      canvasContent: snapshot.content,
    };
  }),

  deleteSnapshot: (snapshotId: string) => set((state) => ({
    canvasSnapshots: state.canvasSnapshots.filter(s => s.id !== snapshotId),
  })),

  setSnapshots: (snapshots) => set({ canvasSnapshots: snapshots }),

  toggleVersionHistory: () => set((state) => ({
    isVersionHistoryOpen: !state.isVersionHistoryOpen,
  })),

  closeVersionHistory: () => set({ isVersionHistoryOpen: false }),
});
