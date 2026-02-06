// Github Copilot OAuth 관련 타입 정의

export interface TokenData {
  accessToken: string;
  expiresAt: number;
  gitHubToken?: string;
}

export interface ValidTokenResult {
  accessToken: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  expiresAt?: number;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface CopilotTokenResponse {
  token: string;
  expires_at: number;
  refresh_in: number;
  endpoints?: {
    api: string;
  };
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
