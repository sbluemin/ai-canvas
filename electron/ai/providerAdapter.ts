import type { IpcMainInvokeEvent } from 'electron';
import type { AiProvider } from './types';
import * as gemini from '../gemini';
import * as codex from '../codex';
import * as anthropic from '../anthropic';

export async function callProvider(
  provider: AiProvider,
  _event: IpcMainInvokeEvent,
  prompt: string,
  systemInstruction?: string,
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
  
  switch (provider) {
    case 'gemini': {
      const auth = await gemini.getValidAccessToken();
      if (!auth) throw new Error('Gemini not authenticated');
      const result = await gemini.chat(mockEvent, auth, { prompt, systemInstruction });
      if (!result.success) {
        throw new Error(result.error || capturedError || 'Gemini chat failed');
      }
      break;
    }
    case 'openai': {
      const auth = await codex.getValidAccessToken();
      if (!auth) throw new Error('OpenAI not authenticated');
      const result = await codex.chat(mockEvent, auth, { prompt, systemInstruction });
      if (!result.success) {
        throw new Error(result.error || capturedError || 'OpenAI chat failed');
      }
      break;
    }
    case 'anthropic': {
      const auth = await anthropic.getValidAccessToken();
      if (!auth) throw new Error('Anthropic not authenticated');
      const result = await anthropic.chat(mockEvent, auth, { prompt, systemInstruction });
      if (!result.success) {
        throw new Error(result.error || capturedError || 'Anthropic chat failed');
      }
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
  
  if (capturedError) {
    throw new Error(capturedError);
  }
  
  return chunks.join('');
}
