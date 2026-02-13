# IPC KNOWLEDGE BASE

## OVERVIEW
`electron/ipc/`는 메인 프로세스에서 채널별 handler를 등록하고 renderer API surface와 연결한다.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| handler 등록 순서 | `electron/ipc/index.ts` | dialog/fs/project/ai/window 등록 |
| AI+Auth 채널 | `electron/ipc/ai.ts` | `ai:*`, `{provider}:auth:*` |
| 프로젝트 파일 관리 | `electron/ipc/project.ts` | `.ai-canvas` CRUD + export |
| 파일 IO 단순 래퍼 | `electron/ipc/fs.ts` | `fs:readFile`, `fs:writeFile` |
| 네이티브 다이얼로그 | `electron/ipc/dialog.ts` | open/save dialog |
| 윈도우 제어 | `electron/ipc/window.ts` | `window:create` |

## CONVENTIONS
- renderer는 채널명을 직접 호출하지 않고 `preload.ts -> src/api/index.ts`를 통해 호출한다.
- `project.ts`는 경로 검증 유틸(`isValidCanvasFileName`, `isValidCanvasFolderPath`)을 먼저 통과해야 한다.
- 채널 추가 시 반드시 preload API와 `src/api/index.ts`를 함께 확장한다.

## CHANNEL MAP
- `ai:*` + `{provider}:auth:*` -> `electron/ipc/ai.ts`.
- `project:*` -> `electron/ipc/project.ts`.
- `fs:*` -> `electron/ipc/fs.ts`.
- `dialog:*` -> `electron/ipc/dialog.ts`.
- `window:*` -> `electron/ipc/window.ts`.

## CHANGE CHECKLIST
- 신규 채널 추가 시 1) handler 등록 2) preload 노출 3) `src/api` wrapper 4) 호출부 타입 반영을 한 번에 완료한다.
- `project.ts` 수정 시 ENOENT와 사용자 취소(canceled) 케이스 반환 계약을 깨지 않도록 유지한다.
- export 관련 채널 수정 시 html/pdf/docx/aic 포맷별 분기 테스트 포인트를 유지한다.

## ANTI-PATTERNS
- 채널만 추가하고 preload/api bridge를 누락하는 반쪽 구현 금지.
- `project.ts`에서 경로 검증 없이 파일시스템 작업 수행 금지.
- 핸들러 내부에서 UI 상태 의존 로직(렌더러 전용 상태) 작성 금지.
