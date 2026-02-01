import { streamText, type ModelMessage } from 'ai';
import { geminiModel, createModel } from './provider';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface StreamChatOptions {
  prompt: string;
  history?: ChatMessage[];
  modelId?: string;
  system?: string;
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onError: (error: string) => void;
  onDone: () => void;
}

function toModelMessages(history: ChatMessage[]): ModelMessage[] {
  return history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

export async function streamChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const { prompt, history = [], modelId, system } = options;

  try {
    const model = modelId ? createModel(modelId) : geminiModel;

    const messages: ModelMessage[] = [
      ...toModelMessages(history),
      { role: 'user' as const, content: prompt },
    ];

    const result = streamText({
      model,
      system,
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
  const { prompt, history = [], modelId, system } = options;

  const model = modelId ? createModel(modelId) : geminiModel;

  const messages: ModelMessage[] = [
    ...toModelMessages(history),
    { role: 'user' as const, content: prompt },
  ];

  const result = streamText({
    model,
    system,
    messages,
  });

  const encoder = new TextEncoder();

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
}
