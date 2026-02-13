# SRC KNOWLEDGE BASE

## OVERVIEW
`src/`는 renderer 런타임(UI, 상태, API 어댑터) 소유 영역이다.

## STRUCTURE
```text
src/
├── components/     # 화면/상호작용 컴포넌트
├── store/          # Zustand store + slices
├── api/            # preload bridge wrapper
├── hooks/          # 고수준 UI orchestration hook
├── types/          # renderer shared types
└── prompts/        # 타입 호환 레이어만 유지
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 앱 루트 레이아웃 | `src/App.tsx` | desktop/mobile 분기 + autosave 트리거 |
| 렌더러 부트스트랩 | `src/main.tsx` | platform attribute + root mount |
| AI 요청 흐름 | `src/hooks/useChatRequest.ts` | phase event 수신/조합 |
| Electron API 접근 | `src/api/index.ts` | `window.electronAPI` wrapper |
| 상태 조합 | `src/store/useStore.ts` | slice 합성 지점 |
| 타입 기준점 | `src/types/chat.ts` | provider, message, writing goal |

## CONVENTIONS
- renderer는 Electron/Node API를 직접 호출하지 않고 반드시 `src/api/index.ts`를 경유한다.
- `src/prompts/*`는 실행 로직이 아닌 호환 타입 레이어다.
- 대형 컴포넌트는 store selector + api 호출을 혼합하므로 변경 시 사이드이펙트 확인이 필요하다.

## ANTI-PATTERNS
- 컴포넌트에서 IPC channel 문자열 직접 사용 금지 (`src/api`에 캡슐화).
- `pendingCanvasPatch`를 우회해 캔버스를 즉시 mutate하는 처리 금지.
- provider/auth 상태를 로컬 컴포넌트 state로 중복 보관 금지 (store 단일 소스 유지).
