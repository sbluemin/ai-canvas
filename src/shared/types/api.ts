export interface FileReadRequest {
  path: string;
}

export interface FileReadResponse {
  content: string;
}

export interface FileWriteRequest {
  path: string;
  content: string;
}

export interface FileWriteResponse {
  success: boolean;
  path: string;
}

export interface FileListResponse {
  files: string[];
}

export interface ChatRequest {
  prompt: string;
}

export interface ChatStreamEvent {
  text?: string;
  error?: string;
  done?: boolean;
}

export interface ApiError {
  error: string;
}
