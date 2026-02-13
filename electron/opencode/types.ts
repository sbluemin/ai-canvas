export interface ChatRequest {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  variant?: string;
}

export interface ChatResult {
  success: boolean;
  error?: string;
}

export interface ChatChunk {
  text?: string;
  error?: string;
  done?: boolean;
}
