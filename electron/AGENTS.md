# ELECTRON KNOWLEDGE BASE

## OVERVIEW
`electron/`은 메인 프로세스, preload bridge, IPC handler, OpenCode 기반 AI 런타임을 담당한다.

## STRUCTURE
```text
electron/
├── main.ts          # BrowserWindow, CSP, updater
├── preload.ts       # contextBridge API
├── ipc/             # namespace별 handler 등록
├── ai/              # 2-phase workflow + parser
├── prompts/         # phase prompt builders/schemas
└── ai-backend/      # OpenCode runtime manager (cross-spawn)
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 앱 윈도우/CSP | `electron/main.ts` | sandbox/contextIsolation 강제 |
| API 노출 | `electron/preload.ts` | renderer 접근 가능한 표면적 |
| IPC 진입점 | `electron/ipc/index.ts` | 핸들러 wiring |
| AI 실행 엔진 | `electron/ai/workflow.ts` | phase 전환 + 이벤트 송신 |
| provider 통합 호출 | `electron/ai/providerAdapter.ts` | ai-backend chat adapter |
| OpenCode 런타임 | `electron/ai-backend/opencodeRuntime.ts` | spawn~exit, stream parsing, shutdown |
| 모델 조회 | `electron/api/models.ts` | ai-backend 경유 ai:fetch-models backend |

## CONVENTIONS
- IPC 채널은 prefix 기반 네임스페이스를 유지한다 (`ai:`, `project:`, `fs:`, `dialog:`, `window:`).
- preload는 CJS 번들만 허용 (`--format=cjs`).

## ANTI-PATTERNS
- `nodeIntegration: true` 또는 preload 우회 접근 허용 금지.
- renderer에 provider 토큰/secret 직접 노출 금지.
- `dist-electron/` 산출물을 소스로 편집하는 작업 금지.
