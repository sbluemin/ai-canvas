/**
 * 브라우저 자동화 테스트용 AI 목업 모듈.
 * Electron IPC가 없는 환경에서 모델 목록과 채팅 스트리밍 이벤트를 시뮬레이션한다.
 */
import type { AvailableModels } from '../store/types';

export type MockAiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase_message_stream'; phase: 'evaluating' | 'updating'; message: string }
  | {
      runId: string;
      type: 'thinking_stream';
      phase: 'evaluating' | 'updating';
      activity:
        | { kind: 'thought'; text: string }
        | { kind: 'step'; label: string; tool?: string; target?: string }
        | { kind: 'step_finish' };
    }
  | { runId: string; type: 'canvas_content_stream'; content: string }
  | { runId: string; type: 'chat_result'; message: string; canvasContent?: string; doneMessage?: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };

interface MockChatRequest {
  runId: string;
  prompt: string;
  canvasContent: string;
  modelId?: string;
}

interface MockStreamProfile {
  label: string;
  delayStepMs: number;
  evaluatingThoughts: string[];
  evaluatingSteps: Array<{ label: string; target: string }>;
  updatingThoughts: string[];
  messageChunks: number;
  canvasChunks: number;
  doneMessage: string;
}

export const MOCK_MODELS: AvailableModels = {
  pi: [
    {
      id: 'mock/canvas-fast',
      name: 'Mock Canvas Fast',
      providerId: 'mock',
      modelId: 'canvas-fast',
      variants: ['default', 'creative'],
    },
    {
      id: 'mock/canvas-balanced',
      name: 'Mock Canvas Balanced',
      providerId: 'mock',
      modelId: 'canvas-balanced',
      variants: ['default', 'creative'],
    },
    {
      id: 'mock/canvas-quality',
      name: 'Mock Canvas Quality',
      providerId: 'mock',
      modelId: 'canvas-quality',
      variants: ['default', 'creative'],
    },
  ],
};

const FAST_PROFILE: MockStreamProfile = {
  label: 'Fast',
  delayStepMs: 45,
  evaluatingThoughts: ['요청을 빠르게 분류하고 핵심 항목만 추렸습니다.'],
  evaluatingSteps: [{ label: '핵심 포인트 추출', target: 'input' }],
  updatingThoughts: [],
  messageChunks: 2,
  canvasChunks: 2,
  doneMessage: '목업 응답이 빠르게 완료되었습니다.',
};

const BALANCED_PROFILE: MockStreamProfile = {
  label: 'Balanced',
  delayStepMs: 80,
  evaluatingThoughts: [
    '요청 의도와 출력 형식을 정리하고 있습니다.',
    '응답 구조를 검토해 누락 항목을 보완하고 있습니다.',
  ],
  evaluatingSteps: [{ label: '요청 분석', target: 'input' }],
  updatingThoughts: ['문서 반영 전 결과 정합성을 확인하고 있습니다.'],
  messageChunks: 3,
  canvasChunks: 2,
  doneMessage: '목업 응답이 완료되었습니다.',
};

const QUALITY_PROFILE: MockStreamProfile = {
  label: 'Quality',
  delayStepMs: 150,
  evaluatingThoughts: [
    '요청 맥락을 세부 항목으로 분해하고 있습니다.',
    '핵심 요구와 제약사항의 충돌 여부를 점검하고 있습니다.',
    '최종 응답 구조를 품질 우선으로 재정렬하고 있습니다.',
  ],
  evaluatingSteps: [
    { label: '요구사항 정밀 분석', target: 'input' },
    { label: '출력 품질 기준 점검', target: 'response' },
  ],
  updatingThoughts: [
    '캔버스 업데이트 초안을 작성하고 있습니다.',
    '최종 문맥 일관성을 검증하고 있습니다.',
  ],
  messageChunks: 4,
  canvasChunks: 3,
  doneMessage: '목업 응답이 고품질 추론 경로로 완료되었습니다.',
};

const subscribers = new Set<(event: MockAiChatEvent) => void>();

