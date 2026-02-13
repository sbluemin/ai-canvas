# STORE KNOWLEDGE BASE

## OVERVIEW
`src/store/`는 단일 Zustand store에 6개 slice를 합성해 앱 전역 상태를 관리한다.

## STRUCTURE
```text
src/store/
├── useStore.ts         # slice 합성 + store export
├── types.ts            # AppState/도메인 타입
├── slices/
│   ├── chatSlice.ts
│   ├── uiSlice.ts
│   ├── projectSlice.ts
│   ├── modelSlice.ts
│   ├── writingGoalSlice.ts
│   └── diffPreviewSlice.ts
└── utils.ts
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| slice 조합 구조 | `src/store/useStore.ts` | 단일 store 구성 지점 |
| 대화/실행 상태 | `src/store/slices/chatSlice.ts` | aiRun, messages, conversations |
| 프로젝트/캔버스 상태 | `src/store/slices/projectSlice.ts` | canvas 파일/트리/autosave |
| 모델/Variant 상태 | `src/store/slices/modelSlice.ts` | opencode model + variant 선택 |
| diff 선택 적용 | `src/store/slices/diffPreviewSlice.ts` | chunk pairing 로직 |

## CONVENTIONS
- slice는 `StateCreator<AppState, [], [], SliceType>` 패턴을 유지한다.
- 복합 상태 변경은 slice action 내부에서 일관되게 처리하고 컴포넌트에서 분산 처리하지 않는다.
- 테스트는 `getState()/setState()` 기반으로 작성되어 slice action 안정성이 중요하다.

## ANTI-PATTERNS
- middleware 도입 전 기존 액션 시그니처를 변경해 렌더러 전역 영향 발생시키는 변경 금지.
- `pendingCanvasPatch`를 project slice로 흡수하는 구조 변경 금지 (diff 도메인 분리 유지).
