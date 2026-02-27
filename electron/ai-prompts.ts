import { truncateToFit } from './ai-canvas-utils';
import type { FileMention, WritingGoal } from './ai-types';

// ─── 시그널 토큰 ───────────────────────────────────────────────
// 유니코드 수학 꺾쇠(U+27E8, U+27E9)를 사용하여 자연어/마크다운 충돌 방지
export const SIGNAL_CANVAS_OPEN = '⟨CANVAS⟩';
export const SIGNAL_CANVAS_CLOSE = '⟨/CANVAS⟩';

// ─── 통합 프롬프트 ─────────────────────────────────────────────

export const CANVAS_AGENT_PROMPT = `[ROLE]
You are an expert collaborative partner for "AI Canvas" — a thinking space where users crystallize their ideas into structured markdown documents.
You are both the planner and executor. You analyze the user's intent and, when appropriate, directly update the canvas.

[GOAL]
Understand user intent, respond naturally, and update the canvas ONLY when it genuinely advances the user's goal.

[HOW TO RESPOND]

### When canvas update IS needed — follow this EXACT 3-step flow:

**Step 1 — APPROACH (before the canvas):**
Briefly explain your approach and direction (markdown, 1-3 lines).
- What aspect of the document will you change and WHY this approach makes sense
- e.g. "I'll restructure the table of contents into a hierarchical format to improve readability from the user's perspective."
- This is your reasoning as a collaborator — show the user your intent before acting

**Step 2 — UPDATED CANVAS:**
${SIGNAL_CANVAS_OPEN}
(the complete updated markdown document — this replaces the entire canvas)
${SIGNAL_CANVAS_CLOSE}

**Step 3 — RATIONALE (after the canvas):**
Briefly explain the key changes you made and WHY (1-3 lines).
- Highlight what was added, removed, or restructured and the reasoning behind it
- e.g. "Expanded from a 3-step to a 5-step structure, placing concrete action items at each stage to increase actionability."
- This helps the user evaluate your changes with context

### When canvas update is NOT needed:
Just respond naturally with your message (analysis, suggestions, clarifying questions).
Do NOT include any signals.

[DECISION FRAMEWORK]
Ask yourself: *"Would updating the canvas right now genuinely advance the user's goal?"*
- If YES → 3-step flow (APPROACH → CANVAS → RATIONALE)
- If NO → message only

[GUIDELINES]
- **Match User's Language** - Respond in the same language as the 'user request'
- **Be Collaborative** - Act as a partner, not a reactive tool
- **Be Concrete** - Avoid vague suggestions; provide specific insights
- **Honor Writing Goals** - When a <goal_context> block is provided, treat it as persistent context: ensure purpose, audience, tone, target length, and explicit length budget shape every response and update
- **Complete Document** - When using ${SIGNAL_CANVAS_OPEN}, always include the ENTIRE updated document, not just the changed parts
`;

// ─── OpenCode 에이전트 설정 타입 ────────────────────────────────

type OpenCodeAgentConfig = {
  description: string;
  mode: 'all';
  prompt: string;
  tools: {
    write: false;
    edit: false;
    bash: false;
  };
  temperature: number;
};

// 빌트인 에이전트를 비활성화하는 설정
type OpenCodeDisabledAgentConfig = {
  disable: true;
};

type OpenCodeConfig = {
  $schema: string;
  tools: {
    bash: false;
    write: false;
  };
  agent: Record<string, OpenCodeAgentConfig | OpenCodeDisabledAgentConfig>;
};

export const OPENCODE_REQUIRED_AGENTS: Record<'canvas-agent', OpenCodeAgentConfig> = {
  'canvas-agent': {
    description: '캔버스 의도 평가, 수정 계획 수립, 콘텐츠 생성을 통합 수행하는 단일 에이전트.',
    mode: 'all',
    prompt: CANVAS_AGENT_PROMPT,
    tools: { write: false, edit: false, bash: false },
    temperature: 0.1,
  },
};