function emit(event: MockAiChatEvent): void {
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

function normalizePrompt(prompt: string): string {
  const normalized = prompt.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : '요청';
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function resolveProfile(modelId?: string): MockStreamProfile {
  if (modelId?.includes('canvas-fast')) {
    return FAST_PROFILE;
  }
  if (modelId?.includes('canvas-quality')) {
    return QUALITY_PROFILE;
  }
  return BALANCED_PROFILE;
}

function buildMessageStages(lines: string[], chunks: number): string[] {
  if (chunks <= 1) {
    return [lines.join('\n')];
  }

  const stages: string[] = [];
  for (let i = 1; i <= chunks; i += 1) {
    const lineCount = Math.max(1, Math.ceil((lines.length * i) / chunks));
    const stage = lines.slice(0, lineCount).join('\n');
    if (stages[stages.length - 1] !== stage) {
      stages.push(stage);
    }
  }

  return stages;
}

function buildProgressiveCanvasChunks(content: string, chunks: number): string[] {
  if (chunks <= 1 || content.length <= 1) {
    return [content];
  }

  const slices: string[] = [];
  let previousEnd = 0;

  for (let i = 1; i <= chunks; i += 1) {
    const expectedEnd = Math.floor((content.length * i) / chunks);
    const end = i === chunks ? content.length : Math.max(previousEnd + 1, expectedEnd);
    slices.push(content.slice(0, end));
    previousEnd = end;
  }

  return slices;
}

function buildMockCanvasContent(prompt: string, canvasContent: string): string {
  const base = canvasContent.trim();
  const summary = truncateText(prompt, 80);

  const mockSection = [
    '## Mock Update',
    '',
    `- 요청 요약: ${summary}`,
    '- 처리 상태: 브라우저 목업 스트리밍',
    '- 참고: 이 내용은 자동화 테스트용으로 생성되었습니다.',
  ].join('\n');

  return base.length > 0 ? `${base}\n\n${mockSection}` : `# Mock Canvas\n\n${mockSection}`;
}

export function subscribeMockChatEvent(callback: (event: MockAiChatEvent) => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function startMockChatStream(request: MockChatRequest): void {
  const profile = resolveProfile(request.modelId);
  const promptSummary = truncateText(normalizePrompt(request.prompt), 80);

  const evaluatingLines = [
    '요청을 분석하고 있습니다.',
    `- 핵심 요청: ${promptSummary}`,
    '- 적용 전략: 요구사항을 구조화해 문서 업데이트 초안을 생성합니다.',
    `- 추론 프로파일: ${profile.label}`,
  ];
  const evaluatingMessages = buildMessageStages(evaluatingLines, profile.messageChunks);
  const finalEvaluatingMessage = evaluatingMessages[evaluatingMessages.length - 1] ?? evaluatingLines.join('\n');

  const doneMessage = profile.doneMessage;
  const finalMessage = `${finalEvaluatingMessage}\n\n${doneMessage}`;
  const nextCanvasContent = buildMockCanvasContent(promptSummary, request.canvasContent);
  const canvasChunks = buildProgressiveCanvasChunks(nextCanvasContent, profile.canvasChunks);

  const timeline: Array<{ delay: number; event: MockAiChatEvent }> = [];
  let currentDelay = 0;

  const enqueue = (event: MockAiChatEvent, increment = true): void => {
    timeline.push({ delay: currentDelay, event });
    if (increment) {
      currentDelay += profile.delayStepMs;
    }
  };

  enqueue({ runId: request.runId, type: 'phase', phase: 'evaluating' });

  for (const thought of profile.evaluatingThoughts) {
    enqueue({
      runId: request.runId,
      type: 'thinking_stream',
      phase: 'evaluating',
      activity: { kind: 'thought', text: thought },
    });
  }

  for (const step of profile.evaluatingSteps) {
    enqueue({
      runId: request.runId,
      type: 'thinking_stream',
      phase: 'evaluating',
      activity: { kind: 'step', label: step.label, tool: 'mock', target: step.target },
    });
  }

  for (const message of evaluatingMessages) {
    enqueue({
      runId: request.runId,
      type: 'phase_message_stream',
      phase: 'evaluating',
      message,
    });
  }

  enqueue({ runId: request.runId, type: 'phase', phase: 'updating' });

  for (const thought of profile.updatingThoughts) {
    enqueue({
      runId: request.runId,
      type: 'thinking_stream',
      phase: 'updating',
      activity: { kind: 'thought', text: thought },
    });
  }

  for (const content of canvasChunks) {
    enqueue({
      runId: request.runId,
      type: 'canvas_content_stream',
      content,
    });
  }

  enqueue({
    runId: request.runId,
    type: 'thinking_stream',
    phase: 'updating',
    activity: { kind: 'step_finish' },
  });

  enqueue({
    runId: request.runId,
    type: 'chat_result',
    message: finalMessage,
    canvasContent: nextCanvasContent,
    doneMessage,
  });

  enqueue({ runId: request.runId, type: 'done' }, false);

  for (const item of timeline) {
    window.setTimeout(() => emit(item.event), item.delay);
  }
}
