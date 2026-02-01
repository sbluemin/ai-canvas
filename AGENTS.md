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
| AI | Vercel AI SDK, ai-sdk-provider-gemini-cli (OAuth 인증) |
| State | Zustand |
| Styling | CSS Modules |

---

## 아키텍처

### 레이아웃
- **App.tsx**: 루트 - 반응형 레이아웃 (데스크톱: Allotment 분할, 모바일: Drawer)
- **CommandBar**: 상단 커맨드 바
  - **ProjectSelector**: 프로젝트 선택 드롭다운
- **ChatPanel**: 좌측 AI 채팅 (SSE 스트리밍)
- **CanvasPanel**: 우측 에디터 패널
  - **MilkdownEditor**: 마크다운 WYSIWYG
  - **EditorToolbar**: 서식 도구
  - **SelectionPopup**: 텍스트 선택 시 AI 질문 팝업

### AI 모듈 (`src/shared/ai/`)
- **provider.ts**: Gemini CLI provider (OAuth 인증, `gemini-3-pro-preview` 모델)
- **stream.ts**: `streamChat()`, `streamChatToSSE()` 스트리밍 유틸리티
- Electron: IPC `chat:stream` 핸들러 사용
- 웹 테스트: Vite 미들웨어 `/api/chat` 사용

### 상태 관리 (Zustand)
```typescript
// src/store/useStore.ts
interface AppState {
  messages: Message[];           // 채팅 히스토리
  canvasContent: string;         // 에디터 콘텐츠
  isLoading: boolean;            // AI 응답 대기
  currentFilePath: string | null;
  isDrawerOpen: boolean;         // 모바일 드로어
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
│   │   │   └── ProjectSelector/
│   │   ├── CanvasPanel.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── MilkdownEditor.tsx
│   │   └── ...
│   ├── store/useStore.ts        # Zustand 상태
│   ├── shared/
│   │   ├── types/               # 공용 타입 정의
│   │   ├── utils/               # 공용 유틸리티
│   │   ├── ai/                  # AI 서비스 (Gemini CLI)
│   │   │   ├── provider.ts      # Gemini provider (OAuth)
│   │   │   ├── stream.ts        # 스트리밍 유틸리티
│   │   │   └── index.ts
│   │   └── api/                 # 클라이언트 API
│   │       └── index.ts         # Electron/Web 분기 로직
│   ├── App.tsx
│   └── main.tsx
├── electron/
│   ├── main.ts                  # IPC 핸들러 (chat:stream 포함)
│   └── preload.ts               # chatStream, onChatChunk API
├── tests/                       # Playwright 테스트
│   └── electron-chat.test.ts    # Electron 채팅 테스트
└── vite.config.ts               # Vite + Electron 설정
```

---

## 명령어

```bash
# 개발
npm run dev          # Electron 개발 모드
npm run dev:web      # 웹 개발 모드 (Express 서버 + Vite, 포트 5173)

# 테스트
npm test             # Playwright 테스트

# 빌드
npm run build        # Electron 앱 프로덕션 빌드
```

---

## 환경별 차이

| 기능 | Electron (프로덕션) | 웹 테스트 (개발용) |
|------|---------------------|-------------------|
| 파일 접근 | 네이티브 파일시스템 | 다이얼로그 prompt |
| AI 채팅 | IPC `chat:stream` | Express `/api/chat` (proxy) |
| 인증 | Gemini CLI OAuth | 동일 |

---

## AI 설정

```bash
# Gemini CLI 인증 (최초 1회)
npm install -g @google/gemini-cli
gemini  # OAuth 인증 완료

# 기본 모델: gemini-3-pro-preview
# 인증 방식: oauth-personal (API 키 불필요)
```

---

## 빌드 주의사항

### preload.js는 CJS로 빌드
Electron sandbox preload는 CommonJS 형식 필요. `npm run dev`와 `npm run build`에서 esbuild로 자동 처리.
