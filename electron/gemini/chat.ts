import type { GeminiMessage, ValidTokenResult, ChatRequest, ChatResult } from './types';
import type { IpcMainInvokeEvent } from 'electron';

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
const CODE_ASSIST_HEADERS = {
  'User-Agent': 'ai-canvas/1.0.0',
  'X-Goog-Api-Client': 'ai-canvas/1.0.0',
  'Client-Metadata': 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI',
};

async function* streamGenerateContent(
  auth: ValidTokenResult,
  messages: GeminiMessage[],
  systemInstruction?: string
): AsyncGenerator<string> {
  const url = `${CODE_ASSIST_ENDPOINT}/v1internal:streamGenerateContent?alt=sse`;
  
  const requestBody: Record<string, unknown> = {
    contents: messages,
    generationConfig: {
      maxOutputTokens: 8192,
    },
  };
  
  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }
  
  const wrappedBody = {
    project: auth.projectId,
    model: DEFAULT_MODEL,
    request: requestBody,
  };
  
  console.log('[Gemini] Request URL:', url);
  console.log('[Gemini] Request body:', JSON.stringify(wrappedBody, null, 2));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.accessToken}`,
      'Accept': 'text/event-stream',
      ...CODE_ASSIST_HEADERS,
    },
    body: JSON.stringify(wrappedBody),
  });
  
  console.log('[Gemini] Response status:', response.status);
  console.log('[Gemini] Response headers:', Object.fromEntries(response.headers.entries()));
  
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
        console.log('[Gemini] Stream done, total chunks yielded:', chunkCount);
        break;
      }
      
      const rawChunk = decoder.decode(value, { stream: true });
      console.log('[Gemini] Raw chunk received, length:', rawChunk.length);
      
      buffer += rawChunk;
      
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        
        try {
          const data = JSON.parse(jsonStr);
          const responseData = data.response || data;
          
          if (responseData.candidates?.[0]?.content?.parts) {
            for (const part of responseData.candidates[0].content.parts) {
              if (part.text) {
                chunkCount++;
                console.log('[Gemini] Yielding chunk', chunkCount, ':', part.text.slice(0, 50));
                yield part.text;
              }
            }
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
    const messages: GeminiMessage[] = [
      { role: 'user', parts: [{ text: request.prompt }] },
    ];

    const stream = streamGenerateContent(auth, messages, request.systemInstruction);
    
    for await (const text of stream) {
      if (!event.sender.isDestroyed()) {
        event.sender.send('gemini:chat:chunk', { text });
      }
    }

    if (!event.sender.isDestroyed()) {
      event.sender.send('gemini:chat:chunk', { done: true });
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!event.sender.isDestroyed()) {
      event.sender.send('gemini:chat:chunk', { error: errorMessage });
    }
    return { success: false, error: errorMessage };
  }
}
