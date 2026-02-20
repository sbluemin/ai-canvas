import type { IpcMainInvokeEvent } from 'electron';
import type { AiChatRequest, AiChatEvent } from './types';
import { buildPhase1Prompt, buildPhase2Prompt } from '../prompts';
import { parsePhase1Response, parsePhase2Response } from './parser';
import { callProvider } from './providerAdapter';
import { getOpenCodeProjectPath } from './backend';

const PHASE2_STREAM_CHUNK_SIZE = 12;
const PHASE2_STREAM_TICK_MS = 16;
const PHASE2_TIMEOUT_MS = 600_000; // Phase 2 응답 타임아웃 (10분)

function decodeJsonStringFragment(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
}

function extractMessageField(rawText: string): string | null {
  const keyMatch = /"message"\s*:\s*"/.exec(rawText);
  if (!keyMatch) {
    return null;
  }

  let escaped = false;
  let value = '';
  for (let i = keyMatch.index + keyMatch[0].length; i < rawText.length; i += 1) {
    const ch = rawText[i];

    if (escaped) {
      value += `\\${ch}`;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      return decodeJsonStringFragment(value);
    }

    value += ch;
  }

  return decodeJsonStringFragment(value);
}

async function streamPhaseMessageAfterResult(
  sendEvent: (evt: AiChatEvent) => void,
  runId: string,
  phase: 'evaluating' | 'updating',
  message: string
): Promise<void> {
  if (!message) {
    return;
  }

  for (let end = PHASE2_STREAM_CHUNK_SIZE; end < message.length + PHASE2_STREAM_CHUNK_SIZE; end += PHASE2_STREAM_CHUNK_SIZE) {
    sendEvent({
      runId,
      type: 'phase_message_stream',
      phase,
      message: message.slice(0, end),
    });

    if (end < message.length) {
      await new Promise((resolve) => setTimeout(resolve, PHASE2_STREAM_TICK_MS));
    }
  }
}

export async function executeAiChatWorkflow(
  event: IpcMainInvokeEvent,
  request: AiChatRequest
): Promise<void> {
  const { runId, prompt, history, canvasContent, selection, modelId, variant, writingGoal, fileMentions } = request;
  
  const sendEvent = (evt: AiChatEvent) => {
    try {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:chat:event', evt);
      }
    } catch {
      // 윈도우가 isDestroyed()와 send() 사이에 파괴될 수 있음 (TOCTOU)
    }
  };

  if (process.env.MOCK_AI === 'true') {
    sendEvent({ runId, type: 'phase', phase: 'evaluating' });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const mockMessage = "Sure, I'll update the canvas for you.";
    for (let i = 0; i < mockMessage.length; i += 5) {
      sendEvent({
        runId,
        type: 'phase_message_stream',
        phase: 'evaluating',
        message: mockMessage.slice(0, i + 5),
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const needsUpdate = prompt.includes('update') || prompt.includes('add') || prompt.includes('change');
    sendEvent({
      runId,
      type: 'phase1_result',
      message: mockMessage,
      needsCanvasUpdate: needsUpdate,
      updatePlan: needsUpdate ? "Update canvas content" : undefined,
    });

    if (needsUpdate) {
      sendEvent({ runId, type: 'phase', phase: 'updating' });
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const newContent = canvasContent + "\n\n## E2E Test Section\n\nTest content for E2E.";
      sendEvent({
        runId,
        type: 'phase2_result',
        message: "Canvas has been updated.",
        canvasContent: newContent,
      });
      
      await streamPhaseMessageAfterResult(sendEvent, runId, 'updating', "Canvas has been updated.");
    }

    sendEvent({ runId, type: 'done' });
    return;
  }
  
  let currentPhase: 'evaluating' | 'updating' = 'evaluating';
  
  try {
    sendEvent({ runId, type: 'phase', phase: 'evaluating' });
    
    const phase1Prompt = buildPhase1Prompt(prompt, canvasContent, history, { selection, writingGoal, fileMentions, projectPath: getOpenCodeProjectPath() });
    
    let phase1RawBuffer = '';
    let lastPhase1Message = '';
    const phase1RawText = await callProvider(event, phase1Prompt, undefined, modelId, variant, (chunk) => {
      phase1RawBuffer += chunk;
      const message = extractMessageField(phase1RawBuffer);
      if (message !== null && message !== lastPhase1Message) {
        lastPhase1Message = message;
        sendEvent({
          runId,
          type: 'phase_message_stream',
          phase: 'evaluating',
          message,
        });
      }
    });
    
    const phase1Result = parsePhase1Response(phase1RawText);
    
    sendEvent({
      runId,
      type: 'phase1_result',
      message: phase1Result.message,
      needsCanvasUpdate: phase1Result.needsCanvasUpdate,
      updatePlan: phase1Result.updatePlan,
    });
    
    if (phase1Result.needsCanvasUpdate && phase1Result.updatePlan) {
      currentPhase = 'updating';
      sendEvent({ runId, type: 'phase', phase: 'updating' });
      
      const phase2Prompt = buildPhase2Prompt(prompt, canvasContent, phase1Result.updatePlan, writingGoal, getOpenCodeProjectPath());
      
      const phase2RawText = await Promise.race([
        callProvider(event, phase2Prompt, undefined, modelId, variant),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Phase 2 timed out')), PHASE2_TIMEOUT_MS)
        ),
      ]);
      
      const phase2Result = parsePhase2Response(phase2RawText);
      
      if (!phase2Result) {
        sendEvent({
          runId,
          type: 'error',
          phase: 'updating',
          error: 'Failed to parse Phase 2 response',
        });
        return;
      }
      
      sendEvent({
        runId,
        type: 'phase2_result',
        message: phase2Result.message,
        canvasContent: phase2Result.canvasContent,
      });

      await streamPhaseMessageAfterResult(sendEvent, runId, 'updating', phase2Result.message);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendEvent({
      runId,
      type: 'error',
      phase: currentPhase,
      error: errorMessage,
    });
  } finally {
    sendEvent({ runId, type: 'done' });
  }
}
