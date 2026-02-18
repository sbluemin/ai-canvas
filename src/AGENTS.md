# SRC KNOWLEDGE BASE

## OVERVIEW
`src/`는 renderer 런타임(UI, 상태, API 어댑터) 소유 영역이다.

## STRUCTURE
```text
src/
├── components/          # 화면/상호작용 컴포넌트 (→ components/AGENTS.md)
├── store/               # Zustand store + slices (→ store/AGENTS.md)
├── hooks/               # 고수준 UI orchestration hook
│   └── useChatRequest.ts  # AI Phase 1/2 이벤트 수신/조합
├── context/             # React Context
│   └── EditorContext.tsx  # Milkdown Editor ref 공유 (EditorProvider + useEditorContext)
├── api/                 # preload bridge wrapper
│   └── index.ts         # Electron/Web 분기, IPC 래퍼
├── utils/               # 공용 유틸리티
│   ├── logger.ts        # 레벨 기반 Logger 싱글톤 (dev=debug)
│   ├── id.ts            # generateId (prefix + timestamp + random)
│   ├── parser.ts        # AI 응답 JSON 추출
│   └── constants.ts     # AUTOSAVE_DELAY 등 앱 상수
├── types/               # 공용 타입 (chat.ts, api.ts, electron.d.ts)
└── prompts/             # 타입 호환 레이어 (실제 로직은 electron/prompts)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 앱 루트 레이아웃 | `App.tsx` | desktop/mobile 분기 + autosave 트리거 |
| 렌더러 부트스트랩 | `main.tsx` | platform attribute + root mount |
| AI 요청 흐름 | `hooks/useChatRequest.ts` | phase event 수신/조합 |
| Electron API 접근 | `api/index.ts` | `window.electronAPI` wrapper |
| 에디터 ref 공유 | `context/EditorContext.tsx` | Milkdown Editor ref Provider |
| 상태 조합 | `store/useStore.ts` | slice 합성 지점 |
| 타입 기준점 | `types/chat.ts` | provider, message, writing goal |

## CONVENTIONS
- renderer는 Electron/Node API를 직접 호출하지 않고 반드시 `api/index.ts`를 경유한다.
- `prompts/*`는 실행 로직이 아닌 호환 타입 레이어다.
- 에디터 인스턴스 접근은 `useEditorContext()` 훅을 통해서만 수행한다.

## ANTI-PATTERNS
- 컴포넌트에서 IPC channel 문자열 직접 사용 금지 (`api/`에 캡슐화).
- `pendingCanvasPatch`를 우회해 캔버스를 즉시 mutate 금지.
- provider/auth 상태를 로컬 컴포넌트 state로 중복 보관 금지 (store 단일 소스).
