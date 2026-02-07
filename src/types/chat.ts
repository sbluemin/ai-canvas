export type AiProvider = 'gemini' | 'openai' | 'anthropic';

/** models.dev API에서 가져온 모델 정보 */
export interface ModelInfo {
  id: string;
  name: string;
  family?: string;
  releaseDate?: string;
  knowledge?: string;
  cost?: {
    input?: number;
    output?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
}

/** models.dev API 응답에서 Provider별로 파싱한 모델 목록 */
export type AvailableModels = Record<AiProvider, ModelInfo[]>;

/** Provider별 선택된 모델 ID */
export type SelectedModels = Record<AiProvider, string | null>;

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

