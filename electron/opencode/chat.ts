import type { IpcMainInvokeEvent } from 'electron';
import { spawn } from 'node:child_process';
import type { ChatRequest, ChatResult } from './types';

interface OpenCodeJsonEvent {
  type?: string;
  part?: {
    text?: string;
  };
  error?: string;
}

function composePrompt(prompt: string, systemInstruction?: string): string {
  if (!systemInstruction) {
    return prompt;
  }
  return `${systemInstruction}\n\n${prompt}`;
}

export async function chat(
  event: IpcMainInvokeEvent,
  request: ChatRequest
): Promise<ChatResult> {
  return new Promise((resolve) => {
    const args = ['run', composePrompt(request.prompt, request.systemInstruction), '--format', 'json'];

    if (request.model) {
      args.push('--model', request.model);
    }

    if (request.variant) {
      args.push('--variant', request.variant);
    }

    const child = spawn('opencode', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdoutBuffer = '';
    let accumulatedText = '';
    let capturedError = '';
    let completed = false;

    const finalize = (result: ChatResult) => {
      if (completed) {
        return;
      }
      completed = true;
      resolve(result);
    };

    const flushLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      try {
        const payload = JSON.parse(trimmed) as OpenCodeJsonEvent;
        if (payload.type === 'text' && payload.part?.text) {
          accumulatedText += payload.part.text;
          if (!event.sender.isDestroyed()) {
            event.sender.send('opencode:chat:chunk', { text: payload.part.text });
          }
          return;
        }

        if (payload.type === 'error' && payload.error) {
          capturedError = payload.error;
        }
      } catch {
        // Ignore non-JSON lines.
      }
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf-8');

      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        flushLine(line);
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      capturedError += chunk.toString('utf-8');
    });

    child.on('error', (error) => {
      const errorMessage = `OpenCode process failed: ${error.message}`;
      if (!event.sender.isDestroyed()) {
        event.sender.send('opencode:chat:chunk', { error: errorMessage });
      }
      finalize({ success: false, error: errorMessage });
    });

    child.on('close', (code) => {
      if (stdoutBuffer.trim()) {
        flushLine(stdoutBuffer);
      }

      if (code !== 0) {
        const errorMessage = (capturedError || `OpenCode exited with code ${code}`).trim();
        if (!event.sender.isDestroyed()) {
          event.sender.send('opencode:chat:chunk', { error: errorMessage });
        }
        finalize({ success: false, error: errorMessage });
        return;
      }

      if (!accumulatedText.trim()) {
        const errorMessage = 'OpenCode returned empty response';
        if (!event.sender.isDestroyed()) {
          event.sender.send('opencode:chat:chunk', { error: errorMessage });
        }
        finalize({ success: false, error: errorMessage });
        return;
      }

      if (!event.sender.isDestroyed()) {
        event.sender.send('opencode:chat:chunk', { done: true });
      }

      finalize({ success: true });
    });
  });
}
