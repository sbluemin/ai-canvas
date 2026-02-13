# AI WORKFLOW KNOWLEDGE BASE

## OVERVIEW
`electron/ai/`는 `ai:chat` 요청을 2-phase로 실행하고 스트리밍/파싱/에러 이벤트를 조정한다.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| phase orchestration | `electron/ai/workflow.ts` | evaluating/updating 흐름 제어 |
| 응답 파싱 | `electron/ai/parser.ts` | JSON 추출 + schema/fallback |
| provider adapter | `electron/ai/providerAdapter.ts` | provider별 chat 호출 통합 |
| 타입 계약 | `electron/ai/types.ts` | `AiChatRequest`, `AiChatEvent` |
| parser 테스트 | `electron/ai/parser.test.ts` | fallback/검증 회귀 체크 |

## CONVENTIONS
- phase1은 계획/판단, phase2는 캔버스 업데이트로 분리한다.
- phase1/phase2 결과는 항상 event로 renderer에 송신한다 (`phase1_result`, `phase2_result`, `done`, `error`).
- parser 실패 시 phase별 fallback 정책을 유지한다 (phase1은 보수적 degrade, phase2는 실패 처리).

## EVENT CONTRACT
- 시작: `phase` (`evaluating`) 이벤트 송신.
- 중간: `phase_message_stream`으로 부분 메시지 전달.
- phase1 완료: `phase1_result` (`needsCanvasUpdate`, `updatePlan?`).
- phase2 완료(필요 시): `phase2_result` (`canvasContent` 포함).
- 종료: `done` 또는 `error` 단일 종료 이벤트.

## CHANGE CHECKLIST
- `AiChatRequest` 필드 변경 시 `electron/ai/types.ts`, `src/api/index.ts`, `src/hooks/useChatRequest.ts` 동시 검토.
- parser 수정 시 `electron/ai/parser.test.ts`의 fallback 케이스가 유지되는지 확인.
- stream 처리 변경 시 `workflow.ts`의 runId 필터링/phase 전환 순서 역전이 없는지 확인.

## ANTI-PATTERNS
- `electron/prompts/system.ts` 제약(메시지 5줄 제한, 완료형 금지) 무시 금지.
- `needsCanvasUpdate=false`인데 phase2를 실행하는 우회 로직 금지.
- phase2 결과를 즉시 캔버스에 강제 반영하는 계약 변경 금지 (`pendingCanvasPatch` 경유 유지).
