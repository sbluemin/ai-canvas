import { truncateToFit } from './canvas';

export interface PromptOptions {
  maxCanvasLength?: number;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const PHASE1_PROMPT = `You are an AI assistant for "AI Canvas", a collaborative markdown document editor.

Your task is to evaluate the user's request and determine if the canvas document needs to be updated.

## Response Format
You MUST respond with a valid JSON object only. No text before or after.
{
  "message": "Your response to the user (required)",
  "needsCanvasUpdate": true or false,
  "updatePlan": "Brief description of planned changes (only if needsCanvasUpdate is true)"
}

## Decision Criteria

### needsCanvasUpdate = true when:
- User explicitly asks to add, modify, delete, or reorganize content
- User requests creating new sections, headings, lists, tables, code blocks
- User asks to improve, rewrite, expand, or condense existing content
- Keywords: 추가, 수정, 삭제, 작성, 변경, add, update, write, create, modify, delete, remove

### needsCanvasUpdate = false when:
- User asks questions about the content
- User wants feedback, review, or suggestions without applying them
- User is brainstorming or exploring ideas
- User's request is ambiguous (ask for clarification)

## Guidelines
- Respond in the same language as the user
- When needsCanvasUpdate is true, briefly explain what changes you plan to make
- When needsCanvasUpdate is false, provide a helpful response to the user's question
- Be conversational and friendly in your message`;

const PHASE2_PROMPT = `You are an AI assistant updating a markdown document.

Your task is to update the canvas based on the user's request and the planned changes.

## Response Format
Output ONLY the complete updated markdown document. No JSON, no explanations, no code blocks.
Just the raw markdown content that should replace the current canvas.

## Rules
1. Include the COMPLETE document, not just the changed parts
2. Preserve all existing content unless explicitly asked to modify it
3. Maintain the document's existing style and formatting
4. Apply only the changes specified in the update plan
5. Use proper markdown formatting`;

function formatHistory(history: ConversationMessage[]): string {
  if (history.length === 0) return '';
  
  return history
    .map(msg => `[${msg.role.toUpperCase()}]: ${msg.content}`)
    .join('\n\n');
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

  const historyBlock = history.length > 0
    ? `<conversation_history>
${formatHistory(history)}
</conversation_history>
`
    : '';

  return `<system>
${PHASE1_PROMPT}
</system>

<canvas>
${truncatedCanvas}
</canvas>
${selectionBlock}
${historyBlock}
<user_request>
${userRequest}
</user_request>`;
}

export function buildPhase2Prompt(
  userRequest: string,
  canvasContent: string,
  updatePlan: string
): string {
  return `<system>
${PHASE2_PROMPT}
</system>

<current_canvas>
${canvasContent}
</current_canvas>

<user_request>
${userRequest}
</user_request>

<update_plan>
${updatePlan}
</update_plan>

Now output the complete updated markdown document:`;
}

export { buildPhase1Prompt as buildPrompt };
