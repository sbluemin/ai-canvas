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
| Frontend | React 19, TypeScript, Vite, Milkdown (마크다운 WYSIWYG) |
| Desktop | Electron 34 (핵심 플랫폼) |
| AI | Cloud Code Assist API (Gemini) |
| State | Zustand |
| Styling | CSS Modules |

---

## 아키텍처

### 레이아웃
- **App.tsx**: 루트 - 반응형 레이아웃 (데스크톱: Allotment 좌우 분할, 모바일: 단일 캔버스)
- **CommandBar**: 상단 커맨드 바
  - **ProjectSelector**: 프로젝트 선택 드롭다운
  - **GeminiAuthButton**: Gemini OAuth 로그인 버튼
- **ChatPanel**: 좌측 AI 채팅 패널 (SSE 스트리밍)
- **CanvasPanel**: 우측 마크다운 에디터 패널
  - **MilkdownEditor**: 마크다운 WYSIWYG
  - **EditorToolbar**: 서식 도구
  - **SelectionAiPopup**: 텍스트 선택 시 AI 질문 팝업
- **ErrorPopup**: AI 요청 오류 팝업

### AI 인증
- **Gemini** (`electron/gemini/auth.ts`): PKCE OAuth 2.0, Cloud Code Assist API
- safeStorage 암호화 토큰 저장, 자동 갱신

### API 모듈 (`src/api/`)
- **index.ts**: Electron/Web 분기 로직, IPC 래퍼

### 프롬프트 시스템 (`src/prompts/`)
- **system.ts**: Phase 1/2 프롬프트 빌더, 히스토리 압축
- **types.ts**: AI 응답 스키마 (Zod 검증)
- **canvas.ts**: 캔버스 컨텍스트 포맷팅, 토큰 추정

### 상태 관리 (Zustand)
```typescript
// src/store/useStore.ts
interface AppState {
  messages: Message[];           // 채팅 히스토리
  canvasContent: string;         // 에디터 콘텐츠
  isLoading: boolean;            // AI 응답 대기
  currentFilePath: string | null;
  isDrawerOpen: boolean;         // 모바일 드로어
  aiRun: AiRunState | null;      // AI 실행 상태
  activeProvider: AiProvider;
  errorPopup: ErrorInfo | null;  // 오류 팝업
  isAuthenticated: boolean;      // 현재 Provider 인증 상태
  authLoading: boolean;          // 인증 로딩
  isCodexAuthenticated: boolean;
  codexAuthLoading: boolean;
  isAnthropicAuthenticated: boolean;
  anthropicAuthLoading: boolean;
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
│   │   │   └── GeminiAuthButton/  # Gemini OAuth 로그인 버튼
│   │   ├── CanvasPanel.tsx      # 마크다운 에디터 패널
│   │   ├── ChatPanel.tsx        # AI 채팅 패널
│   │   ├── ChatPanel.css
│   │   ├── ErrorPopup.tsx       # 오류 팝업
│   │   ├── ErrorPopup.css
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
│   ├── main.ts                  # IPC 핸들러
│   ├── preload.ts               # Electron API
│   └── gemini/                  # Gemini 프로바이더
│       ├── auth.ts              # Google OAuth (PKCE)
│       ├── chat.ts              # Cloud Code Assist 스트리밍
│       ├── types.ts
│       └── index.ts
├── tests/                       # Playwright 테스트
│   └── electron-chat.test.ts    # Electron 채팅 테스트
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
| AI 채팅 | IPC `gemini:chat` → Cloud Code Assist API |
| 인증 | Gemini (`electron/gemini/auth.ts`) |

---

## AI 설정

인증은 앱 내에서 직접 수행됩니다:

### Gemini
1. 우측 상단 Gemini 버튼 클릭
2. 브라우저에서 Google OAuth 인증
3. 기본 모델: `gemini-3-flash-preview`
4. 토큰: `~/Library/Application Support/AI Canvas/gemini-auth.enc`

---

## 빌드 주의사항

### preload.js는 CJS로 빌드
Electron sandbox preload는 CommonJS 형식 필요. `npm run dev`와 `npm run build`에서 esbuild로 자동 처리.
