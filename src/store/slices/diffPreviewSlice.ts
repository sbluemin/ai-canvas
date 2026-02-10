import { StateCreator } from 'zustand';
import { AppState, DiffPreviewSlice } from '../types';

export const createDiffPreviewSlice: StateCreator<AppState, [], [], DiffPreviewSlice> = (set) => ({
  pendingCanvasPatch: null,

  setPendingCanvasPatch: (patch) => set({ pendingCanvasPatch: patch }),

  toggleChunkSelection: (chunkId) => set((state) => {
    if (!state.pendingCanvasPatch) return state;
    const { chunks } = state.pendingCanvasPatch;
    const idx = chunks.findIndex(c => c.id === chunkId);
    if (idx === -1) return state;

    const chunk = chunks[idx];
    const newSelected = !chunk.selected;

    // 인접 remove/add 쌍을 함께 토글하여 데이터 손실 방지
    const pairedIds = new Set<string>([chunkId]);
    if (chunk.type === 'remove' && idx + 1 < chunks.length && chunks[idx + 1].type === 'add') {
      pairedIds.add(chunks[idx + 1].id);
    } else if (chunk.type === 'add' && idx - 1 >= 0 && chunks[idx - 1].type === 'remove') {
      pairedIds.add(chunks[idx - 1].id);
    }

    return {
      pendingCanvasPatch: {
        ...state.pendingCanvasPatch,
        chunks: chunks.map(c =>
          pairedIds.has(c.id) ? { ...c, selected: newSelected } : c
        ),
      },
    };
  }),

  selectAllChunks: () => set((state) => {
    if (!state.pendingCanvasPatch) return state;
    return {
      pendingCanvasPatch: {
        ...state.pendingCanvasPatch,
        chunks: state.pendingCanvasPatch.chunks.map((chunk) => ({ ...chunk, selected: true })),
      },
    };
  }),

  deselectAllChunks: () => set((state) => {
    if (!state.pendingCanvasPatch) return state;
    return {
      pendingCanvasPatch: {
        ...state.pendingCanvasPatch,
        chunks: state.pendingCanvasPatch.chunks.map((chunk) =>
          chunk.type === 'equal' ? chunk : { ...chunk, selected: false }
        ),
      },
    };
  }),

  applyPendingPatch: () => set((state) => {
    if (!state.pendingCanvasPatch) return state;
    const { chunks } = state.pendingCanvasPatch;
    let result = '';
    for (const chunk of chunks) {
      if (chunk.type === 'equal') {
        result += chunk.value;
      } else if (chunk.type === 'add' && chunk.selected) {
        result += chunk.value;
      } else if (chunk.type === 'remove' && !chunk.selected) {
        result += chunk.value;
      }
    }
    return {
      canvasContent: result,
      pendingCanvasPatch: null,
    };
  }),

  discardPendingPatch: () => set({ pendingCanvasPatch: null }),
});
