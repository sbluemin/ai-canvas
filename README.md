# AI Canvas

> AI와 대화하며 마크다운 문서를 작성하는 **Electron 데스크톱 앱**

![Electron](https://img.shields.io/badge/Electron-34-47848F?logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)

## 주요 기능

- **Multi-Provider AI**: Gemini와 Codex(OpenAI) 두 AI를 동시에 사용
- **Split Canvas View**: 두 AI의 응답을 좌우로 나란히 비교
- **마크다운 WYSIWYG**: Milkdown 기반 풍부한 편집 경험
- **실시간 스트리밍**: SSE 기반 AI 응답 스트리밍
- **OAuth 인증**: Google/OpenAI OAuth 2.0 PKCE 인증

## 스크린샷

```
┌─────────────────────────────────────────────────────────────┐
│  CommandBar  [Project ▼]              [Codex] [Gemini]      │
├────────────────────────────┬────────────────────────────────┤
│   🟣 Gemini Canvas         │   🟢 Codex Canvas              │
│                            │                                │
│   # AI Canvas              │   # AI Canvas                  │
│                            │                                │
│   마크다운 에디터...        │   마크다운 에디터...            │
│                            │                                │
│                            │                                │
│                            │                                │
│                            │                                │
│                            │                        💬      │
└────────────────────────────┴────────────────────────────────┘
```

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite, Milkdown |
| Desktop | Electron 34 |
| AI | Google Cloud Code Assist API, OpenAI Codex API |
| State | Zustand |
| Styling | CSS Variables |

## 프로젝트 구조

```
ai-canvas/
├── src/
│   ├── components/
│   │   ├── CommandBar/          # 상단 커맨드바
│   │   ├── CanvasPanel.tsx      # 마크다운 에디터 (provider별)
│   │   ├── ChatPopup.tsx        # 채팅 팝업 (슬라이드)
│   │   ├── FloatingChatButton.tsx # 채팅 버튼
│   │   ├── MilkdownEditor.tsx   # Milkdown 래퍼
│   │   └── EditorToolbar.tsx    # 에디터 도구모음
│   ├── store/useStore.ts        # Zustand 상태
│   ├── hooks/useChatRequest.ts  # 채팅 요청 훅
│   ├── api/                     # API 래퍼
│   └── prompts/                 # AI 프롬프트 시스템
├── electron/
│   ├── main.ts                  # Electron 메인
│   ├── preload.ts               # 프리로드 스크립트
│   ├── gemini/                  # Gemini 프로바이더
│   └── codex/                   # Codex 프로바이더
└── tests/                       # Playwright 테스트
```

## AI 인증 설정

### Gemini
1. 우측 상단 **Gemini** 버튼 클릭
2. 브라우저에서 Google OAuth 인증
3. 토큰은 `~/Library/Application Support/AI Canvas/gemini-auth.enc`에 암호화 저장

### Codex (OpenAI)
1. 우측 상단 **Codex** 버튼 클릭
2. 브라우저에서 OpenAI OAuth 인증
3. 토큰은 `~/Library/Application Support/AI Canvas/codex-auth.enc`에 암호화 저장

## 라이선스

Private
