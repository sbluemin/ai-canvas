export { generateId } from '../utils';
export const DEFAULT_CANVAS_CONTENT = `# AI Canvas - 재사용 가능한 코어 아키텍처

## 기술 스택 개요

| 구분 | 선택된 기술 | 용도 및 특징 |
|------|-------------|--------------|
| 프레임워크 | React 19 + TypeScript | 최신 React 기능과 타입 안전성 |
| 빌드 도구 | Vite | 빠른 HMR과 최적화된 빌드 |
| 데스크톱 | Electron 34 | 크로스 플랫폼 데스크톱 앱 |
| 서버 | Express 4 | 경량 웹 서버 |
| 상태 관리 | Zustand | 간결하고 직관적인 상태 관리 |
| 에디터 | Milkdown | 플러그인 기반 마크다운 에디터 |

## 프로젝트 구조

\`\`\`
AICanvas/
├── src/
│   ├── components/
│   │   ├── ChatPanel.tsx        # AI 채팅 인터페이스
│   │   ├── CanvasPanel.tsx      # 마크다운 에디터 패널
│   │   ├── MilkdownEditor.tsx   # Milkdown 래퍼
│   │   ├── EditorToolbar.tsx    # 에디터 도구모음
│   │   └── SelectionPopup.tsx   # 텍스트 선택 팝업
│   ├── store/
│   │   └── useStore.ts          # Zustand 스토어
│   ├── lib/
│   │   └── api.ts               # API 추상화
│   └── App.tsx                  # 루트 컴포넌트
├── electron/
│   ├── main.ts                  # Electron 메인
│   └── preload.ts               # 프리로드 스크립트
└── server/
    └── index.ts                 # Express 서버
\`\`\`

## 주요 특징

- **멀티 플랫폼**: Electron 데스크톱 + 웹 브라우저 동시 지원
- **실시간 AI 채팅**: SSE 기반 스트리밍 응답
- **마크다운 WYSIWYG**: Milkdown 기반 풍부한 편집 경험
- **다크 테마**: Gemini Canvas 스타일의 모던 UI
`;
