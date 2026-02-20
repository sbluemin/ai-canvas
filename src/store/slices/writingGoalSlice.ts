import { StateCreator } from 'zustand';
import { AppState, WritingGoalSlice } from '../types';
import { WritingGoalPreset } from '../../types/chat';

const DEFAULT_WRITING_GOAL_PRESETS: WritingGoalPreset[] = [
  {
    id: 'sdd-specify',
    name: 'SDD · Specify (PRD-lite)',
    goal: {
      purpose: `[SDD: Specify]
목표: 사용자 기능 요청을 다른 PO 관점의 PRD-lite 문서로 구체화한다.
포함: 기능 범위, 사용자 플로우, 화면/상태, 기대 결과, 엣지케이스/오류 처리, 비범위, 오픈 퀘스천.
제외: 성공 지표(OKR/KPI), 일정, 구현 상세(코드/파일/함수/아키텍처).

출력 템플릿:
## 요약
## 문제/배경
## 대상 사용자/시나리오
## 요구사항 (MUST/SHOULD/COULD)
## 사용자 플로우
## 화면/상태
## 기대 결과
## 엣지케이스/오류 처리
## 비범위(Non-goals)
## 오픈 퀘스천`,
      audience: 'PO/디자이너/엔지니어 (협업 관점)',
      tone: '명확하고 간결하게, 관찰 가능한 결과 중심. 코드 금지.',
      targetLength: 'long',
    },
  },
  {
    id: 'sdd-plan',
    name: 'SDD · Plan (Execution Plan)',
    goal: {
      purpose: `[SDD: Plan]
목표: Specify 문서를 실행 가능한 계획으로 변환한다. 코드 작성은 하지 않는다.
포함: 단계/순서, 역할/영역 단위 작업 항목, 의존성, 리스크, 완료 조건(DoD).
제외: 코드/함수/파일 단위 상세, 장황한 구현 설명.

출력 템플릿:
## Plan Summary (5줄)
## Milestones / Sequence
## Work Items (역할/영역)
## Dependencies
## Risks & Mitigations
## Definition of Done
## Open Questions / Assumptions`,
      audience: 'PO/Tech Lead/개발자',
      tone: '실행 계획 중심, 짧은 불릿 위주. 코드 금지.',
      targetLength: 'medium',
    },
  },
  {
    id: 'sdd-decompose',
    name: 'SDD · Decompose (Ticket Breakdown)',
    goal: {
      purpose: `[SDD: Decompose]
목표: Plan을 티켓 단위로 분해해 바로 착수 가능한 backlog를 만든다.
각 티켓은 목적/산출물/수락 기준이 명확해야 한다.
제외: 코드/알고리즘/함수 구현 상세.

티켓 템플릿 (각 항목 반복):
- 제목:
- 목적/산출물:
- 범위 (영향 영역: UI/State/IPC/Prompts/Tests 등 영역 레벨):
- 수락 기준 (AC):
- 의존성:
- 난이도 (S/M/L):`,
      audience: '개발자/PM',
      tone: '티켓은 짧고 명확하게. 코드 금지.',
      targetLength: 'long',
    },
  },
  {
    id: 'sdd-implement-scope',
    name: 'SDD · Implement (Scope Estimation)',
    goal: {
      purpose: `[SDD: Implement (Scope)]
목표: 실제 코드는 작성하지 않고, 구현을 위한 코드 레벨 작업 범위를 산출한다.
허용: 파일/모듈/IPC/상태 slice/테스트 위치 같은 터치포인트와 작업량 추정.
금지: 전체 코드 구현, 긴 코드 블록, 장황한 소스 나열.

출력 템플릿:
## Touchpoints
## 예상 변경 파일/모듈 목록 (1줄 요약)
## 작업 분해 (순서)
## 리스크/회귀 포인트
## Rough Estimate`,
      audience: 'Tech Lead/개발자',
      tone: '구체적으로 작성하되 코드는 쓰지 않는다.',
      targetLength: 'medium',
    },
  },
  {
    id: 'sdd-validate',
    name: 'SDD · Validate (Test Plan)',
    goal: {
      purpose: `[SDD: Validate]
목표: Spec 기준 동작 검증을 위한 수락 기준 + 테스트 플랜을 만든다.
포함: AC, 시나리오(정상/엣지/오류/회귀), 전제조건, 릴리즈 체크리스트.
제외: 성공 지표(OKR/KPI), 구현 상세 코드.

출력 템플릿:
## Acceptance Criteria
## Test Matrix
## Preconditions (data/roles/env)
## Regression Checklist
## Release/Rollback Notes (필요 시)`,
      audience: 'PO/QA/개발자',
      tone: '체크리스트/시나리오 중심. 코드 금지.',
      targetLength: 'medium',
    },
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
