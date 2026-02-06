export interface PromptOptions {
  maxCanvasLength?: number;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
}