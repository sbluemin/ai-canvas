import { streamText, type ModelMessage } from 'ai';
import { buildPrompt } from '../prompts';
import { geminiModel, createModel } from './provider';

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
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

export async function streamChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { prompt, history = [], modelId, canvasContent, selection } = options;

  try {
    const model = modelId ? createModel(modelId) : geminiModel;
    
    const fullPrompt = canvasContent !== undefined
      ? buildPrompt(prompt, canvasContent, history, { selection })
      : prompt;

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

export async function streamChatToSSE(options: StreamChatOptions): Promise<ReadableStream> {
  const { prompt, history = [], modelId, canvasContent, selection } = options;

  const encoder = new TextEncoder();

  try {
    const model = modelId ? createModel(modelId) : geminiModel;
    
    const fullPrompt = canvasContent !== undefined
      ? buildPrompt(prompt, canvasContent, history, { selection })
      : prompt;

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
