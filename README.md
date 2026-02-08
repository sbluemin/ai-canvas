<div align="center">
    <h1>AI Canvas</h1>
    <h3><em>One Space. All AI.</em></h3>
</div>

<p align="center">
    <strong>AI와 대화하며 생각의 조각을 완성된 문서로 빚어내는 Electron 데스크톱 마크다운 캔버스</strong>
</p>

---

## Motivation

AI와의 대화는 항상 '채팅'에 머무릅니다. 좋은 아이디어가 나와도 결국 별도의 문서 편집기를 열어 정리해야 하고, 그 과정에서 맥락은 끊기고 흐름은 사라집니다.

AI Canvas는 이 간극을 없앱니다. 대화 자체가 문서 작성이 되고, AI가 단순히 답변하는 것이 아니라 캔버스 위의 마크다운 문서를 직접 계획하고 수정합니다. Gemini, Codex, Claude 세 모델을 한 공간에서 자유롭게 전환하며, 각 모델의 강점을 살려 하나의 문서를 완성해 나갈 수 있습니다.

## Features

### AI Providers

- **Gemini**: Google Cloud Code Assist API 기반, OAuth 2.0 PKCE 인증
- **Codex**: OpenAI API 기반, OAuth 2.0 인증
- **Claude**: Anthropic API 기반, OAuth 2.0 인증

### 2-Phase Workflow

- **Phase 1 (Planning)**: 사용자 요청을 분석하고, 캔버스를 수정할지 대화만 할지 판단
- **Phase 2 (Execution)**: 수정이 필요한 경우 기존 문서를 바탕으로 마크다운 문서를 재구성

### Canvas Editor

- **WYSIWYG**: Milkdown + ProseMirror 기반 리치 마크다운 편집
- **수식**: KaTeX 수학 수식 렌더링
- **다이어그램**: Mermaid 다이어그램 지원
- **코드**: PrismJS 구문 하이라이팅
- **이미지**: 드래그 앤 드롭 / 붙여넣기로 이미지 에셋 관리
- **선택 AI**: 텍스트 선택 후 즉석 AI 질문 팝업

### Project Management

- **디렉토리 기반**: 로컬 폴더를 프로젝트로 지정, `.ai-canvas/` 디렉토리에 문서 저장
- **자동 저장**: 1.2초 디바운스 자동 저장, 상태 표시
- **대화 관리**: 복수 대화 세션 생성 및 전환
- **탭 관리**: 캔버스 파일 탭 드래그 정렬, 클릭 이름 변경

### Export

- **문서 내보내기**: HTML, PDF, DOCX 포맷 지원
- **공유 번들**: 전용 `.aic` 번들로 프로젝트 공유 및 가져오기

## Quick Start

1. 의존성 설치 및 개발 모드 실행
   ```bash
   npm install
   npm run dev
   ```
2. 상단 커맨드바에서 **Gemini** / **Codex** / **Claude** 버튼을 클릭하여 OAuth 인증
3. **프로젝트 선택**을 통해 문서를 저장할 로컬 폴더 지정
4. 채팅 패널에서 AI에게 요청하면, AI가 캔버스 문서를 직접 작성 및 수정

## Important Notes

- 모든 문서는 선택한 프로젝트 폴더의 `.ai-canvas/` 디렉토리에 로컬 저장됩니다
- OAuth 토큰은 Electron `safeStorage`로 암호화되어 로컬에 저장됩니다
- Phase 2 실행 중에는 캔버스가 잠기며 업데이트 오버레이가 표시됩니다
- 프로덕션 빌드: `npm run build`, 테스트: `npm test` (Playwright)

## License

Copyright © 2026 AI Canvas. All rights reserved.
