export type AiProvider = 'gemini' | 'openai' | 'anthropic';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: AiProvider;
}

export interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
  provider?: AiProvider;
}

export interface ChatStreamCallbacks {
  onText: (text: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

