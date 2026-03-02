# ELECTRON KNOWLEDGE BASE

## OVERVIEW
`electron/`은 메인 프로세스, preload bridge, IPC handler, pi SDK 기반 AI 런타임을 담당한다.

## STRUCTURE
```text
electron/
├── main.ts                     # BrowserWindow, CSP, updater
├── preload.ts                  # contextBridge API (CJS 빌드)
├── ai/
│   ├── workflow.ts             # 2-phase 워크플로우 엔진
│   ├── prompts.ts              # 통합 프롬프트/빌더/시그널 토큰
│   ├── parser.ts               # 시그널 스캐너 + 채팅 응답 파서
│   ├── parser.test.ts          # parser 회귀 테스트
│   ├── models.ts               # 모델 조회/파싱
│   ├── types.ts                # AI 공용 타입
│   ├── adapter.ts              # @mariozechner/pi-coding-agent SDK 어댑터
│   └── canvas-utils.ts         # 토큰 추정/캔버스 truncation
├── ipc/
│   ├── index.ts                # IPC 등록 통합 엔트리
│   ├── handlers/               # 채널군별 등록 (project/ai/settings/runtime/window)
│   ├── oauth-prompt.ts         # OAuth 입력/안내 UI 헬퍼
│   └── theme-store.ts          # 테마 저장소 read/write
├── project/
│   ├── index.ts                # 프로젝트 서비스 public API 재노출
│   ├── path.ts                 # projectPath → 글로벌 데이터 경로(GUID) 리졸버 + registry
│   ├── path.test.ts            # path/registry 단위 테스트
│   ├── feature.service.ts      # Feature 메타/정렬/기본 문서 생성
│   ├── canvas.service.ts       # 캔버스 파일·폴더 CRUD/트리/파일목록
│   ├── state.service.ts        # 채팅 세션/workspace/autosave 영속화
│   ├── assets.service.ts       # 이미지 에셋 저장
│   ├── context.ts              # projectPath -> projectDataDir 해석
│   └── types.ts                # 프로젝트 도메인 타입
├── runtime/service.ts          # auth.json 기반 인증 상태/API Key/OAuth 관리
├── export/service.ts           # HTML/PDF/DOCX 내보내기
└── shared/
    ├── consts.ts               # 앱 상수
    └── utils.ts                # 경로/마크다운/IPC 헬퍼 + ServiceResult
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 앱 윈도우/CSP | `main.ts` | sandbox/contextIsolation 강제 |
| API 노출 | `preload.ts` | renderer 접근 가능한 표면적 |
| IPC 핸들러 등록 | `ipc/index.ts` | 채널군별 등록 오케스트레이션 |
| 프로젝트 비즈니스 로직 | `project/*.service.ts` | Feature/캔버스 CRUD, 세션, 에셋 |
| 프로젝트 데이터 경로 해석 | `project/path.ts` | 글로벌 루트/registry/GUID 매핑 |
| 문서 내보내기 | `export/service.ts` | HTML/PDF/DOCX |
| 런타임 설정 | `runtime/service.ts` | auth 상태/온보딩 관리 |
| AI 실행 엔진 | `ai/workflow.ts` | phase 전환 + 이벤트 송신 |
| 프롬프트/시그널 | `ai/prompts.ts` | 통합 에이전트 prompt + 시그널 토큰 + validator |
| AI Agent 런타임 API | `ai/adapter.ts` | @mariozechner/pi-coding-agent SDK 경유 |
| 모델 조회 | `ai/models.ts` | adapter 경유 모델 목록 |

## CONVENTIONS
- IPC 채널: prefix 네임스페이스 (`ai:`, `project:`, `fs:`, `dialog:`, `settings:`, `window:`, `runtime:`).
- IPC 핸들러는 라우팅만 담당, 비즈니스 로직은 `project/*.service.ts`, `runtime/service.ts`, `ai/workflow.ts`에 위임.
- preload는 CJS 번들만 허용 (`--format=cjs`).
- 정적 agent 프롬프트는 `ai/prompts.ts`를 단일 소스로 사용하며, pi SDK 세션에서 직접 사용한다.
- AI 응답은 시그널 토큰(`⟨CANVAS⟩`, `⟨/CANVAS⟩`) 기반 자연어로 처리되며, `ai/parser.ts`의 `SignalScanner`가 스트리밍 중 시그널을 감지한다.

## ANTI-PATTERNS
- `nodeIntegration: true` 또는 preload 우회 접근 금지.
- renderer에 provider 토큰/secret 직접 노출 금지.
- `dist-electron/` 산출물 직접 편집 금지.
- IPC 핸들러에 비즈니스 로직 직접 작성 금지 (서비스 위임).
