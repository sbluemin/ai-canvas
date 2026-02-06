import type { ValidTokenResult, ChatRequest, ChatResult } from './types';
import type { IpcMainInvokeEvent } from 'electron';

// Copilot Chat API 엔드포인트
const COPILOT_CHAT_URL = 'https://api.githubcopilot.com/chat/completions';
const DEFAULT_MODEL = 'gpt-4o';
const COPILOT_HEADERS = {
  'User-Agent': 'GitHubCopilotChat/0.35.0',
  'Editor-Version': 'vscode/1.107.0',
  'Editor-Plugin-Version': 'copilot-chat/0.35.0',
  'Copilot-Integration-Id': 'vscode-chat',
} as const;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function* streamChatCompletion(
  auth: ValidTokenResult,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const response = await fetch(COPILOT_CHAT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Openai-Intent': 'conversation-edits',
      'X-Initiator': 'user',
      ...COPILOT_HEADERS,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      stream: true,
      temperature: 0.7,
    }),
  });

  console.log('[Copilot] Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let chunkCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[Copilot] Stream done, total chunks yielded:', chunkCount);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;

        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const data = JSON.parse(jsonStr);
          const content = data.choices?.[0]?.delta?.content;
          if (content) {
            chunkCount++;
            yield content;
          }
        } catch {}
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
    const messages: ChatMessage[] = [];

    if (request.systemInstruction) {
      messages.push({ role: 'system', content: request.systemInstruction });
    }
    
    messages.push({ role: 'user', content: request.prompt });

    const stream = streamChatCompletion(auth, messages);

    for await (const text of stream) {
      if (!event.sender.isDestroyed()) {
        event.sender.send('copilot:chat:chunk', { text });
      }
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('copilot:chat:chunk', { done: true });
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!event.sender.isDestroyed()) {
      event.sender.send('copilot:chat:chunk', { error: errorMessage });
    }
    return { success: false, error: errorMessage };
  }
}
