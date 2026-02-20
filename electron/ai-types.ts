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
  | { runId: string; type: 'phase1_result'; message: string; needsCanvasUpdate: boolean; updatePlan?: string }
  | { runId: string; type: 'phase2_result'; message: string; canvasContent: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };

export interface Phase1Response {
  message: string;
  needsCanvasUpdate: boolean;
  updatePlan?: string;
}

export interface Phase2Response {
  message: string;
  canvasContent: string;
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
  text?: string;
  part?: {
    text?: string;
  };
  error?: string;
}

export type OpenCodeRuntimeBinaryMode = 'auto' | 'local' | 'global';
