export type AiProvider = 'opencode';

/** Provider에서 가져온 모델 정보 */
export interface ModelInfo {
  id: string;
  name: string;
  providerId?: string;
  modelId?: string;
  family?: string;
  releaseDate?: string;
  knowledge?: string;
  variants?: string[];
  cost?: {
    input?: number;
    output?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
}

/** Provider별로 파싱한 모델 목록 */
export type AvailableModels = Record<AiProvider, ModelInfo[]>;

/** Provider별 선택된 모델 ID */
export type SelectedModels = Record<AiProvider, string | null>;

/** 채팅 파일 멘션 메타데이터 */
export interface FileMention {
  id: string;
  fileName: string;
  filePath: string;       // 프로젝트 기준 상대 경로 또는 입력 경로
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: AiProvider;
  fileMentions?: FileMention[];
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

/** 문서 작성 목표 */
export interface WritingGoal {
  purpose: string;      // 문서 목적
  audience: string;     // 대상 독자
  tone: string;         // 어조
  targetLength: 'short' | 'medium' | 'long';  // 목표 길이
}

/** 문서 목표 프리셋 */
export interface WritingGoalPreset {
  id: string;           // 프리셋 고유 ID
  name: string;         // 프리셋 이름 (예: "회의록", "제안서")
  goal: WritingGoal;    // 프리셋에 포함된 목표 설정
}
