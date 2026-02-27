export type AiProvider = 'opencode';

export interface WritingGoal {
  purpose: string;
  audience: string;
  tone: string;
  targetLength: 'short' | 'medium' | 'long';
}

export interface FileMention {
  id: string;
  fileName: string;
  filePath: string;
}

export interface AiChatRequest {
  runId: string;
  prompt: string;
  history: ConversationMessage[];
  canvasContent: string;
  modelId?: string;
  variant?: string;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
  writingGoal?: WritingGoal;
  fileMentions?: FileMention[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: AiProvider;
}

export type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase_message_stream'; phase: 'evaluating' | 'updating'; message: string }
  | { runId: string; type: 'thinking_stream'; phase: 'evaluating' | 'updating'; activity: AgentActivityEvent }
  | { runId: string; type: 'canvas_content_stream'; content: string }
  | { runId: string; type: 'chat_result'; message: string; canvasContent?: string; doneMessage?: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };

/** 통합 채팅 결과 — 시그널 파서가 message/canvasContent를 분리하여 반환 */
export interface ChatResult {
  message: string;
  canvasContent?: string;
  /** ⟨/CANVAS⟩ 이후 완료 메시지 (Do→Canvas→Done 3단계 흐름) */
  doneMessage?: string;
}

export interface OpenCodeChatRequest {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  variant?: string;
  agent?: string;
}

export interface OpenCodeChatChunk {
  text?: string;
  event?: OpenCodeJsonEvent;
  error?: string;
  done?: boolean;
}

export interface OpenCodeChatResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface OpenCodeJsonEvent {
  type?: string;
  name?: string;
  tool?: string | { name?: string };
  text?: string;
  message?: string;
  summary?: string;
  reasoning?: string;
  content?: string;
  input?: Record<string, unknown>;
  args?: Record<string, unknown>;
  path?: string;
  file?: string;
  target?: string;
  part?: {
    text?: string;
  };
  error?: string;
}

/** IPC thinking_stream 이벤트로 전달되는 에이전트 활동 */
export type AgentActivityEvent =
  | { kind: 'thought'; text: string }
  | { kind: 'step'; label: string; tool?: string; target?: string }
  | { kind: 'step_finish' };

export type OpenCodeRuntimeBinaryMode = 'auto' | 'local' | 'global';
