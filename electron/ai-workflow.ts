import type { IpcMainInvokeEvent } from 'electron';
import type { AiChatRequest, AiChatEvent, OpenCodeChatChunk, OpenCodeJsonEvent, ThinkingActivity } from './ai-types';
import { buildPhase1Prompt, buildPhase2Prompt } from './ai-prompts';
import { parsePhase1Response, parsePhase2Response } from './ai-parser';
import { chatWithOpenCode, getOpenCodeProjectPath, shutdownOpenCodeRuntime } from './opencode-runtime/runtime';

const PHASE2_STREAM_CHUNK_SIZE = 12;
const PHASE2_STREAM_TICK_MS = 16;
const PHASE2_TIMEOUT_MS = 600_000;

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

function getStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() ?? '';
}

function normalizePathTarget(raw: string): string {
  return raw.split(/[\\/]/).pop() ?? raw;
}

function resolveToolName(payload: OpenCodeJsonEvent): string | null {
  if (typeof payload.tool === 'string') {
    return payload.tool;
  }
  if (payload.tool && typeof payload.tool === 'object') {
    return getStringValue(payload.tool.name);
  }
  return getStringValue(payload.name);
}

function resolveToolTarget(payload: OpenCodeJsonEvent): string | undefined {
  const directTarget = getStringValue(payload.target) || getStringValue(payload.path) || getStringValue(payload.file);
  if (directTarget) {
    return normalizePathTarget(directTarget);
  }

  const input = payload.input ?? payload.args;
  if (input && typeof input === 'object') {
    const objectInput = input as Record<string, unknown>;
    const filePath =
      getStringValue(objectInput.filePath) ||
      getStringValue(objectInput.path) ||
      getStringValue(objectInput.file) ||
      getStringValue(objectInput.target);
    if (filePath) {
      return normalizePathTarget(filePath);
    }
  }

  return undefined;
}

function resolveThinkingText(payload: OpenCodeJsonEvent): string | null {
  return (
    getStringValue(payload.message) ||
    getStringValue(payload.summary) ||
    getStringValue(payload.reasoning) ||
    getStringValue(payload.content) ||
    getStringValue(payload.part?.text) ||
    getStringValue(payload.text)
  );
}

function mapToThinkingActivity(payload: OpenCodeJsonEvent): ThinkingActivity | null {
  const eventType = payload.type;
  if (!eventType) {
    return null;
  }

  if (eventType === 'step_start') {
    return {
      kind: 'step_start',
      label: resolveThinkingText(payload) || '요청 분석 중...',
    };
  }

  if (eventType === 'tool_use') {
    const tool = (resolveToolName(payload) || 'tool').toLowerCase();
    const target = resolveToolTarget(payload);
    let label = `${tool} 사용`;

    if (tool === 'read' && target) {
      label = `@${target} 참조`;
    } else if (tool === 'bash') {
      label = '명령 실행 중...';
    }

    return {
      kind: 'tool_use',
      tool,
      label,
      ...(target ? { target } : {}),
    };
  }

  if (eventType === 'thinking' || eventType === 'reasoning') {
    const text = resolveThinkingText(payload);
    if (!text) {
      return null;
    }
    const summary = firstLine(text);
    if (!summary) {
      return null;
    }
    return {
      kind: 'thinking',
      summary,
      ...(text !== summary ? { detail: text } : {}),
    };
  }

  if (eventType === 'step_finish') {
    return { kind: 'step_finish' };
  }

  return null;
}

async function callProvider(
  prompt: string,
  modelId?: string,
  variant?: string,
  onChunk?: (chunk: OpenCodeChatChunk) => void,
  agent?: string
): Promise<string> {
  let capturedError: string | undefined;

  const result = await chatWithOpenCode(
    { prompt, model: modelId, variant, agent },
    (chunk) => {
      if (chunk.error) {
        capturedError = chunk.error;
      }
      onChunk?.(chunk);
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

export async function executeAiChatWorkflow(event: IpcMainInvokeEvent, request: AiChatRequest): Promise<void> {
  const { runId, prompt, history, canvasContent, selection, modelId, variant, writingGoal, fileMentions } = request;

  const sendEvent = (evt: AiChatEvent) => {
    try {
      if (!event.sender.isDestroyed()) {
        event.sender.send('ai:chat:event', evt);
      }
    } catch {
      // no-op
    }
  };

  let currentPhase: 'evaluating' | 'updating' = 'evaluating';

  try {
    sendEvent({ runId, type: 'phase', phase: 'evaluating' });

    const phase1Prompt = buildPhase1Prompt(prompt, canvasContent, history, {
      selection,
      writingGoal,
      fileMentions,
      projectPath: getOpenCodeProjectPath(),
    });

    let phase1RawBuffer = '';
    let lastPhase1Message = '';
    const phase1RawText = await callProvider(phase1Prompt, modelId, variant, (chunk) => {
      if (chunk.event) {
        const activity = mapToThinkingActivity(chunk.event);
        if (activity) {
          sendEvent({
            runId,
            type: 'thinking_stream',
            phase: 'evaluating',
            activity,
          });
        }
      }

      if (chunk.text) {
        phase1RawBuffer += chunk.text;
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
      }
    }, 'canvas-planner');

    const phase1Result = parsePhase1Response(phase1RawText);
    const fallbackPhase1Message = (
      (lastPhase1Message && lastPhase1Message.trim().length > 0 ? lastPhase1Message : null) ||
      extractMessageField(phase1RawText) ||
      phase1RawText
    ).trim();
    const phase1Message = phase1Result.message.trim().length > 0
      ? phase1Result.message
      : fallbackPhase1Message;

    sendEvent({
      runId,
      type: 'phase1_result',
      message: phase1Message,
      needsCanvasUpdate: phase1Result.needsCanvasUpdate,
      updatePlan: phase1Result.updatePlan,
    });

    if (phase1Result.needsCanvasUpdate && phase1Result.updatePlan) {
      currentPhase = 'updating';
      sendEvent({ runId, type: 'phase', phase: 'updating' });

      const phase2Prompt = buildPhase2Prompt(prompt, canvasContent, phase1Result.updatePlan, writingGoal, getOpenCodeProjectPath());
      const phase2RawText = await Promise.race([
        callProvider(phase2Prompt, modelId, variant, (chunk) => {
          if (!chunk.event) {
            return;
          }

          const activity = mapToThinkingActivity(chunk.event);
          if (!activity) {
            return;
          }

          sendEvent({
            runId,
            type: 'thinking_stream',
            phase: 'updating',
            activity,
          });
        }, 'canvas-writer'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Phase 2 timed out')), PHASE2_TIMEOUT_MS)),
      ]);

      const phase2Result = parsePhase2Response(phase2RawText);

      if (!phase2Result) {
        sendEvent({ runId, type: 'error', phase: 'updating', error: 'Failed to parse Phase 2 response' });
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
    sendEvent({ runId, type: 'error', phase: currentPhase, error: errorMessage });
  } finally {
    sendEvent({ runId, type: 'done' });
  }
}

export { shutdownOpenCodeRuntime };
