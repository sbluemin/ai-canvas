/**
 * ai-backend 모듈 공개 API
 *
 * 외부에서는 이 파일만 import한다.
 * 내부 구현(runtime, binary-resolver)은 외부에 노출하지 않는다.
 */

// API 함수
export {
  chatWithOpenCode,
  fetchOpenCodeModelsVerbose,
  shutdownOpenCodeRuntime,
} from './client';

// 타입만 export (외부에서 타입 참조용)
export type {
  OpenCodeChatRequest,
  OpenCodeChatChunk,
  OpenCodeChatResult,
} from './types';
