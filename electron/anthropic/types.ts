export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface ValidTokenResult {
  accessToken: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  expiresAt?: number;
}

export interface ChatRequest {
  prompt: string;
  systemInstruction?: string;
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
