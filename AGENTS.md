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
| Desktop | Electron 34 (핵심 플랫폼) |
| AI | OpenCode CLI 런타임 관리 |
| State | Zustand |
| Styling | CSS Modules |

---

## 아키텍처

### 레이아웃
- **App.tsx**: 루트 - 반응형 레이아웃 (데스크톱: Allotment 좌우 분할, 모바일: 단일 캔버스)
- **CommandBar**: 상단 커맨드 바
  - **ProjectSelector**: 프로젝트 폴더 선택 (`.ai-canvas` 디렉터리 관리)
  - **ModelSelector**: OpenCode 모델 컨트롤 (Provider / Model / Variant)
  - **ModelRefreshButton**: 사용 가능한 모델 목록 갱신
- **ChatPanel**: 좌측 AI 채팅 패널 (SSE 스트리밍)
  - `@파일경로` 멘션 파싱 후 파일 참조 메타데이터 전달 (파일 본문/바이너리 직접 첨부 없음)
  - 프로젝트 루트 파일 인덱스 기반 `@` 자동완성 (IntelliSense 유사 키보드 탐색/선택)
- **CanvasPanel**: 우측 마크다운 에디터 패널
  - **MilkdownEditor**: 마크다운 WYSIWYG
  - **EditorToolbar**: 서식 도구
  - **SelectionAiPopup**: 텍스트 선택 시 AI 질문 팝업
  - **DiffPreview**: AI 수정안 diff 미리보기 (블록 선택 적용/취소)
  - **FileExplorer**: 폴더 기반 트리 뷰 사이드바 (토글 가능)
    - 폴더/파일 생성, 삭제, 이름 변경
    - 폴더 펼침/접기, 우클릭 컨텍스트 메뉴
    - 서브디렉토리 구조 지원 (예: `auth/login-flow.md`)
  - 캔버스 파일 탭: `.ai-canvas/**/*.md` 파일 간 전환 (활성 탭 클릭 시 이름 변경)
  - '+' 버튼: 새 캔버스 파일 생성
  - 탭 우클릭 컨텍스트 메뉴: 이름 변경 / 복제 / 삭제
  - 저장 상태 표시기: 자동 저장 상태 (대기/저장 중/저장됨/오류)
- **ErrorPopup**: AI 요청 오류 팝업
- **SettingsModal**: 앱 설정 (테마, 언어 등)
- **ExportModal**: 내보내기 모달 (HTML/PDF/DOCX)
- **WritingGoalModal**: 문서 목표 설정 모달 (목적/독자/톤/길이 설정, 프리셋 관리)
- **ToastContainer**: 시스템 알림 토스트 표시


### AI 인증
- OpenCode CLI 인증 사용 (`opencode auth login`)

### AI 오케스트레이션 (`electron/ai/`)
- **workflow.ts**: Phase 1/2 실행 흐름 제어, 이벤트 송신
- **providerAdapter.ts**: `electron/ai-backend` API 계층 호출 어댑터
- **parser.ts**: Phase 1/2 응답 JSON 파싱 및 fallback 처리
- **types.ts**: AI 요청/응답/이벤트 타입 정의
- **models.ts**: OpenCode 모델 목록 파싱/정렬

### AI 백엔드 런타임 (`electron/ai-backend/`)
- **index.ts**: 공개 API surface (런타임 내부 캡슐화)
- **client.ts**: 런타임 싱글톤 관리 + API 함수 (`chatWithOpenCode`, `fetchOpenCodeModelsVerbose`, `shutdownOpenCodeRuntime`)
- **runtime.ts**: OpenCode 프로세스 spawn/스트림 파싱/종료 구현체 (내부 전용)
- **binary-resolver.ts**: Windows 바이너리 탐색 로직 (내부 전용)
- **types.ts**: OpenCode 관련 타입 정의

### 프롬프트 시스템 (`electron/prompts/`)
- **system.ts**: Phase 1/2 프롬프트 빌더, 히스토리 압축
- **types.ts**: AI 응답 스키마 (Zod 검증)
- **canvas.ts**: 캔버스 컨텍스트 포맷팅, 토큰 추정

### API 모듈 (`src/api/`)
- **index.ts**: Electron/Web 분기 로직, IPC 래퍼 (`project:list-project-files` 포함)

