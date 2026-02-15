export type AiProvider = 'opencode';

/** 문서 목표 기반 작성 모드 메타데이터 */
export interface WritingGoal {
  purpose: string;      // 문서 목적 (예: "기술 제안서 작성")
  audience: string;     // 대상 독자 (예: "경영진")
  tone: string;         // 어조 (예: "격식체, 전문적")
  targetLength: 'short' | 'medium' | 'long';  // 목표 길이
}

/** 첨부 파일 메타데이터 */
export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  filePath: string;
  base64?: string;
  thumbnailUrl?: string;
}

export interface AiChatRequest {
  runId: string;
  prompt: string;
  history: ConversationMessage[];
  canvasContent: string;
  modelId?: string;
  variant?: string;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
  writingGoal?: WritingGoal;  // 문서 목표 메타데이터 (옵셔널)
  attachments?: Attachment[]; // 첨부 파일 목록 (옵셔널)
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: AiProvider;
}

export type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase_message_stream'; phase: 'evaluating' | 'updating'; message: string }
  | { runId: string; type: 'phase1_result'; message: string; needsCanvasUpdate: boolean; updatePlan?: string }
  | { runId: string; type: 'phase2_result'; message: string; canvasContent: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };

export interface Phase1Response {
  message: string;
  needsCanvasUpdate: boolean;
  updatePlan?: string;
}

export interface Phase2Response {
  message: string;
  canvasContent: string;
}
