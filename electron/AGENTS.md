# ELECTRON KNOWLEDGE BASE

## OVERVIEW
`electron/`은 메인 프로세스, preload bridge, IPC handler, OpenCode 기반 AI 런타임을 담당한다.

## STRUCTURE
```text
electron/
├── main.ts                # BrowserWindow, CSP, updater
├── preload.ts             # contextBridge API (CJS 빌드)
├── consts.ts              # 앱 상수
├── utils.ts               # 경로/마크다운/IPC 헬퍼 + ServiceResult
├── ipc-handlers.ts        # 모든 IPC 채널 등록 단일 엔트리
├── project.service.ts     # Feature/캔버스 CRUD, 세션, 에셋, 파일 인덱스
├── export.service.ts      # HTML/PDF/DOCX 내보내기
├── runtime.service.ts     # opencode 설치/로그인 안내/모드/상태 관리
├── ai-workflow.ts         # 2-phase 워크플로우 엔진
├── ai-prompts.ts          # 프롬프트 상수/빌더/스키마
├── ai-canvas-utils.ts     # 토큰 추정/캔버스 truncation
├── ai-parser.ts           # JSON 추출 + schema/fallback
├── ai-parser.test.ts      # parser 회귀 테스트
├── ai-models.ts           # 모델 조회/파싱
├── ai-types.ts            # AI/OpenCode 공용 타입
└── opencode-runtime/
    ├── runtime.ts         # 프로세스 spawn/kill + 공개 API
    └── binary-resolver.ts # Windows 바이너리 탐색
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 앱 윈도우/CSP | `main.ts` | sandbox/contextIsolation 강제 |
| API 노출 | `preload.ts` | renderer 접근 가능한 표면적 |
| IPC 핸들러 등록 | `ipc-handlers.ts` | 채널별 라우팅 일원화 |
| 프로젝트 비즈니스 로직 | `project.service.ts` | Feature/캔버스 CRUD, 세션, 에셋 |
| 문서 내보내기 | `export.service.ts` | HTML/PDF/DOCX |
| 런타임 설정 | `runtime.service.ts` | 프로젝트 로컬 opencode 설치/로그인 안내/모드 |
| AI 실행 엔진 | `ai-workflow.ts` | phase 전환 + 이벤트 송신 |
| 프롬프트/스키마 | `ai-prompts.ts` | planner/writer prompt + validator |
| OpenCode 런타임 API | `opencode-runtime/runtime.ts` | 런타임 캡슐화 |
| 모델 조회 | `ai-models.ts` | runtime 경유 모델 목록 |

## CONVENTIONS
- IPC 채널: prefix 네임스페이스 (`ai:`, `project:`, `fs:`, `dialog:`, `settings:`, `window:`, `runtime:`).
- IPC 핸들러는 라우팅만 담당, 비즈니스 로직은 `*.service.ts`에 위임.
- preload는 CJS 번들만 허용 (`--format=cjs`).
- 정적 agent 프롬프트/런타임 설정은 `ai-prompts.ts`를 단일 소스로 사용하며, 실행 시 `OPENCODE_CONFIG_CONTENT` 환경변수로 주입한다. (`.ai-canvas/.runtime`은 컨텍스트/인증 데이터 경로로 유지)

## ANTI-PATTERNS
- `nodeIntegration: true` 또는 preload 우회 접근 금지.
- renderer에 provider 토큰/secret 직접 노출 금지.
- `dist-electron/` 산출물 직접 편집 금지.
- IPC 핸들러에 비즈니스 로직 직접 작성 금지 (서비스 위임).
