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
| AI | Cloud Code Assist API (Gemini) |
| State | Zustand |
| Styling | CSS Modules |

---

## 아키텍처

### 레이아웃
- **App.tsx**: 루트 - 반응형 레이아웃 (데스크톱: Allotment 좌우 분할, 모바일: 단일 캔버스)
- **CommandBar**: 상단 커맨드 바
  - **ProjectSelector**: 프로젝트 폴더 선택 (`.ai-canvas` 디렉터리 관리)
  - **ModelSelector**: AI 모델 선택 (Gemini, Codex, Anthropic)
  - **ModelRefreshButton**: 사용 가능한 모델 목록 갱신
  - **GeminiAuthButton**: Gemini OAuth 로그인 버튼
  - **CodexAuthButton**: Codex OAuth 로그인 버튼
  - **AnthropicAuthButton**: Anthropic OAuth 로그인 버튼
- **ChatPanel**: 좌측 AI 채팅 패널 (SSE 스트리밍)
- **CanvasPanel**: 우측 마크다운 에디터 패널
  - **MilkdownEditor**: 마크다운 WYSIWYG
  - **EditorToolbar**: 서식 도구
  - **SelectionAiPopup**: 텍스트 선택 시 AI 질문 팝업
  - 캔버스 파일 탭: `.ai-canvas/*.md` 파일 간 전환 (활성 탭 클릭 시 이름 변경)
  - 저장 상태 표시기: 자동 저장 상태 (대기/저장 중/저장됨/오류)
- **ErrorPopup**: AI 요청 오류 팝업
- **SettingsModal**: 앱 설정 (테마, 언어 등)
- **ExportModal**: 내보내기 모달 (HTML/PDF/DOCX)
- **ToastContainer**: 시스템 알림 토스트 표시


### AI 인증
- **Gemini** (`electron/gemini/auth.ts`): PKCE OAuth 2.0, Cloud Code Assist API
- **Codex** (`electron/codex/auth.ts`): OpenAI OAuth 2.0
- **Anthropic** (`electron/anthropic/auth.ts`): Anthropic OAuth 2.0
- safeStorage 암호화 토큰 저장, 자동 갱신

### AI 오케스트레이션 (`electron/ai/`)
- **workflow.ts**: Phase 1/2 실행 흐름 제어, 이벤트 송신
- **providerAdapter.ts**: Provider별 chat 함수 통합 호출
- **parser.ts**: Phase 1/2 응답 JSON 파싱 및 fallback 처리
- **types.ts**: AI 요청/응답/이벤트 타입 정의

### 프롬프트 시스템 (`electron/prompts/`)
- **system.ts**: Phase 1/2 프롬프트 빌더, 히스토리 압축
- **types.ts**: AI 응답 스키마 (Zod 검증)
- **canvas.ts**: 캔버스 컨텍스트 포맷팅, 토큰 추정

### API 모듈 (`src/api/`)
- **index.ts**: Electron/Web 분기 로직, IPC 래퍼

### 렌더러 프롬프트 (`src/prompts/`)
- 경량 호환 레이어 (타입 export만 유지, 실제 로직은 electron/prompts 사용)

