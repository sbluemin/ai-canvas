import { streamText, generateText, type ModelMessage } from 'ai';
import { 
  buildPhase1Prompt, 
  buildPhase2Prompt, 
  buildCompactPrompt,
  needsCompaction,
  formatCompactedHistory,
  type CompactedHistory,
} from '../prompts';
import { validateCompactResponse } from '../prompts/types';
import { geminiModel, createModel } from './provider';

const COMPACT_MODEL = 'gemini-2.0-flash';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChatOptions {
  prompt: string;
  history?: ChatMessage[];
  modelId?: string;
  canvasContent?: string;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
  compactedHistory?: CompactedHistory;
}

export interface Phase2Options {
  userRequest: string;
  canvasContent: string;
  updatePlan: string;
  modelId?: string;
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
  onCompacted?: (compacted: CompactedHistory) => void;
}

async function compactHistory(
  history: ChatMessage[],
  canvasContent: string
): Promise<CompactedHistory | null> {
  try {
    const model = createModel(COMPACT_MODEL);
    const prompt = buildCompactPrompt(history, canvasContent);

    const result = await generateText({
      model,
      messages: [{ role: 'user' as const, content: prompt }],
    });

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return validateCompactResponse(parsed);
  } catch {
    return null;
  }
}

function buildHistoryForPrompt(
  history: ChatMessage[],
  compacted?: CompactedHistory
): ChatMessage[] {
  if (compacted) {
    return [{
      role: 'assistant' as const,
      content: formatCompactedHistory(compacted),
    }];
  }
  return history;
}

export async function streamPhase1(
  options: StreamChatOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { prompt, history = [], modelId, canvasContent = '', selection, compactedHistory } = options;

  try {
    let effectiveHistory = history;
    let newCompacted = compactedHistory;

    if (!compactedHistory && needsCompaction(history)) {
      const compacted = await compactHistory(history, canvasContent);
      if (compacted) {
        newCompacted = compacted;
        effectiveHistory = buildHistoryForPrompt(history, newCompacted);
        callbacks.onCompacted?.(newCompacted);
      }
    } else if (compactedHistory) {
      effectiveHistory = buildHistoryForPrompt(history, compactedHistory);
    }

    const model = modelId ? createModel(modelId) : geminiModel;
    
    const fullPrompt = buildPhase1Prompt(prompt, canvasContent, effectiveHistory, { selection });

    const messages: ModelMessage[] = [
      { role: 'user' as const, content: fullPrompt },
    ];

    const result = streamText({
      model,
      messages,
    });

    for await (const textPart of result.textStream) {
      callbacks.onText(textPart);
    }

    callbacks.onDone();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    callbacks.onError(errorMessage);
    callbacks.onDone();
  }
}

export async function streamPhase2(
  options: Phase2Options,
  callbacks: StreamCallbacks
): Promise<void> {
  const { userRequest, canvasContent, updatePlan, modelId } = options;

  try {
    const model = modelId ? createModel(modelId) : geminiModel;
    
    const fullPrompt = buildPhase2Prompt(userRequest, canvasContent, updatePlan);

    const messages: ModelMessage[] = [
      { role: 'user' as const, content: fullPrompt },
    ];

    const result = streamText({
      model,
      messages,
    });

    for await (const textPart of result.textStream) {
      callbacks.onText(textPart);
    }

    callbacks.onDone();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    callbacks.onError(errorMessage);
    callbacks.onDone();
  }
}

export async function streamChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  return streamPhase1(options, callbacks);
}

export async function streamChatToSSE(options: StreamChatOptions): Promise<ReadableStream> {
  const { prompt, history = [], modelId, canvasContent = '', selection } = options;

  const encoder = new TextEncoder();

  try {
    const model = modelId ? createModel(modelId) : geminiModel;
    
    const fullPrompt = buildPhase1Prompt(prompt, canvasContent, history, { selection });

    const messages: ModelMessage[] = [
      { role: 'user' as const, content: fullPrompt },
    ];

    const result = streamText({
      model,
      messages,
    });

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const textPart of result.textStream) {
            const sseData = `data: ${JSON.stringify({ text: textPart })}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.close();
        }
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
        controller.close();
      },
    });
  }
}
