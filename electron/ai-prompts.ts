import { z } from 'zod';
import { truncateToFit } from './ai-canvas-utils';
import type { FileMention, WritingGoal } from './ai-types';

export const CANVAS_PLANNER_PROMPT = `[ROLE]
You are an expert **Ideation Planner** for "AI Canvas" - a collaborative thinking space where users crystallize their ideas into structured documents.
You are ONLY the planner. You evaluate and plan - you do NOT execute changes yourself. A separate agent will execute your plan if canvas updates are needed.

[GOAL]
Understand user intent and determine whether the canvas needs modification, acting as a thoughtful partner who knows when to act and when to discuss.

[RESPONSE FORMAT]
You MUST respond with a valid JSON object only. No text before or after.
{
  "message": "(MARKDOWN) Your response to the user - MUST be under 5 lines and concise (required)",
  "needsCanvasUpdate": true or false,
  "updatePlan": "Detailed plan of what changes to make (required when needsCanvasUpdate is true)"
}

[CRITICAL: MESSAGE TONE & LENGTH GUIDELINES]
- **Maximum 5 lines**: Your "message" must never exceed 5 lines. Focus on the core value or next step.
- Your "message" field must reflect your role as a PLANNER, not an executor:

### When needsCanvasUpdate = true:
- Use PROGRESSIVE tone indicating the action is ABOUT TO HAPPEN, not completed

### When needsCanvasUpdate = false:
- Provide analysis, suggestions, or ask clarifying questions

[DECISION FRAMEWORK]
Ask yourself: *"Would updating the canvas right now genuinely advance the user's goal?"*

[GUIDELINES]
- **Match User's Language** - Respond in the same language as the 'user request'
- **Be Collaborative** - Act as a partner, not a reactive tool
- **Be Concrete** - Avoid vague suggestions; provide specific insights
- **Honor Writing Goals** - When a <goal_context> block is provided, treat it as persistent context: ensure purpose, audience, tone, target length, and explicit length budget shape every response and plan
`;

export const CANVAS_WRITER_PROMPT = `[ROLE]
You are an expert **Concretization Agent** for "AI Canvas" - transforming plans into polished, concrete content.

[GOAL]
Execute the update plan precisely based on the current canvas content, then explain what you accomplished.

[RESPONSE FORMAT]
You MUST respond with a valid JSON object only. No text before or after.
{
  "message": "(MARKDOWN) Explain what you changed and why - MUST be under 5 lines and concise (required)",
  "canvasContent": "The complete updated markdown document (required)"
}
`;

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

type OpenCodeConfig = {
  $schema: string;
  tools: {
    bash: false;
    write: false;
  };
  agent: Record<'canvas-planner' | 'canvas-writer', OpenCodeAgentConfig>;
};

export const OPENCODE_REQUIRED_AGENTS: Record<'canvas-planner' | 'canvas-writer', OpenCodeAgentConfig> = {
  'canvas-planner': {
    description: '캔버스 의도 평가 및 수정 계획 수립. 사용자 요청을 분석하여 캔버스 수정 필요 여부를 판단한다.',
    mode: 'all',
    prompt: CANVAS_PLANNER_PROMPT,
    tools: { write: false, edit: false, bash: false },
    temperature: 0.1,
  },
  'canvas-writer': {
    description: '수정 계획에 따라 캔버스 마크다운 콘텐츠를 구체화하여 생성한다.',
    mode: 'all',
    prompt: CANVAS_WRITER_PROMPT,
    tools: { write: false, edit: false, bash: false },
    temperature: 0.2,
  },
};

export function buildRuntimeConfigJson(): string {
  const runtimeConfig: OpenCodeConfig = {
    $schema: 'https://opencode.ai/config.json',
    tools: {
      bash: false,
      write: false,
    },
    agent: OPENCODE_REQUIRED_AGENTS,
  };

  return JSON.stringify(runtimeConfig);
}

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

export function buildPhase1Prompt(
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

export function buildPhase2Prompt(
  userRequest: string,
  canvasContent: string,
  updatePlan: string,
  writingGoal?: WritingGoal,
  projectPath?: string | null
): string {
  const writingGoalBlock = writingGoal
    ? `
<goal_context>
[GOAL]
Purpose: ${writingGoal.purpose}
Audience: ${writingGoal.audience}
Tone: ${writingGoal.tone}
Target Length: ${writingGoal.targetLength}
Length Budget: ${getTargetLengthBudget(writingGoal.targetLength)}
[/GOAL]
</goal_context>
`
    : '';

  return `${buildCriticalConstraint(projectPath)}

<user_request>
${userRequest}
</user_request>

<current_canvas>
${canvasContent}
</current_canvas>

<update_plan>
${updatePlan}
</update_plan>
${writingGoalBlock}`;
}

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
1. **READ-ONLY MODE** - You are running as a **json-only responder**. You MUST NOT use any write or edit.
2. **WORKING DIRECTORY** - Your current working directory is: \`${projectPath}\`. Be aware of this path and use it as context when handling user requests.`;
}

export type Phase1Response = {
  message: string;
  needsCanvasUpdate: boolean;
  updatePlan?: string;
};

export function validatePhase1Response(data: unknown): Phase1Response | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.message !== 'string' || typeof obj.needsCanvasUpdate !== 'boolean') {
    return null;
  }

  let updatePlan: string | undefined;
  if (obj.updatePlan !== undefined) {
    if (typeof obj.updatePlan === 'string') {
      updatePlan = obj.updatePlan;
    } else if (typeof obj.updatePlan === 'object' && obj.updatePlan !== null) {
      updatePlan = JSON.stringify(obj.updatePlan, null, 2);
    }
  }

  return {
    message: obj.message,
    needsCanvasUpdate: obj.needsCanvasUpdate,
    updatePlan,
  };
}

export const Phase1ResponseSchema = z.object({
  message: z.string(),
  needsCanvasUpdate: z.boolean(),
  updatePlan: z.string().optional(),
});

export const Phase2ResponseSchema = z.object({
  message: z.string(),
  canvasContent: z.string(),
});

export type Phase2Response = z.infer<typeof Phase2ResponseSchema>;

export function validatePhase2Response(data: unknown): Phase2Response | null {
  const result = Phase2ResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}
