export type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'copilot';

export interface AiChatRequest {
  runId: string;
  provider: AiProvider;
  prompt: string;
  history: ConversationMessage[];
  canvasContent: string;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: AiProvider;
}

export type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
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
