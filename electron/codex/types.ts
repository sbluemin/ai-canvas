export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId?: string;
}

export interface ValidTokenResult {
  accessToken: string;
  accountId: string;
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

export interface JWTPayload {
  'https://api.openai.com/auth'?: {
    chatgpt_account_id?: string;
  };
  [key: string]: unknown;
}
