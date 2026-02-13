# ELECTRON KNOWLEDGE BASE

## OVERVIEW
`electron/`은 메인 프로세스, preload bridge, IPC handler, OpenCode 기반 AI 런타임을 담당한다.

## STRUCTURE
```text
electron/
├── main.ts              # BrowserWindow, CSP, updater
├── preload.ts           # contextBridge API
│
├── core/                # 공유 인프라 (IPC 유틸, 상수, 경로 헬퍼)
│   ├── index.ts         # 배럴 export
│   ├── ipc.ts           # handleIpc 유틸
│   ├── consts.ts        # 앱 상수 (.ai-canvas, 기본 파일명 등)
│   └── utils.ts         # 경로/마크다운 유틸
│
├── ipc/                 # 네임스페이스별 IPC 핸들러 등록 (얇은 라우팅 레이어)
│   ├── index.ts         # 핸들러 wiring
│   ├── ai.ts            # ai:* 채널
│   ├── dialog.ts        # dialog:* 채널
│   ├── fs.ts            # fs:* 채널
│   ├── project.ts       # project:* 채널 (서비스 위임)
│   └── window.ts        # window:* 채널
│
├── services/            # 비즈니스 로직 서비스
│   ├── index.ts         # 배럴 export
│   ├── project.service.ts  # 캔버스 파일 시스템 CRUD
│   └── export.service.ts   # 문서 내보내기 (HTML/PDF/DOCX)
│
├── ai/                  # 2-phase AI 워크플로우 엔진
│   ├── index.ts         # 배럴 export
│   ├── types.ts         # AiChatRequest, AiChatEvent 등
│   ├── workflow.ts      # phase 전환 + 이벤트 송신
│   ├── parser.ts        # JSON 추출 + schema/fallback
│   ├── parser.test.ts   # parser 회귀 테스트
│   ├── providerAdapter.ts  # ai-backend chat adapter
│   └── models.ts        # 모델 조회/파싱
│
├── ai-backend/          # OpenCode 런타임 관리 (API 계층만 노출)
│   ├── index.ts         # 공개 API surface (chatWithOpenCode, fetchModels, shutdown)
│   ├── client.ts        # 런타임 싱글톤 + API 함수
│   ├── runtime.ts       # 프로세스 매니저 (spawn/kill)
│   ├── binary-resolver.ts  # Windows 바이너리 탐색
│   └── types.ts         # OpenCode 관련 타입
│
└── prompts/             # 프롬프트 빌더/스키마
    ├── index.ts         # 배럴 export
    ├── canvas.ts        # 토큰 추정/캔버스 truncation
    ├── system.ts        # Phase1/Phase2 프롬프트 구성
    └── types.ts         # Zod 스키마 + 검증 함수
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 앱 윈도우/CSP | `main.ts` | sandbox/contextIsolation 강제 |
| API 노출 | `preload.ts` | renderer 접근 가능한 표면적 |
| IPC 진입점 | `ipc/index.ts` | 핸들러 wiring |
| IPC 유틸 | `core/ipc.ts` | handleIpc 헬퍼 |
| 프로젝트 비즈니스 로직 | `services/project.service.ts` | 캔버스 CRUD, 세션, 에셋 |
| 문서 내보내기 | `services/export.service.ts` | HTML/PDF/DOCX |
| AI 실행 엔진 | `ai/workflow.ts` | phase 전환 + 이벤트 송신 |
| provider 통합 호출 | `ai/providerAdapter.ts` | ai-backend chat adapter |
| OpenCode API | `ai-backend/index.ts` | 런타임 캡슐화 (client → runtime) |
| OpenCode 프로세스 | `ai-backend/runtime.ts` | spawn~exit, stream parsing |
| 바이너리 탐색 | `ai-backend/binary-resolver.ts` | Windows .exe 해석 |
| 모델 조회 | `ai/models.ts` | ai-backend 경유 모델 목록 |

## CONVENTIONS
- IPC 채널은 prefix 기반 네임스페이스를 유지한다 (`ai:`, `project:`, `fs:`, `dialog:`, `window:`).
- IPC 핸들러는 얇은 라우팅 레이어로만 사용하고, 비즈니스 로직은 `services/`에 위임한다.
- `ai-backend/`은 `index.ts`를 통해서만 외부에 API를 노출한다 (`client.ts`, `runtime.ts`, `binary-resolver.ts`는 내부 구현).
- `core/`의 유틸은 모든 모듈에서 공유 가능하다.
- preload는 CJS 번들만 허용 (`--format=cjs`).

## ANTI-PATTERNS
- `nodeIntegration: true` 또는 preload 우회 접근 허용 금지.
- renderer에 provider 토큰/secret 직접 노출 금지.
- `dist-electron/` 산출물을 소스로 편집하는 작업 금지.
- `ai-backend/runtime.ts`이나 `binary-resolver.ts`를 외부에서 직접 import 금지 (index.ts 경유).
- IPC 핸들러에 비즈니스 로직을 직접 작성하지 않고 서비스로 위임.
