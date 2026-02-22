# AI Canvas - Agent 가이드

> AI와 대화하며 마크다운 문서를 작성하는 **Electron 데스크톱 앱**

## ⚠️ Agent 필수 지침

**작업 완료 후 이 문서를 반드시 업데이트하세요:**
- 새 컴포넌트/파일 추가 시 → 프로젝트 구조, 아키텍처 섹션 수정
- 상태 구조 변경 시 → Zustand 인터페이스 수정
- 새 명령어 추가 시 → 명령어 섹션 수정
- 기술 스택 변경 시 → 기술 스택 테이블 수정

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite, Milkdown + PrismJS + KaTeX + Mermaid |
| Desktop | Electron 34 |
| AI | OpenCode CLI 런타임 관리 (`OPENCODE_CONFIG_DIR=.ai-canvas/.runtime` 프로젝트 단위 설정) |
| State | Zustand (7 slice 합성: `src/store/types.ts` 참조) |
| Styling | CSS (plain imports, `[data-theme]` / `[data-platform]` 기반 테마) |

---

## UI 디자인 시스템

### Glass & Layered Depth

투명도·블러·그림자로 레이어 구조를 형성하는 디자인 철학.

#### 핵심 원칙
1. **Glass Surface**: `backdrop-filter: blur()` + `rgba()` 반투명 배경
2. **Ghost Interaction**: 기본 border/bg 없음, hover 시에만 피드백
3. **Segment Grouping**: 관련 컨트롤을 단일 컨테이너에 묶어 위계 확보
4. **State Dot**: 텍스트 + 컬러 dot 조합, pulse/glow 애니메이션

#### 적용 컴포넌트
| 컴포넌트 | 패턴 |
|----------|------|
| ModelSelector | Intelligent Control Capsule — Runtime dot(global=초록/project=파란/missing=빨간) + Model 선택 + Refresh 통합. Split-Pane Glass 드롭다운 (Provider→Model→Variant 계층 선택) + Footer (런타임 상세/Setup) |
| Goal / Export / Settings | Ghost Button + 인라인 SVG |
| SettingsModal | Split Layout (Sidebar Nav + Content Area) |
| Width 컨트롤 | Glass Icon Toggle (3개 아이콘) |
| Save Status | Pulsing Dot Indicator |

#### 테마
- 다크: `rgba(30,31,32,0.65)` bg, `rgba(60,63,65,0.5)` border
- 라이트: `rgba(248,249,250,0.7)` bg, `rgba(218,220,224,0.6)` border
- CSS 선택자: `[data-theme='light']`

#### 변경 시 주의
- 새 컨트롤 추가 시 위 패턴 중 하나 적용 필수
- 아이콘: 외부 라이브러리 금지, **인라인 SVG**만 (stroke 기반, `currentColor`). 공유 아이콘은 `Icons.tsx`에 정의
- `backdrop-filter` 사용 시 `-webkit-backdrop-filter` 함께 선언
- Glass Surface 내부 요소에 `border: 1px solid` 사용 금지 (컨테이너 외곽만)

---

## 아키텍처

### 레이아웃
- **App.tsx**: 루트 — Allotment 좌우 분할 (모바일: 단일 캔버스)
- **CommandBar**: 상단 — ProjectSelector, ModelSelector(Intelligent Control Capsule: Runtime+Model+Refresh 통합), Goal/Export/Settings
- **ChatPanel**: 좌측 AI 채팅 (SSE 스트리밍, `@파일` 멘션, Feature별 세션 분리, 입력창 `Shift+Enter` 개행 + 자동 높이 확장)
- **OnboardingWizard**: 프로젝트별 OpenCode 설치/로그인 안내 온보딩 (설치→로그인 안내, 글로벌/로컬 선택)
- **CanvasPanel**: 우측 에디터 — MilkdownEditor, EditorToolbar, SelectionAiPopup, DiffPreview
- **FeatureExplorer**: Feature 트리 사이드바 (생성/삭제/이름변경, 아이콘, 드래그 정렬, 컨텍스트 메뉴, `New Document...` 기반 Blank/SDD 생성)
- **CommandPalette**: 전역 커맨드 팔레트 오버레이 (`Ctrl/Cmd+Shift+P`, MVP 1개 커맨드)
- **모달**: ErrorPopup, SettingsModal, ExportModal, WritingGoalModal, ToastContainer

### AI 채팅 흐름
1. 렌더러 → `ai:chat` IPC (runId, prompt, history, canvasContent, selection, modelId?, variant?, writingGoal?, fileMentions?)
2. Phase 1: `canvas-planner` 에이전트 → 의도 평가 → `phase_message_stream` → `phase1_result`
3. Phase 2 (needsCanvasUpdate=true): `canvas-writer` 에이전트 → 캔버스 변경 → `phase2_result` → `pendingCanvasPatch` → DiffPreview
4. 완료 → `done`

> 에이전트 프롬프트/런타임 설정 단일 소스: `electron/ai-prompts.ts` (`CANVAS_PLANNER_PROMPT`, `CANVAS_WRITER_PROMPT`, `buildRuntimeConfigJson`). 실행 시 이를 `OPENCODE_CONFIG_CONTENT` 환경변수로 주입한다. (`.ai-canvas/.runtime`은 컨텍스트/인증 데이터 경로로 유지)

