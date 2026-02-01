# AI Canvas - Agent 가이드

> AI와 대화하며 마크다운 문서를 작성하는 크로스 플랫폼 에디터

## ⚠️ Agent 필수 지침

**작업 완료 후 이 문서를 반드시 업데이트하세요:**
- 새 컴포넌트/파일 추가 시 → 프로젝트 구조, 아키텍처 섹션 수정
- API 변경 시 → API 엔드포인트 테이블 수정
- 상태 구조 변경 시 → Zustand 인터페이스 수정
- 새 명령어 추가 시 → 명령어 섹션 수정
- 기술 스택 변경 시 → 기술 스택 테이블 수정

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite, Milkdown (마크다운 WYSIWYG) |
| Desktop | Electron 34 |
| Server | Express 4, Node.js 22+ |
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

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/files?path=<name>` | 파일 읽기 |
| POST | `/api/files` | 파일 저장 `{ path, content }` |
| GET | `/api/files/list` | 파일 목록 |
| POST | `/api/chat` | AI 채팅 (SSE 스트리밍) `{ prompt }` |

---

## 프로젝트 구조

```
ai-canvas/
├── src/
│   ├── components/              # React 컴포넌트
│   │   ├── CommandBar/          # 상단 커맨드바
│   │   │   ├── index.tsx
│   │   │   ├── CommandBar.css
│   │   │   └── ProjectSelector/ # 프로젝트 선택기
│   │   │       ├── index.tsx
│   │   │       └── ProjectSelector.css
│   │   ├── CanvasPanel.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── MilkdownEditor.tsx
│   │   └── ...
│   ├── store/useStore.ts        # Zustand 상태
│   ├── lib/api.ts               # API 추상화
│   ├── shared/                  # 클라이언트/서버 공용 모듈
│   │   ├── types/               # 공용 타입 정의
│   │   └── utils/               # 공용 유틸리티
│   ├── server/index.ts          # Express 서버
│   ├── App.tsx
│   └── main.tsx
├── electron/                    # Electron 메인/프리로드
└── data/                        # 파일 저장소
```

---

## 명령어

```bash
# 개발
npm run dev          # Electron
npm run dev:web      # 웹 (포트 5173)
npm run server:dev   # 서버 (포트 50000)

# 빌드
npm run build        # Electron
npm run build:web    # 웹
npm run build:server # 서버
```

---

## 환경별 차이

- **Electron**: 직접 파일시스템 접근, 네이티브 다이얼로그
- **Web/Server**: REST API 통한 파일 관리, `./data/` 디렉토리 사용