export function buildRuntimeConfigJson(): string {
  const runtimeConfig: OpenCodeConfig = {
    $schema: 'https://opencode.ai/config.json',
    tools: {
      bash: false,
      write: false,
    },
    agent: {
      // 빌트인 에이전트 비활성화
      build: { disable: true },
      plan: { disable: true },
      general: { disable: true },
      explore: { disable: true },
      // 앱 전용 통합 에이전트
      ...OPENCODE_REQUIRED_AGENTS,
    },
  };

  return JSON.stringify(runtimeConfig);
}

// ─── 프롬프트 옵션 ─────────────────────────────────────────────

export interface PromptOptions {
  maxCanvasLength?: number;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
  writingGoal?: WritingGoal;
  fileMentions?: FileMention[];
  projectPath?: string | null;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
}

// ─── 프롬프트 빌더 ─────────────────────────────────────────────

function getTargetLengthBudget(targetLength: WritingGoal['targetLength']): string {
  switch (targetLength) {
    case 'short':
      return '300-500 words';
    case 'medium':
      return '800-1200 words';
    case 'long':
      return '1500-2500 words';
    default:
      return 'use concise length aligned to user request';
  }
}

/**
 * 통합 채팅 프롬프트를 빌드한다.
 * 기존 buildPhase1Prompt()를 대체하며, buildPhase2Prompt()는 더 이상 필요하지 않다.
 */
export function buildChatPrompt(
  userRequest: string,
  canvasContent: string,
  history: ConversationMessage[] = [],
  options?: PromptOptions
): string {
  const maxCanvasLength = options?.maxCanvasLength ?? 8000;
  const truncatedCanvas = truncateToFit(canvasContent, Math.floor(maxCanvasLength / 4));

  const selectionBlock = options?.selection
    ? `
<selection>
Selected text: "${options.selection.text}"
Context before: "${options.selection.before.slice(-150)}"
Context after: "${options.selection.after.slice(0, 150)}"
</selection>
`
    : '';

  const writingGoalBlock = options?.writingGoal
    ? `
<goal_context>
[GOAL]
Purpose: ${options.writingGoal.purpose}
Audience: ${options.writingGoal.audience}
Tone: ${options.writingGoal.tone}
Target Length: ${options.writingGoal.targetLength}
Length Budget: ${getTargetLengthBudget(options.writingGoal.targetLength)}
[/GOAL]
</goal_context>
`
    : '';

  const fileMentionsBlock = options?.fileMentions && options.fileMentions.length > 0
    ? `
<file_mentions>
${options.fileMentions.map((m) => `- [@${m.filePath}](project://${m.filePath})`).join('\n')}
</file_mentions>
`
    : '';

  const historyBlock = history.length > 0
    ? `<conversation_history>
${formatHistory(history)}
</conversation_history>
`
    : '';

  return `${buildCriticalConstraint(options?.projectPath)}

<canvas>
${truncatedCanvas}
</canvas>
${selectionBlock}
${writingGoalBlock}
${fileMentionsBlock}
${historyBlock}
<user_request>
${userRequest}
</user_request>`;
}

// ─── 내부 유틸 ─────────────────────────────────────────────────

function formatHistory(history: ConversationMessage[]): string {
  if (history.length === 0) return '';

  const providerDisplayName: Record<string, string> = {
    opencode: 'OpenCode',
  };

  return history
    .map((msg) => {
      if (msg.role === 'assistant' && msg.provider) {
        const displayName = providerDisplayName[msg.provider] || msg.provider;
        return `[ASSISTANT (responded by ${displayName})]: ${msg.content}`;
      }
      return `[${msg.role.toUpperCase()}]: ${msg.content}`;
    })
    .join('\n\n');
}

function buildCriticalConstraint(projectPath?: string | null): string {
  return `[CRITICAL CONSTRAINT]
1. **READ-ONLY MODE** - You are running as a **signal-based responder**. You MUST NOT use any write or edit tools.
2. **WORKING DIRECTORY** - Your current working directory is: \`${projectPath}\`. Be aware of this path and use it as context when handling user requests.`;
}
