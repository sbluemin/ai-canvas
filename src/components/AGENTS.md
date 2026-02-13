# COMPONENTS KNOWLEDGE BASE

## OVERVIEW
`src/components/`는 채팅/캔버스/파일관리/모달 UI를 렌더링하며 store와 api를 직접 결합한다.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| 채팅 UI | `src/components/ChatPanel.tsx` | 대화 목록 + 메시지 렌더 |
| 캔버스 메인 | `src/components/CanvasPanel.tsx` | 파일 탭, autosave, overlay 제어 |
| 파일 트리 | `src/components/FileExplorer.tsx` | 폴더/파일 CRUD + 트리 렌더 |
| 에디터 연결 | `src/components/MilkdownEditor.tsx` | 콘텐츠 반영 + 이미지 저장 |
| 변경안 미리보기 | `src/components/DiffPreview.tsx` | chunk 선택 적용 |
| 상단 커맨드바 | `src/components/CommandBar/index.tsx` | project/model/variant orchestration |

## CONVENTIONS
- CommandBar 하위 버튼들은 도메인별 서브디렉터리(`*/index.tsx`)로 분리한다.
- 모델 선택은 `opencode models --verbose` 결과(`provider/model`, variants)를 기준으로 동작한다.
- 캔버스 적용 UX는 `phase2_result -> pendingCanvasPatch -> DiffPreview` 순서로 유지한다.

## INTERACTION BOUNDARIES
- Chat 도메인(`ChatPanel`)은 `useChatRequest`를 통해서만 AI 실행을 트리거한다.
- Canvas 도메인(`CanvasPanel`, `MilkdownEditor`, `EditorToolbar`)은 `canvasContent`와 파일 상태를 공유한다.
- File 도메인(`FileExplorer`)은 tree 조작 후 반드시 `project:list-canvas-tree` 동기화를 수행한다.
- Modal 도메인(`SettingsModal`, `ExportModal`, `WritingGoalModal`, `ErrorPopup`)은 store의 open/close 플래그를 단일 제어점으로 사용한다.

## CHANGE CHECKLIST
- 파일/폴더 조작 UI 변경 시 `CanvasPanel` + `FileExplorer` 양쪽 플로우를 함께 검증한다.
- AI 메시지 렌더링 변경 시 `ChatPanel`의 provider 뱃지/스트리밍 상태 표현을 함께 확인한다.
- Diff 관련 UI 변경 시 `DiffPreview`의 apply/cancel 이벤트가 store 액션과 일치하는지 확인한다.

## ANTI-PATTERNS
- ChatPanel/CanvasPanel/FileExplorer 사이 공용 상태를 props 체인으로 중복 전달하지 말 것 (store 사용).
- `useChatRequest` 외 경로에서 `ai:chat:event` 직접 구독 금지.
- tests/screenshots 결과를 컴포넌트 소스 변경 판단 근거로 사용하지 말 것 (artifact-only).
