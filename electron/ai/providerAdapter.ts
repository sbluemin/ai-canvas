import type { IpcMainInvokeEvent } from 'electron';
import * as opencode from '../opencode';

export async function callProvider(
  _event: IpcMainInvokeEvent,
  prompt: string,
  systemInstruction?: string,
  modelId?: string,
  variant?: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const chunks: string[] = [];
  let capturedError: string | undefined;
  
  const mockEvent = {
    sender: {
      send: (_channel: string, data: { text?: string; done?: boolean; error?: string }) => {
        if (data.error) {
          capturedError = data.error;
        }
        if (data.text) {
          chunks.push(data.text);
          onChunk?.(data.text);
        }
      },
      isDestroyed: () => false,
    },
  } as unknown as IpcMainInvokeEvent;
  
  const result = await opencode.chat(mockEvent, { prompt, systemInstruction, model: modelId, variant });
  if (!result.success) {
    throw new Error(result.error || capturedError || 'OpenCode chat failed');
  }
  
  if (capturedError) {
    throw new Error(capturedError);
  }
  
  return chunks.join('');
}
