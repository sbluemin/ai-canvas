# ELECTRON KNOWLEDGE BASE

## OVERVIEW
`electron/`은 메인 프로세스, preload bridge, IPC handler, OpenCode 기반 AI 런타임을 담당한다.

## STRUCTURE
```text
electron/
├── main.ts              # BrowserWindow, CSP, updater
├── preload.ts           # contextBridge API (CJS 빌드)
│
├── core/                # 공유 인프라
│   ├── ipc.ts           # handleIpc 유틸
│   ├── consts.ts        # 앱 상수 (.ai-canvas, 기본 파일명 등)
│   └── utils.ts         # 경로/마크다운 유틸
│
├── ipc/                 # 네임스페이스별 IPC 핸들러 (얇은 라우팅 레이어)
│   ├── ai.ts            # ai:* 채널
│   ├── dialog.ts        # dialog:* 채널
│   ├── fs.ts            # fs:* 채널
│   ├── project.ts       # project:* 채널 (서비스 위임)
│   ├── settings.ts      # settings:* 채널 (electron-store, titleBarOverlay 테마 동기화)
│   └── window.ts        # window:* 채널
│
├── services/            # 비즈니스 로직
│   ├── project.service.ts  # Feature/캔버스 CRUD, 세션, 에셋, 파일 인덱스
│   └── export.service.ts   # HTML/PDF/DOCX 내보내기
│
├── ai/                  # 2-phase AI 워크플로우 엔진
│   ├── workflow.ts      # phase 전환 + 이벤트 송신
│   ├── providerAdapter.ts  # ai-backend chat adapter
│   ├── parser.ts        # JSON 추출 + schema/fallback
│   ├── parser.test.ts   # parser 회귀 테스트
│   ├── models.ts        # 모델 조회/파싱
│   └── types.ts         # AiChatRequest, AiChatEvent 등
│
├── ai-backend/          # OpenCode 런타임 (API 계층만 노출)
│   ├── index.ts         # 공개 API surface (chatWithOpenCode, fetchModels, shutdown)
│   ├── client.ts        # 런타임 싱글톤 + API 함수 (내부)
│   ├── runtime.ts       # 프로세스 spawn/kill (내부)
│   ├── binary-resolver.ts  # Windows 바이너리 탐색 (내부)
│   └── types.ts         # OpenCode 타입
│
└── prompts/             # 프롬프트 빌더/스키마
    ├── system.ts        # Phase1/Phase2 프롬프트 구성
    ├── canvas.ts        # 토큰 추정/캔버스 truncation
    └── types.ts         # Zod 스키마 + 검증 함수
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 앱 윈도우/CSP | `main.ts` | sandbox/contextIsolation 강제 |
| API 노출 | `preload.ts` | renderer 접근 가능한 표면적 |
| IPC 유틸 | `core/ipc.ts` | handleIpc 헬퍼 |
| 프로젝트 비즈니스 로직 | `services/project.service.ts` | Feature/캔버스 CRUD, 세션, 에셋 |
| 문서 내보내기 | `services/export.service.ts` | HTML/PDF/DOCX |
| 앱 설정 | `ipc/settings.ts` | electron-store 기반, Windows titleBarOverlay 테마 동기화 |
| AI 실행 엔진 | `ai/workflow.ts` | phase 전환 + 이벤트 송신 |
| OpenCode API | `ai-backend/index.ts` | 런타임 캡슐화 (client → runtime) |
| 모델 조회 | `ai/models.ts` | ai-backend 경유 모델 목록 |

## CONVENTIONS
- IPC 채널: prefix 네임스페이스 (`ai:`, `project:`, `fs:`, `dialog:`, `settings:`, `window:`).
- IPC 핸들러는 라우팅만 담당, 비즈니스 로직은 `services/`에 위임.
- `ai-backend/`은 `index.ts` 통해서만 외부 API 노출 (client/runtime/binary-resolver는 내부).
- preload는 CJS 번들만 허용 (`--format=cjs`).

## ANTI-PATTERNS
- `nodeIntegration: true` 또는 preload 우회 접근 금지.
- renderer에 provider 토큰/secret 직접 노출 금지.
- `dist-electron/` 산출물 직접 편집 금지.
- `ai-backend/runtime.ts`·`binary-resolver.ts` 외부 직접 import 금지 (index.ts 경유).
- IPC 핸들러에 비즈니스 로직 직접 작성 금지 (서비스 위임).
