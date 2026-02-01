export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatStreamCallbacks {
  onText: (text: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
}