### 상태 관리 (Zustand)
```typescript
// src/store/useStore.ts
interface AppState {
  messages: Message[];           // 채팅 히스토리
  conversations: Conversation[]; // 대화 목록
  activeConversationId: string | null;
  canvasContent: string;         // 에디터 콘텐츠
  isLoading: boolean;            // AI 응답 대기
  currentFilePath: string | null;
  isDrawerOpen: boolean;         // 모바일 드로어
  aiRun: AiRunState | null;      // AI 실행 상태
  activeProvider: AiProvider;
  errorPopup: ErrorInfo | null;  // 오류 팝업
  autosaveStatus: AutosaveStatus; // 자동 저장 상태
  isAuthenticated: boolean;      // 현재 Provider 인증 상태
  authLoading: boolean;          // 인증 로딩
  isCodexAuthenticated: boolean;
  codexAuthLoading: boolean;
  isAnthropicAuthenticated: boolean;
  anthropicAuthLoading: boolean;
  
  // 프로젝트/캔버스 파일 관리
  projectPath: string | null;    // 선택된 프로젝트 경로
  canvasFiles: string[];         // .ai-canvas 내 .md 파일 목록
  activeCanvasFile: string | null; // 현재 열린 캔버스 파일명

  // 모델 선택 및 설정
  availableModels: AvailableModels;
  selectedModels: SelectedModels;
  modelsLoading: boolean;
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
│   │   ├── CommandBar/          # 상단 커맨드바
│   │   │   ├── index.tsx
│   │   │   ├── CommandBar.css
│   │   │   ├── ProjectSelector/
│   │   │   ├── ModelSelector/
│   │   │   ├── ModelRefreshButton/
│   │   │   ├── GeminiAuthButton/
│   │   │   ├── CodexAuthButton/
│   │   │   └── AnthropicAuthButton/
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
│   │   ├── ToastContainer.tsx   # 토스트 알림 컨테이너
│   │   ├── ToastContainer.css
│   │   ├── MilkdownEditor.tsx   # Milkdown 래퍼
│   │   ├── EditorToolbar.tsx    # 에디터 도구모음
│   │   ├── SelectionAiPopup.tsx # 텍스트 선택 AI 팝업
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
│   ├── main.ts                  # IPC 핸들러 (ai:chat 통합 엔드포인트)
│   ├── preload.ts               # Electron API
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
│   ├── gemini/                  # Gemini 프로바이더
│   │   ├── auth.ts              # Google OAuth (PKCE)
│   │   ├── chat.ts              # Cloud Code Assist 스트리밍
│   │   ├── types.ts
│   │   └── index.ts
│   ├── codex/                   # Codex (OpenAI) 프로바이더
│   │   ├── auth.ts
│   │   ├── chat.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── anthropic/               # Anthropic 프로바이더
│   │   ├── auth.ts
│   │   ├── chat.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── api/                     # Electron 내부 API
│   │   └── models.ts            # 모델 목록 관리
├── .github/
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
| AI 채팅 | IPC `ai:chat` → 오케스트레이터 → Provider별 API |
| 인증 | Provider별 OAuth 2.0 (`electron/{provider}/auth.ts`) |

### AI 채팅 흐름
1. 렌더러 → `ai:chat` IPC 요청 (runId, provider, prompt, history, canvasContent, selection, modelId?)
2. `electron/ai/workflow.ts` → Phase 1 프롬프트 생성 → Provider 호출
3. Phase 1 Provider 스트리밍 중 `message` 필드 부분 추출 → `ai:chat:event` 이벤트 송신 (`phase_message_stream`)
4. Phase 1 응답 파싱 완료 → `ai:chat:event` 이벤트 송신 (`phase1_result`)
5. needsCanvasUpdate=true 시 → Phase 2 프롬프트 생성 → Provider 호출
6. Phase 2 응답 파싱 완료 → `ai:chat:event` 이벤트 송신 (`phase2_result`, 캔버스 우선 반영)
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

인증은 앱 내에서 직접 수행됩니다:

### Gemini
1. 우측 상단 Gemini 버튼 클릭
2. 브라우저에서 Google OAuth 인증
3. 기본 모델: `gemini-3-flash-preview`
4. 토큰: `~/Library/Application Support/AI Canvas/gemini-auth.enc`

### Codex (OpenAI)
1. 우측 상단 Codex 버튼 클릭
2. 브라우저에서 OpenAI OAuth 인증
3. 기본 모델: `gpt-5.2`
4. 토큰: `~/Library/Application Support/AI Canvas/codex-auth.enc`

### Anthropic
1. 우측 상단 Anthropic 버튼 클릭
2. 브라우저에서 Anthropic OAuth 인증
3. 기본 모델: `claude-haiku-4-5`
4. 토큰: `~/Library/Application Support/AI Canvas/anthropic-auth.enc`


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
