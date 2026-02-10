import { StateCreator } from 'zustand';
import { AppState, WritingGoalSlice } from '../types';
import { WritingGoalPreset } from '../../types/chat';

const DEFAULT_WRITING_GOAL_PRESETS: WritingGoalPreset[] = [
  {
    id: 'meeting-notes',
    name: '회의록',
    goal: { purpose: '회의 내용 정리 및 결정사항 기록', audience: '팀원', tone: '간결하고 명확한', targetLength: 'medium' },
  },
  {
    id: 'proposal',
    name: '제안서',
    goal: { purpose: '프로젝트 또는 아이디어 제안', audience: '의사결정자/경영진', tone: '격식체, 전문적', targetLength: 'long' },
  },
  {
    id: 'tech-doc',
    name: '기술 문서',
    goal: { purpose: '기술 사양 및 구현 가이드 작성', audience: '개발자', tone: '정확하고 체계적인', targetLength: 'long' },
  },
  {
    id: 'blog-post',
    name: '블로그 포스트',
    goal: { purpose: '지식 공유 및 인사이트 전달', audience: '일반 독자', tone: '친근하고 이해하기 쉬운', targetLength: 'medium' },
  },
];

export const createWritingGoalSlice: StateCreator<AppState, [], [], WritingGoalSlice> = (set) => ({
  activeWritingGoal: null,
  writingGoalPresets: DEFAULT_WRITING_GOAL_PRESETS,
  isWritingGoalOpen: false,

  setActiveWritingGoal: (goal) => set({ activeWritingGoal: goal }),
  setWritingGoalPresets: (presets) => set({ writingGoalPresets: presets }),
  addWritingGoalPreset: (preset) =>
    set((state) => ({ writingGoalPresets: [...state.writingGoalPresets, preset] })),
  removeWritingGoalPreset: (presetId) =>
    set((state) => ({
      writingGoalPresets: state.writingGoalPresets.filter((p) => p.id !== presetId),
    })),
  toggleWritingGoal: () => set((state) => ({ isWritingGoalOpen: !state.isWritingGoalOpen })),
  closeWritingGoal: () => set({ isWritingGoalOpen: false }),
});
