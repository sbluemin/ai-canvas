# COMPONENTS KNOWLEDGE BASE

## OVERVIEW
`src/components/`는 채팅/캔버스/Feature관리/모달 UI를 렌더링하며 store와 api를 직접 결합한다.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 채팅 UI | `ChatPanel.tsx` | 대화 목록 + 메시지 렌더 + `@파일` 멘션 |
| 온보딩 | `OnboardingWizard.tsx` | opencode 설치/로그인 안내/글로벌-로컬 선택 |
| 캔버스 메인 | `CanvasPanel.tsx` | 파일 탭, autosave, overlay, 너비 모드 제어 |
| Feature 트리 | `FeatureExplorer.tsx` | Feature/캔버스 파일 CRUD + 드래그 정렬 + 트리 렌더 |
| 에디터 연결 | `MilkdownEditor.tsx` | 콘텐츠 반영 + 이미지 에셋 저장 |
| 에디터 도구 | `EditorToolbar.tsx` | 서식 도구모음 |
| 텍스트 선택 AI | `SelectionAiPopup.tsx` | 선택 텍스트 AI 질문 팝업 |
| 상단 커맨드바 | `CommandBar/index.tsx` | project/model/variant orchestration |
| 런타임 상태 | `CommandBar/RuntimeStatus/index.tsx` | opencode 연결 상태 배지 |
| 공유 아이콘 | `Icons.tsx` | 인라인 SVG 아이콘 (Plus, Microphone, Send 등) |

## CONVENTIONS
- CommandBar 하위 컨트롤은 도메인별 서브디렉터리(`*/index.tsx`)로 분리.
- 모델 선택은 `opencode models --verbose` 결과 기준.
- 캔버스 적용 UX: `phase2_result → setCanvasContent` (즉시 반영).
- 새 아이콘 추가 시 `Icons.tsx`에 정의 (외부 라이브러리 금지, stroke 기반 SVG).

## INTERACTION BOUNDARIES
- **Chat**: `useChatRequest`를 통해서만 AI 실행 트리거.
- **Canvas**: `CanvasPanel` + `MilkdownEditor` + `EditorToolbar`는 `canvasContent`와 파일 상태 공유.
- **Feature**: `FeatureExplorer`는 tree 조작 후 `project:list-canvas-tree` 동기화 필수.
- **Modal**: store의 open/close 플래그를 단일 제어점으로 사용.

## ANTI-PATTERNS
- ChatPanel/CanvasPanel/FeatureExplorer 간 공용 상태를 props 체인으로 중복 전달 금지 (store 사용).
- `useChatRequest` 외 경로에서 `ai:chat:event` 직접 구독 금지.
