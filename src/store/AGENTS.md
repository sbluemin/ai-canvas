# STORE KNOWLEDGE BASE

## OVERVIEW
`src/store/`는 단일 Zustand store에 7개 slice를 합성해 앱 전역 상태를 관리한다.

## STRUCTURE
```text
src/store/
├── useStore.ts           # slice 합성 + store export
├── useStore.test.ts      # store 통합 테스트
├── types.ts              # AppState = 7 slice intersection 타입
├── utils.ts              # store 유틸리티
└── slices/
    ├── chatSlice.ts        # messages, conversations, aiRun
    ├── uiSlice.ts          # drawer, modals, commandPalette, toasts, settings, canvasWidthMode
    ├── projectSlice.ts     # canvasContent, features, canvasFiles, canvasTree, autosave
    ├── modelSlice.ts       # availableModels, selectedModels, selectedVariant
    ├── writingGoalSlice.ts # activeWritingGoal, presets
    └── runtimeSlice.ts     # runtimeStatus, onboarding, runtime busy/error
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| slice 조합 구조 | `useStore.ts` | 단일 store 구성 지점 |
| 대화/실행 상태 | `slices/chatSlice.ts` | aiRun, messages, conversations |
| 프로젝트/캔버스 상태 | `slices/projectSlice.ts` | Feature, canvas 파일/트리, autosave |
| 모델/Variant 상태 | `slices/modelSlice.ts` | opencode model + variant 선택 |
| store 테스트 | `useStore.test.ts` | getState()/setState() 기반 |

## CONVENTIONS
- slice 시그니처: `StateCreator<AppState, [], [], SliceType>`.
- 복합 상태 변경은 slice action 내부에서 일관 처리 (컴포넌트 분산 처리 금지).
- 테스트는 `getState()/setState()` 기반 — slice action 안정성이 중요.

## ANTI-PATTERNS
- 기존 액션 시그니처를 변경해 렌더러 전역 영향 발생시키는 변경 금지.
