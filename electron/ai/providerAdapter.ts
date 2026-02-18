import type { IpcMainInvokeEvent } from 'electron';
import { chatWithOpenCode } from './backend';

export async function callProvider(
  _event: IpcMainInvokeEvent,
  prompt: string,
  systemInstruction?: string,
  modelId?: string,
  variant?: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  let capturedError: string | undefined;

  const result = await chatWithOpenCode(
    { prompt, systemInstruction, model: modelId, variant },
    (chunk) => {
      if (chunk.error) {
        capturedError = chunk.error;
      }
      if (chunk.text) {
        onChunk?.(chunk.text);
      }
    }
  );

  if (!result.success) {
    throw new Error(result.error || capturedError || 'OpenCode chat failed');
  }

  if (capturedError) {
    throw new Error(capturedError);
  }

  return result.text ?? '';
}