### IPC 핸들러 (`electron/ipc/`)
- **index.ts**: IPC 핸들러 등록
- **ai.ts**: AI 관련 IPC
- **dialog.ts**: 파일/다이얼로그 IPC
- **fs.ts**: 파일 읽기/쓰기 IPC
- **project.ts**: 프로젝트/캔버스 관리 IPC (`project:list-project-files` 제공)
- **window.ts**: 윈도우 제어 IPC

### 렌더러 프롬프트 (`src/prompts/`)
- 경량 호환 레이어 (타입 export만 유지, 실제 로직은 electron/prompts 사용)

### Agent Harness (`.opencode/agents/`)
- **leader.md**: 작업 분석/계획/위임 전담 리더 (직접 코딩 금지)
- **ai_workflow_specialist.md**: AI Phase 1/2 워크플로우, 프롬프트, 파서 담당
- **electron_platform_specialist.md**: IPC/인증/보안/CSP 등 Electron 플랫폼 담당
- **renderer_experience_specialist.md**: React UI/UX, 상태 연동, 반응형 인터랙션 담당
- **quality_release_specialist.md**: 테스트/빌드/릴리즈 안정화 및 문서 동기화 담당

### 상태 관리 (Zustand)
```typescript
// src/store/useStore.ts

// 파일 멘션 메타데이터 (src/types/chat.ts)
interface FileMention {
  id: string;
  fileName: string;
  filePath: string;       // 프로젝트 기준 상대 경로 또는 입력 경로
}

// Message 인터페이스 (fileMentions 필드)
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: AiProvider;
  fileMentions?: FileMention[];  // '@' 멘션 파일 참조 목록
}

interface AppState {
  messages: Message[];           // 채팅 히스토리
  conversations: Conversation[]; // 대화 목록
  activeConversationId: string | null;
  canvasContent: string;         // 에디터 콘텐츠
  isLoading: boolean;            // AI 응답 대기
  currentFilePath: string | null;
  isDrawerOpen: boolean;         // 모바일 드로어
  aiRun: AiRunState | null;      // AI 실행 상태
  errorPopup: ErrorInfo | null;  // 오류 팝업
  autosaveStatus: AutosaveStatus; // 자동 저장 상태
  
  // 프로젝트/캔버스 파일 관리
  projectPath: string | null;    // 선택된 프로젝트 경로
  canvasFiles: string[];         // .ai-canvas 내 .md 파일 목록 (서브디렉토리 포함)
  activeCanvasFile: string | null; // 현재 열린 캔버스 파일명 (예: "auth/login.md")
  canvasTree: TreeEntry[];       // 재귀적 폴더/파일 트리 구조
  isFileExplorerOpen: boolean;   // 파일 탐색기 사이드바 열림 상태

  // 모델 선택 및 설정
  availableModels: AvailableModels;
  selectedModels: SelectedModels;     // 마지막 선택 모델 (프로젝트 workspace 기준)
  selectedVariant: string | null;     // 마지막 선택 variant
  modelsLoading: boolean;
  
  // 문서 작성 목표
  activeWritingGoal: WritingGoal | null;    // 활성 문서 목표
  writingGoalPresets: WritingGoalPreset[];  // 목표 프리셋 목록
  isWritingGoalOpen: boolean;               // 목표 모달 열림 상태

  // AI 수정안 Diff 미리보기
  pendingCanvasPatch: PendingCanvasPatch | null; // Phase 2 후보 변경안
  
  settings: AppSettings;
  isSettingsOpen: boolean;
  isExportModalOpen: boolean;
  toasts: ToastInfo[];
}
```

---

## 프로젝트 구조