### 이벤트 타입
- `{ runId, type:'phase', phase:'evaluating'|'updating' }`
- `{ runId, type:'phase_message_stream', phase, message }`
- `{ runId, type:'phase1_result', message, needsCanvasUpdate, updatePlan? }`
- `{ runId, type:'phase2_result', message, canvasContent }`
- `{ runId, type:'error', phase, error }` / `{ runId, type:'done' }`

### 상태 관리 (Zustand)
7개 slice 합성 (`src/store/types.ts`에 전체 인터페이스 정의):
- **ChatSlice**: messages, conversations, aiRun, 메시지별 Thinking Activity 체인(진행/완료/접힘 상태)
- **UiSlice**: drawer, modals, commandPalette, toasts, settings, canvasWidthMode
- **ProjectSlice**: canvasContent, features, canvasFiles, canvasTree, autosave
- **ModelSlice**: availableModels, selectedModels, selectedVariant
- **WritingGoalSlice**: activeWritingGoal, custom-only presets(기본 프리셋 없음)
- **DiffPreviewSlice**: pendingCanvasPatch, chunk 선택/적용
- **RuntimeSlice**: 런타임 상태(runtimeStatus), 온보딩 모달, 런타임 작업 busy/error

---

## 프로젝트 구조

```
ai-canvas/
├── src/                          # 렌더러 (→ src/AGENTS.md)
│   ├── components/               # UI 컴포넌트 (→ src/components/AGENTS.md)
│   │   ├── CommandBar/           # 상단 커맨드바 (ProjectSelector/, ModelSelector/)
│   │   ├── ChatPanel.tsx         # AI 채팅
│   │   ├── CanvasPanel.tsx       # 마크다운 에디터
│   │   ├── OnboardingWizard.tsx  # OpenCode 온보딩 위저드
│   │   ├── FeatureExplorer.tsx   # Feature 트리 사이드바
│   │   ├── CommandPalette.tsx    # 전역 커맨드 팔레트
│   │   ├── MilkdownEditor.tsx    # Milkdown WYSIWYG
│   │   ├── DiffPreview.tsx       # AI 수정안 diff
│   │   ├── SelectionAiPopup.tsx  # 텍스트 선택 AI 팝업
│   │   ├── Icons.tsx             # 공유 인라인 SVG 아이콘
│   │   └── *Modal.tsx, *Popup.tsx, ToastContainer.tsx, Logo.tsx, EditorToolbar.tsx
│   ├── store/                    # Zustand 상태 (→ src/store/AGENTS.md)
│   │   ├── useStore.ts           # slice 합성
│   │   ├── types.ts              # AppState/도메인 타입
│   │   └── slices/               # 7개 slice (RuntimeSlice 추가)
│   ├── hooks/useChatRequest.ts   # AI 채팅 오케스트레이션 훅
│   ├── context/EditorContext.tsx  # Milkdown Editor ref 공유 Context
│   ├── api/index.ts              # Electron IPC 래퍼
│   ├── utils/                    # 유틸리티 (logger, id, parser, constants, sddDocument)
│   ├── types/                    # 공용 타입 (chat.ts, api.ts, electron.d.ts)
├── electron/                     # 메인 프로세스 (→ electron/AGENTS.md)
│   ├── main.ts                   # BrowserWindow, CSP, updater
│   ├── preload.ts                # contextBridge API (CJS 빌드)
│   ├── consts.ts                 # 앱 상수
│   ├── utils.ts                  # 경로/마크다운/IPC 헬퍼 + 공통 타입
│   ├── ipc-handlers.ts           # IPC 핸들러 통합 등록 (ai/dialog/fs/project/settings/window/runtime)
│   ├── project.service.ts        # Feature/캔버스 CRUD, 세션, 에셋, 파일 인덱스
│   ├── export.service.ts         # HTML/PDF/DOCX 내보내기
│   ├── runtime.service.ts        # runtime:* 상태조회/설치/온보딩완료/모드전환
│   ├── ai-workflow.ts            # 2-phase AI 워크플로우 엔진
│   ├── ai-prompts.ts             # 정적 프롬프트 + 빌더 + 스키마 통합
│   ├── ai-canvas-utils.ts        # 토큰 추정/캔버스 truncation
│   ├── ai-parser.ts              # JSON 파싱
│   ├── ai-models.ts              # 모델 파싱/조회
│   ├── ai-types.ts               # AI/OpenCode 타입 정의
│   └── opencode-runtime/         # OpenCode CLI 런타임 (spawn/stream/kill)
├── tests/                        # Playwright E2E 테스트
├── .github/workflows/publish.yml # CI/CD (macOS + Windows → GitHub Release)
└── version.json                  # nbgv 버저닝 (커밋 높이 기반)
```

---

## 명령어

```bash
npm run dev          # Electron 개발 모드
npm run test:vitest  # 단위 테스트
npm run test:e2e     # Playwright E2E 테스트
npm run build        # 프로덕션 빌드
```

### 앱 단축키 (MVP)

- `Ctrl+Shift+P` / `Cmd+Shift+P`: 커맨드 팔레트 열기

---

## 빌드 및 배포

- **preload.js**: CJS 형식 필수 (esbuild `--format=cjs`로 자동 처리)
- **버저닝**: `package.json` version은 `0.0.0-placeholder` — nbgv가 CI에서 자동 stamp. **수동 변경 금지**
- **버전 올리기**: `version.json`의 `version` 필드 수정
- **CI/CD**: `main` push 시 macOS/Windows 매트릭스 빌드 → GitHub Release 자동 배포
