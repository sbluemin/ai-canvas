export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  projectId?: string;
}

export interface ValidTokenResult {
  accessToken: string;
  projectId: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  expiresAt?: number;
}

export interface ChatRequest {
  prompt: string;
  systemInstruction?: string;
  model?: string;
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