```
ai-canvas/
├── src/
│   ├── components/              # React 컴포넌트
│   │   ├── Logo.tsx             # 공유 로고 컴포넌트
│   │   ├── CommandBar/          # 상단 커맨드바
│   │   │   ├── index.tsx
│   │   │   ├── CommandBar.css
│   │   │   ├── ProjectSelector/
│   │   │   ├── ModelSelector/
│   │   │   ├── ModelRefreshButton/
│   │   ├── CanvasPanel.tsx      # 마크다운 에디터 패널
│   │   ├── CanvasPanel.css
│   │   ├── ChatPanel.tsx        # AI 채팅 패널
│   │   ├── ChatPanel.css
│   │   ├── ErrorPopup.tsx       # 오류 팝업
│   │   ├── ErrorPopup.css
│   │   ├── ExportModal.tsx      # 내보내기 모달
│   │   ├── ExportModal.css
│   │   ├── SettingsModal.tsx    # 앱 설정 모달
│   │   ├── SettingsModal.css
│   │   ├── WritingGoalModal.tsx  # 문서 목표 설정 모달
│   │   ├── WritingGoalModal.css
│   │   ├── ToastContainer.tsx   # 토스트 알림 컨테이너
│   │   ├── ToastContainer.css
│   │   ├── MilkdownEditor.tsx   # Milkdown 래퍼
│   │   ├── EditorToolbar.tsx    # 에디터 도구모음
│   │   ├── SelectionAiPopup.tsx # 텍스트 선택 AI 팝업
│   │   ├── DiffPreview.tsx      # AI 수정안 diff 미리보기
│   │   ├── DiffPreview.css
│   │   ├── FileExplorer.tsx     # 폴더 기반 트리 뷰 사이드바
│   │   ├── FileExplorer.css
│   │   └── ...
│   ├── store/useStore.ts        # Zustand 상태
│   ├── hooks/useChatRequest.ts  # 채팅 요청 훅 (Phase 1/2 흐름)
│   ├── api/                     # 클라이언트 API
│   │   └── index.ts             # Electron/Web 분기 로직
│   ├── prompts/                 # AI 프롬프트 시스템
│   │   ├── system.ts            # Phase 1/2 프롬프트 빌더
│   │   ├── types.ts             # 응답 스키마 (Zod)
│   │   ├── canvas.ts            # 캔버스 컨텍스트 유틸
│   │   └── index.ts
│   ├── types/                   # 공용 타입 정의
│   │   ├── api.ts
│   │   ├── chat.ts
│   │   └── index.ts
│   ├── utils/                   # 공용 유틸리티
│   │   ├── parser.ts            # AI 응답 파서 (JSON 추출)
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── electron/
│   ├── main.ts                  # BrowserWindow, CSP, updater
│   ├── preload.ts               # contextBridge API
│   ├── core/                    # 공유 인프라
│   │   ├── index.ts             # 배럴 export
│   │   ├── ipc.ts               # handleIpc 유틸
│   │   ├── consts.ts            # 앱 상수
│   │   └── utils.ts             # 경로/마크다운 유틸
│   ├── ipc/                     # IPC 핸들러 (얇은 라우팅 레이어)
│   │   ├── index.ts
│   │   ├── ai.ts
│   │   ├── dialog.ts
│   │   ├── fs.ts
│   │   ├── project.ts           # services/project.service 위임
│   │   └── window.ts
│   ├── services/                # 비즈니스 로직 서비스
│   │   ├── index.ts
│   │   ├── project.service.ts   # 캔버스 CRUD, 세션, 에셋, 프로젝트 루트 파일 인덱스
│   │   └── export.service.ts    # HTML/PDF/DOCX 내보내기
│   ├── ai/                      # AI 오케스트레이션 레이어
│   │   ├── workflow.ts          # Phase 1/2 실행 흐름
│   │   ├── providerAdapter.ts   # Provider 통합 호출
│   │   ├── parser.ts            # 응답 파싱 및 fallback
│   │   ├── types.ts             # AI 타입 정의
│   │   └── index.ts
│   ├── prompts/                 # 프롬프트 시스템 (Electron 전용)
│   │   ├── system.ts            # Phase 1/2 프롬프트 빌더
│   │   ├── types.ts             # 응답 스키마 (Zod)
│   │   ├── canvas.ts            # 캔버스 컨텍스트 유틸
│   │   └── index.ts
│   ├── ai-backend/              # OpenCode 런타임 (API 계층만 외부 노출)
│   │   ├── index.ts             # 공개 API surface
│   │   ├── client.ts            # 런타임 싱글톤 + API 함수
│   │   ├── runtime.ts           # 프로세스 spawn/kill (내부)
│   │   ├── binary-resolver.ts   # Windows 바이너리 탐색 (내부)
│   │   └── types.ts             # OpenCode 타입 정의
├── .opencode/
│   └── agents/                  # Agent Harness 정의
│       ├── leader.md
│       ├── ai_workflow_specialist.md
│       ├── electron_platform_specialist.md
│       ├── renderer_experience_specialist.md
│       └── quality_release_specialist.md
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── feature_request.yml  # 기능 제안 이슈 템플릿
│   └── workflows/
│       └── publish.yml          # GitHub Release 빌드/배포 워크플로우
├── tests/                       # Playwright 테스트
│   └── electron-chat.test.ts    # Electron 채팅 테스트
├── version.json                 # nbgv 버저닝 설정
└── vite.config.ts               # Vite + Electron 설정
```

