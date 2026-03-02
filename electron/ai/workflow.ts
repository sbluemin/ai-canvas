import type { IpcMainInvokeEvent } from 'electron';
import type { AiChatRequest, AiChatEvent, AiAgentChatChunk, AiAgentJsonEvent, AgentActivityEvent } from './types';
import { buildChatPrompt, CANVAS_AGENT_PROMPT } from './prompts';
import { SIGNAL_CANVAS_OPEN, SIGNAL_CANVAS_CLOSE } from './prompts';
import { SignalScanner, parseChatResponse } from './parser';
import { chatWithAiAgent, getAiAgentProjectPath, shutdownAiAgentRuntime } from './adapter';

const CHAT_TIMEOUT_MS = 600_000;

// ─── 유틸 헬퍼 ──────────────────────────────────────────────────

function getStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getChunkTextValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() ?? '';
}

function normalizePathTarget(raw: string): string {
  return raw.split(/[\\/]/).pop() ?? raw;
}

function resolveToolName(payload: AiAgentJsonEvent): string | null {
  if (typeof payload.tool === 'string') {
    return payload.tool;
  }
  if (payload.tool && typeof payload.tool === 'object') {
    return getStringValue(payload.tool.name);
  }
  return getStringValue(payload.name);
}

function resolveToolTarget(payload: AiAgentJsonEvent): string | undefined {
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

function resolveThinkingText(payload: AiAgentJsonEvent): string | null {
  return (
    getChunkTextValue(payload.message) ||
    getChunkTextValue(payload.summary) ||
    getChunkTextValue(payload.reasoning) ||
    getChunkTextValue(payload.content) ||
    getChunkTextValue(payload.part?.text) ||
    getChunkTextValue(payload.text)
  );
}

function mapToAgentActivity(payload: AiAgentJsonEvent): AgentActivityEvent | null {
  const eventType = payload.type;
  if (!eventType) {
    return null;
  }

  // 도구 사용 → step
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
      kind: 'step',
      label,
      tool,
      ...(target ? { target } : {}),
    };
  }

  // 작업 시작 → step
  if (eventType === 'step_start') {
    const stepLabel = resolveThinkingText(payload)?.trim();
    return {
      kind: 'step',
      label: stepLabel || '요청 분석 중...',
    };
  }

  // 사고 과정 → thought (스트리밍 텍스트)
  if (eventType === 'thinking' || eventType === 'reasoning') {
    const text = resolveThinkingText(payload);
    if (!text) {
      return null;
    }
    return { kind: 'thought', text };
  }

  // 완료
  if (eventType === 'step_finish') {
    return { kind: 'step_finish' };
  }

  return null;
}

// ─── 프로바이더 호출 ────────────────────────────────────────────

async function callProvider(
  prompt: string,
  modelId?: string,
  variant?: string,
  onChunk?: (chunk: AiAgentChatChunk) => void,
  agent?: string,
  systemInstruction?: string,
): Promise<string> {
  let capturedError: string | undefined;

  const result = await chatWithAiAgent(
    { prompt, model: modelId, variant, agent, systemInstruction },
    (chunk) => {
      if (chunk.error) {
        capturedError = chunk.error;
      }
      onChunk?.(chunk);
    }
  );

  if (!result.success) {
    throw new Error(result.error || capturedError || 'pi SDK chat failed');
  }

  if (capturedError) {
    throw new Error(capturedError);
  }

  return result.text ?? '';
}

// ─── 통합 워크플로우 엔진 ──────────────────────────────────────

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

    // 통합 프롬프트 생성 (1회)
    const chatPrompt = buildChatPrompt(prompt, canvasContent, history, {
      selection,
      writingGoal,
      fileMentions,
      projectPath: getAiAgentProjectPath(),
    });

    // 시그널 스캐너 초기화
    const scanner = new SignalScanner();
    let messageAccum = '';
    let canvasAccum = '';
    let doneAccum = '';
    let lastStreamedMessage = '';

    // 단일 AI 호출
    const rawText = await Promise.race([
      callProvider(chatPrompt, modelId, variant, (chunk) => {
        // thinking/tool 이벤트 처리
        if (chunk.event) {
          const activity = mapToAgentActivity(chunk.event);
          if (activity) {
            sendEvent({
              runId,
              type: 'thinking_stream',
              phase: currentPhase,
              activity,
            });
          }
        }

        // 텍스트 스트리밍 + 시그널 감지
        if (chunk.text) {
          const prevState = scanner.state;
          const result = scanner.feed(chunk.text);

          if (result.text) {
            if (prevState === 'message' || result.signals.includes(SIGNAL_CANVAS_OPEN)) {
              // 시그널 전 텍스트는 message 영역
              messageAccum += result.text;

              if (messageAccum !== lastStreamedMessage) {
                lastStreamedMessage = messageAccum;
                sendEvent({
                  runId,
                  type: 'phase_message_stream',
                  phase: 'evaluating',
                  message: messageAccum.trim(),
                });
              }
            }
          }

          // ⟨CANVAS⟩ 시그널 감지 → phase 전환
          if (result.signals.includes(SIGNAL_CANVAS_OPEN)) {
            currentPhase = 'updating';
            sendEvent({ runId, type: 'phase', phase: 'updating' });
          }

          // canvas 영역 텍스트 누적 + 실시간 스트리밍
          if (scanner.state === 'canvas' && result.text && !result.signals.includes(SIGNAL_CANVAS_OPEN)) {
            canvasAccum += result.text;
            sendEvent({
              runId,
              type: 'canvas_content_stream',
              content: canvasAccum.trim(),
            });
          }

          // ⟨/CANVAS⟩ 이후 Done 메시지 누적 + 스트리밍
          if (scanner.state === 'done' && result.text) {
            let doneFragment = '';

            if (result.signals.includes(SIGNAL_CANVAS_CLOSE)) {
              const closeSignalIdx = chunk.text.indexOf(SIGNAL_CANVAS_CLOSE);
              if (closeSignalIdx !== -1) {
                doneFragment = chunk.text.slice(closeSignalIdx + SIGNAL_CANVAS_CLOSE.length);
              } else {
                doneFragment = result.text;
              }
            } else {
              doneFragment = result.text;
            }

            if (doneFragment.trim().length > 0) {
              doneAccum += doneFragment;
              const messagePart = messageAccum.trim();
              const donePart = doneAccum.trim();
              const combined = donePart.length > 0
                ? (messagePart.length > 0 ? `${messagePart}\n\n${donePart}` : donePart)
                : messagePart;

              sendEvent({
                runId,
                type: 'phase_message_stream',
                phase: 'updating',
                message: combined,
              });
            }
          }
        }
      }, 'canvas-agent', CANVAS_AGENT_PROMPT),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Chat timed out')), CHAT_TIMEOUT_MS)),
    ]);

    // 완료 후 최종 결과 파싱
    const chatResult = parseChatResponse(rawText);
    const doMessage = chatResult.message.trim().length > 0
      ? chatResult.message
      : (lastStreamedMessage.trim() || rawText.trim());

    // 최종 메시지: Do + Done 결합
    const finalMessage = chatResult.doneMessage
      ? `${doMessage}\n\n${chatResult.doneMessage}`
      : doMessage;

    // chat_result 이벤트 전송
    sendEvent({
      runId,
      type: 'chat_result',
      message: finalMessage,
      canvasContent: chatResult.canvasContent,
      doneMessage: chatResult.doneMessage,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendEvent({ runId, type: 'error', phase: currentPhase, error: errorMessage });
  } finally {
    sendEvent({ runId, type: 'done' });
  }
}

export { shutdownAiAgentRuntime };
