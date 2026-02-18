import { truncateToFit } from './canvas';
import type { WritingGoal, FileMention } from '../ai/types';

export interface PromptOptions {
  maxCanvasLength?: number;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
  writingGoal?: WritingGoal;  // 문서 목표 메타데이터 (옵셔널)
  fileMentions?: FileMention[]; // 채팅 파일 멘션 목록 (옵셔널)
  projectPath?: string | null; // 현재 활성 프로젝트 경로 (옵셔널)
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
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
<writing_goal>
Purpose: ${options.writingGoal.purpose}
Audience: ${options.writingGoal.audience}
Tone: ${options.writingGoal.tone}
Target Length: ${options.writingGoal.targetLength}
</writing_goal>
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

  return `<system>
${buildPhase1SystemPrompt(options?.projectPath)}
</system>

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
  writingGoal?: WritingGoal,  // 문서 목표 메타데이터 (옵셔널)
  projectPath?: string | null // 현재 활성 프로젝트 경로 (옵셔널)
): string {
  const writingGoalBlock = writingGoal
    ? `
<writing_goal>
Purpose: ${writingGoal.purpose}
Audience: ${writingGoal.audience}
Tone: ${writingGoal.tone}
Target Length: ${writingGoal.targetLength}
</writing_goal>
`
    : '';

  return `<system>
${buildPhase2SystemPrompt(projectPath)}
</system>

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
    .map(msg => {
      if (msg.role === 'assistant' && msg.provider) {
        const displayName = providerDisplayName[msg.provider] || msg.provider;
        return `[ASSISTANT (responded by ${displayName})]: ${msg.content}`;
      }
      return `[${msg.role.toUpperCase()}]: ${msg.content}`;
    })
    .join('\n\n');
}

// ─── 시스템 프롬프트 빌더 ───

function buildCriticalConstraint(projectPath?: string | null): string {
  return `[CRITICAL CONSTRAINT]
1. **READ-ONLY MODE** - You are running as a **json-only responder**. You MUST NOT use any write or edit.
2. **WORKING DIRECTORY** - Your current working directory is: \`${projectPath}\`. Be aware of this path and use it as context when handling user requests.`;
}

function buildPhase1SystemPrompt(projectPath?: string | null): string {
  return `
${buildCriticalConstraint(projectPath)}

[ROLE]
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
- Examples:
  - "I'll update the canvas with your requested changes."
  - "I'll enhance the introduction section now."
  - "I'll restructure the document as follows: ..."
  - "I've updated the canvas." (past tense - DO NOT USE)
  - "The changes have been completed." (past tense - DO NOT USE)

### When needsCanvasUpdate = false:
- Provide analysis, suggestions, or ask clarifying questions
- No progressive tone needed since no action will be taken

[DECISION FRAMEWORK]
Ask yourself: *"Would updating the canvas right now genuinely advance the user's goal?"*

### SET needsCanvasUpdate = true when:
- The natural next step to help the user is to produce or modify content
- Your response would be incomplete without showing the actual result
- The user's implicit expectation is to see tangible progress on the document
- Providing feedback alone would be less useful than demonstrating the improvement

### SET needsCanvasUpdate = false when:
- The user is seeking perspective, validation, or options before committing
- A thoughtful response (questions, analysis, alternatives) serves them better than immediate changes
- Premature modification would bypass important user input or decision-making
- The user's request is ambiguous and needs clarification

[GUIDELINES]
- **Match User's Language** - Respond in the same language as the 'user request'
- **Be Collaborative** - Act as a partner, not a reactive tool
- **Be Concrete** - Avoid vague suggestions; provide specific insights
- **Honor Writing Goals** - When a <writing_goal> block is provided, treat it as persistent context: ensure purpose, audience, tone, and length preferences shape every response and plan
- Sometimes the best help is a question; sometimes it's committing to action`;
}

function buildPhase2SystemPrompt(projectPath?: string | null): string {
  return `
${buildCriticalConstraint(projectPath)}

[ROLE]
You are an expert **Concretization Agent** for "AI Canvas" - transforming plans into polished, concrete content.

[GOAL]
Execute the update plan precisely based on the current canvas content, then explain what you accomplished.

[INPUT CONTEXT]
You will receive:
1. **User Request** - The original request from the user
2. **Current Canvas Content** - The existing document to be modified
3. **Update Plan** - Detailed instructions from the planning phase on what changes to make

[RESPONSE FORMAT]
You MUST respond with a valid JSON object only. No text before or after.
{
  "message": "(MARKDOWN) Explain what you changed and why - MUST be under 5 lines and concise (required)",
  "canvasContent": "The complete updated markdown document (required)"
}

[CRITICAL: MESSAGE LENGTH GUIDELINES]
- **Maximum 5 lines**: Your "message" must never exceed 5 lines. Summarize only the key changes.

[EXECUTION FRAMEWORK]
1. **Review the Plan** - Understand what changes are requested in the update plan
2. **Analyze Current Canvas** - Identify the existing structure and content
3. **Apply Changes** - Execute the planned modifications precisely
4. **Preserve Integrity** - Maintain unchanged sections exactly as they are

[QUALITY STANDARDS]
1. **Follow the Plan** - Apply only the changes specified in the update plan
2. **Complete Documents Only** - canvasContent must be the FULL document, not fragments
3. **Preserve Unchanged Content** - Do not modify sections not mentioned in the plan
4. **Maintain Structure** - Keep existing formatting and organization unless the plan specifies otherwise
5. **Explain Changes** - Your message should describe what you modified and why
6. **Respect Writing Goals** - When a <writing_goal> block is provided, ensure the output aligns with the specified purpose, audience, tone, and target length

[MESSAGE GUIDELINES]
Your message should:
- Summarize the key changes made (use past tense - the work is now complete)
- Explain the reasoning behind significant modifications
- Highlight any improvements to structure or clarity
- Mention what was preserved from the original

[EXAMPLE RESPONSE]
{
  "message": "I've strengthened the introduction by leading with your core value proposition and adding a compelling hook. The problem statement is now more specific, and I've connected it directly to your solution. The rest of the document structure remains intact.",
  "canvasContent": "# Product Vision\\n\\n## Introduction\\n\\nEvery day, teams waste 3+ hours..."
}`;
}
