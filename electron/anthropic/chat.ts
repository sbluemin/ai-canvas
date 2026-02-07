import type { ValidTokenResult, ChatRequest, ChatResult } from './types';
import type { IpcMainInvokeEvent } from 'electron';

const DEFAULT_MODEL = 'claude-haiku-4-5';
const ANTHROPIC_API_ENDPOINT = 'https://api.anthropic.com/v1/messages';

async function* streamMessages(
  auth: ValidTokenResult,
  prompt: string,
  systemInstruction?: string,
  model?: string
): AsyncGenerator<string> {
  const messages = [{ role: 'user', content: prompt }];
  
  const body: Record<string, any> = {
    model: model || DEFAULT_MODEL,
    max_tokens: 4096,
    messages: messages,
    stream: true,
  };

  if (systemInstruction) {
    body.system = systemInstruction;
  }

  const response = await fetch(ANTHROPIC_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'oauth-2025-04-20,interleaved-thinking-2025-05-14',
      'Authorization': `Bearer ${auth.accessToken}`,
      'User-Agent': 'claude-cli/2.1.2 (external, cli)',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const dataStr = line.replace(/^data:\s*/, '').trim();
        if (dataStr === '[DONE]') continue;

        try {
          const json = JSON.parse(dataStr);
          if (json.type === 'content_block_delta' && json.delta?.text) {
            yield json.delta.text;
          }
        } catch (e) {
          // Ignore parse errors for incomplete JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function chat(
  event: IpcMainInvokeEvent,
  auth: ValidTokenResult,
  request: ChatRequest
): Promise<ChatResult> {
  try {
    const stream = streamMessages(auth, request.prompt, request.systemInstruction, request.model);

    for await (const text of stream) {
      if (!event.sender.isDestroyed()) {
        event.sender.send('anthropic:chat:chunk', { text });
      }
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('anthropic:chat:chunk', { done: true });
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!event.sender.isDestroyed()) {
      event.sender.send('anthropic:chat:chunk', { error: errorMessage });
    }
    return { success: false, error: errorMessage };
  }
}
