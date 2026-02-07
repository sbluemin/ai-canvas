import type { IpcMainInvokeEvent } from 'electron';
import type { AiChatRequest, AiChatEvent } from './types';
import { buildPhase1Prompt, buildPhase2Prompt } from '../prompts';
import { parsePhase1Response, parsePhase2Response } from './parser';
import { callProvider } from './providerAdapter';

const PHASE2_STREAM_CHUNK_SIZE = 12;
const PHASE2_STREAM_TICK_MS = 16;

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
  const { runId, provider, prompt, history, canvasContent, selection, modelId } = request;
  
  const sendEvent = (evt: AiChatEvent) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('ai:chat:event', evt);
    }
  };
  
  let currentPhase: 'evaluating' | 'updating' = 'evaluating';
  
  try {
    sendEvent({ runId, type: 'phase', phase: 'evaluating' });
    
    const phase1Prompt = buildPhase1Prompt(prompt, canvasContent, history, { selection });
    
    let phase1RawBuffer = '';
    let lastPhase1Message = '';
    const phase1RawText = await callProvider(provider, event, phase1Prompt, undefined, modelId, (chunk) => {
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
      
      const phase2Prompt = buildPhase2Prompt(prompt, canvasContent, phase1Result.updatePlan);
      
      const phase2RawText = await callProvider(provider, event, phase2Prompt, undefined, modelId);
      
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
