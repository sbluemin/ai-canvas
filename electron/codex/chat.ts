import type { ValidTokenResult, ChatRequest, ChatResult } from './types';
import type { IpcMainInvokeEvent } from 'electron';

const CODEX_BASE_URL = 'https://chatgpt.com/backend-api';
const DEFAULT_MODEL = 'gpt-5.2';
const DEFAULT_REASONING = 'low';

const CODEX_HEADERS = {
  'User-Agent': 'ai-canvas/1.0.0',
  'OpenAI-Beta': 'responses=experimental',
  'originator': 'codex_cli_rs',
};

async function* streamGenerateContent(
  auth: ValidTokenResult,
  prompt: string,
  systemInstruction?: string,
  model?: string
): AsyncGenerator<string> {
  const url = `${CODEX_BASE_URL}/codex/responses`;

  const requestBody: Record<string, unknown> = {
    model: model || DEFAULT_MODEL,
    instructions: systemInstruction || 'You are a helpful AI assistant.',
    reasoning: { effort: DEFAULT_REASONING },
    stream: true,
    store: false,
    input: [
      {
        type: 'message',
        role: 'user',
        content: prompt,
      },
    ],
  };

  console.log('[Codex] Request URL:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.accessToken}`,
      'chatgpt-account-id': auth.accountId,
      ...CODEX_HEADERS,
    },
    body: JSON.stringify(requestBody),
  });
  
  console.log('[Codex] Response status:', response.status);
  
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
        console.log('[Codex] Stream done, total chunks yielded:', chunkCount);
        break;
      }
      
      const rawChunk = decoder.decode(value, { stream: true });
      buffer += rawChunk;
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        
        try {
          const data = JSON.parse(jsonStr);
          
          if (data.type === 'response.output_text.delta' && data.delta) {
            chunkCount++;
            yield data.delta;
          } else if (data.type === 'response.content_part.delta' && data.delta?.text) {
            chunkCount++;
            yield data.delta.text;
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
    const stream = streamGenerateContent(auth, request.prompt, request.systemInstruction, request.model);
    
    for await (const text of stream) {
      if (!event.sender.isDestroyed()) {
        event.sender.send('codex:chat:chunk', { text });
      }
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('codex:chat:chunk', { done: true });
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!event.sender.isDestroyed()) {
      event.sender.send('codex:chat:chunk', { error: errorMessage });
    }
    return { success: false, error: errorMessage };
  }
}