---

## 명령어

```bash
# 개발
npm run dev          # Electron 개발 모드

# 테스트
npm test             # Playwright 테스트
# 빌드
npm run build        # Electron 앱 프로덕션 빌드
```

---

## 환경별 차이

| 기능 | Electron (프로덕션) |
|------|---------------------|
| 파일 접근 | 네이티브 파일시스템 |
| AI 채팅 | IPC `ai:chat` → 오케스트레이터 → OpenCode CLI |
| 인증 | OpenCode CLI (`opencode auth login`) |

### AI 채팅 흐름
1. 렌더러 → `ai:chat` IPC 요청 (runId, prompt, history, canvasContent, selection, modelId?, variant?, writingGoal?, fileMentions?)
2. `electron/ai/workflow.ts` → Phase 1 프롬프트 생성 → `electron/ai/providerAdapter.ts` → `electron/ai-backend` API 계층 호출
3. Phase 1 스트리밍 중 `message` 필드 부분 추출 → `ai:chat:event` 이벤트 송신 (`phase_message_stream`)
4. Phase 1 응답 파싱 완료 → `ai:chat:event` 이벤트 송신 (`phase1_result`)
5. needsCanvasUpdate=true 시 → Phase 2 프롬프트 생성 → Provider 호출
6. Phase 2 응답 파싱 완료 → `ai:chat:event` 이벤트 송신 (`phase2_result`, `pendingCanvasPatch`에 후보 저장 → Diff 미리보기 표시)
7. Phase 2 `message` 후속 스트리밍 이벤트 송신 (`phase_message_stream`)
8. 완료 → `done` 이벤트 송신

### 이벤트 타입
- `{ runId, type:'phase', phase:'evaluating'|'updating' }`
- `{ runId, type:'phase_message_stream', phase:'evaluating'|'updating', message }`
- `{ runId, type:'phase1_result', message, needsCanvasUpdate, updatePlan? }`
- `{ runId, type:'phase2_result', message, canvasContent }`
- `{ runId, type:'error', phase:'evaluating'|'updating', error }`
- `{ runId, type:'done' }`

---

## AI 설정

OpenCode CLI를 사용합니다:

1. 터미널에서 `opencode auth login` 수행
2. 앱에서 모델 목록 새로고침 (`opencode models --verbose` 기반)
3. CommandBar에서 Provider / Model / Variant 선택


---

## 빌드 주의사항

### preload.js는 CJS로 빌드
Electron sandbox preload는 CommonJS 형식 필요. `npm run dev`와 `npm run build`에서 esbuild로 자동 처리.

---

## 버저닝 (nbgv)

[Nerdbank.GitVersioning](https://github.com/dotnet/Nerdbank.GitVersioning)을 사용하여 Git 커밋 기반 자동 버전 관리.

- **설정 파일**: `version.json`
- **버전 형식**: `{major}.{minor}.{height}` (예: `0.1.42` — main 브랜치에서 42번째 커밋)
- **package.json의 version**: `0.0.0-placeholder` (CI에서 nbgv가 자동 stamp)
- **publicReleaseRefSpec**: `main` 브랜치에서만 공식 릴리스 버전 생성

### 주의사항
- `package.json`의 `version` 필드를 수동으로 수정하지 마세요. nbgv가 CI에서 자동으로 덮어씁니다.
- 메이저/마이너 버전을 올리려면 `version.json`의 `version` 필드를 수정하세요.

---

## CI/CD (GitHub Actions)

### publish.yml
`main` 브랜치에 push 시 자동 실행. 2개 OS(macOS, Windows)에서 빌드 후 GitHub Release에 배포.

**트리거**: `main` push (`.md`, `.gitignore`, `.gitattributes` 파일 제외)
**수동 실행**: `workflow_dispatch` 지원

**빌드 흐름**:
1. 2개 OS 매트릭스 병렬 빌드 (`macos-latest`, `windows-latest`)
2. 각 OS에서 `npm ci` → nbgv stamp → `npm run build`
3. 빌드 산출물 업로드 (dmg, zip, exe)
4. `release` 잡에서 모든 아티팩트 수집 → GitHub Release 생성 및 태깅
