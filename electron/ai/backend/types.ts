// ai-backend 타입 정의

/** OpenCode chat 요청 파라미터 */
export interface OpenCodeChatRequest {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  variant?: string;
}

/** 스트리밍 중 전달되는 개별 청크 */
export interface OpenCodeChatChunk {
  text?: string;
  error?: string;
  done?: boolean;
}

/** chat 명령 최종 결과 */
export interface OpenCodeChatResult {
  success: boolean;
  text?: string;
  error?: string;
}

/** OpenCode JSON 이벤트 (stdout 파싱용) */
export interface OpenCodeJsonEvent {
  type?: string;
  text?: string;
  part?: {
    text?: string;
  };
  error?: string;
}
