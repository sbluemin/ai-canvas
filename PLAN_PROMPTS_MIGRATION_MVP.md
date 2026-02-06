# AI Canvas MVP 작업계획
## 주제: `src/prompts` 경량화 및 `electron`으로 관심사 분리

## 1. 목표 요약
- 렌더러(`src`)에 위치한 프롬프트 생성/Phase 실행 책임을 `electron`으로 이동한다.
- 채팅 요청 IPC를 provider별 분기에서 통합형(`ai:chat`)으로 단순화한다.
- 렌더러는 UI 상태 반영과 사용자 상호작용 중심으로 축소한다.
- MVP 범위는 **Phase1/Phase2 실행 이전**까지 포함한다.

## 2. 결정사항 (확정)
- 마이그레이션 범위: **프롬프트 + Phase 실행 이전**
- IPC 형태: **통합 `ai:chat`**
- 전환 전략: **기존 provider별 chat IPC 즉시 교체**
- 진행 상태 UX: **phase 이벤트(`evaluating`, `updating`) 유지**
- `src/prompts` 처리: **경량 호환 레이어(thin wrapper) 유지**

## 3. 현재 구조 문제
- `src/api/index.ts`에서 `buildPhase1Prompt`, `buildPhase2Prompt`를 직접 호출해 렌더러가 도메인 로직을 소유 중.
- `useChatRequest.ts`가 Phase1/2 흐름 제어를 담당해 UI 훅과 실행 로직이 결합됨.
- provider별 chat IPC(`gemini:chat`, `codex:chat`, `anthropic:chat`, `copilot:chat`) 중복이 큼.
- 프롬프트/스키마 책임이 `src/prompts`에 집중되어 Electron 경계 분리가 약함.

## 4. 목표 아키텍처
- Electron에 오케스트레이터 레이어 추가:
- Phase1 prompt 생성
- provider 호출
- Phase1 응답 파싱/검증
- 필요 시 Phase2 prompt 생성 및 실행
- 최종 이벤트를 렌더러로 송신
- 렌더러는 `ai:chat` 요청 + 이벤트 소비만 수행.

## 5. 인터페이스 변경 (Public API)
### 5.1 IPC 요청
```ts
interface AiChatRequest {
  runId: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'copilot';
  prompt: string;
  history: { role: 'user' | 'assistant'; content: string; provider?: 'gemini' | 'openai' | 'anthropic' | 'copilot' }[];
  canvasContent: string;
  selection?: { text: string; before: string; after: string };
}
```

### 5.2 IPC 이벤트
```ts
type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase1_result'; message: string; needsCanvasUpdate: boolean; updatePlan?: string }
  | { runId: string; type: 'phase2_result'; message: string; canvasContent: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };
```

### 5.3 제거/유지
- 제거: provider별 chat IPC 및 chunk 이벤트
- 유지: provider별 인증 IPC(`authStart`, `authStatus`, `authLogout`)

## 6. 구현 단계
1. `electron/ai` 오케스트레이션 계층 신설  
- 파일: `electron/ai/types.ts`, `electron/ai/parser.ts`, `electron/ai/providerAdapter.ts`, `electron/ai/workflow.ts`, `electron/ai/index.ts`

2. 프롬프트 모듈 Electron 이전  
- `src/prompts/system.ts` → `electron/prompts/system.ts`  
- `src/prompts/canvas.ts` → `electron/prompts/canvas.ts`  
- `Phase1/2` 응답 검증 로직을 `electron/prompts/types.ts`로 이동

3. provider adapter 정리  
- 각 provider chat 모듈을 오케스트레이터에서 공통 호출 가능하도록 통일
- 오케스트레이터는 최종 텍스트를 받아 Phase 판정

4. main/preload 통합 IPC 도입  
- `ipcMain.handle('ai:chat', ...)` 추가
- `ai:chat:event` 송신 추가
- 기존 provider chat 핸들러 제거

5. 렌더러 API 교체  
- `src/api/index.ts`에서 프롬프트 빌드 제거
- `api.chatPhase2` 제거, `api.chat` 단일화
- `src/hooks/useChatRequest.ts`에서 `runPhase2` 제거, 이벤트 기반 상태 업데이트로 전환

6. `src/prompts` 경량화  
- 타입/호환 목적의 얇은 export만 유지
- 무거운 prompt body/트렁케이션 로직은 Electron만 사용

7. 타입 선언 업데이트  
- `src/types/electron.d.ts`에 `electronAPI.ai.chat`, `electronAPI.ai.onChatEvent` 반영

8. 문서 동기화  
- `AGENTS.md`의 아키텍처/프로젝트 구조/환경별 차이 섹션 갱신

## 7. 테스트 시나리오
1. Phase1 only 성공  
- 이벤트: `evaluating` → `phase1_result(needsCanvasUpdate=false)` → `done`
- 기대: 메시지 추가, canvas 미변경

2. Phase1 + Phase2 성공  
- 이벤트: `evaluating` → `phase1_result(true)` → `updating` → `phase2_result` → `done`
- 기대: 메시지 갱신 + canvas 업데이트

3. Phase1 JSON 파싱 실패  
- 기대: fallback 메시지 처리, 비정상 종료 없음

4. Phase2 파싱/검증 실패  
- 기대: `error(phase=updating)` 처리, 기존 롤백 UX 동작

5. 인증 실패/Provider API 에러  
- 기대: `error(phase=evaluating)` 처리, 에러 팝업 노출

6. runId 불일치 이벤트 무시  
- 기대: 다른 실행의 이벤트가 현재 UI에 반영되지 않음

## 8. 리스크 및 대응
- 리스크: 즉시 교체로 초기 회귀 가능성
- 대응: 이벤트 계약을 타입으로 고정하고, `useChatRequest` 경계에서 예외 처리 강화
- 리스크: provider별 응답 포맷 편차
- 대응: `electron/ai/parser.ts`에 단계별 fallback 규칙 명시

## 9. 완료 기준 (DoD)
- 렌더러가 `buildPhase1Prompt/buildPhase2Prompt`를 직접 호출하지 않음
- 채팅 실행 경로가 `ai:chat` 단일 IPC로 동작
- `useChatRequest`에 직접 Phase2 호출 로직이 없음
- 기존 UX(평가중/업데이트중 표시, 오류 팝업)가 유지됨
- `AGENTS.md`가 새 구조 기준으로 업데이트됨

## 10. 가정/기본값
- 웹 모드 chat 미지원 정책은 유지
- 동시 다중 run은 지원하지 않고 현재 `isLoading` 가드 유지
- 토큰 스트리밍 대신 phase 상태 스트리밍만 MVP에서 유지
