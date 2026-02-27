/**
 * UnifiedAgent SDK 어댑터
 *
 * 기존 opencode-runtime/runtime.ts가 담당하던 역할을 @sbluemin/unified-agent SDK로 대체한다.
 * 기존 인터페이스(chatWithOpenCode, fetchOpenCodeModelsVerbose 등)를 그대로 유지하여
 * ai-workflow.ts / ai-models.ts 측 호출 코드 변경을 최소화한다.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { UnifiedAgentClient } from '@sbluemin/unified-agent';
import type {
  OpenCodeChatChunk,
  OpenCodeChatRequest,
  OpenCodeChatResult,
  OpenCodeJsonEvent,
  OpenCodeRuntimeBinaryMode,
} from './ai-types';
import { buildRuntimeConfigJson } from './ai-prompts';
import { getBackendDirPath, getBackendLocalBinaryPath } from './utils';

const execFileAsync = promisify(execFile);

// ─── 상수 ───

const REQUEST_TIMEOUT_MS = 600_000;
const MODELS_CMD_TIMEOUT_MS = 600_000;
const MODELS_MAX_BUFFER = 16 * 1024 * 1024;
const CLIENT_INFO = { name: 'ai-canvas', version: '1.0.0' };

// ─── 모듈 상태 ───

let runtimeProjectPath: string | null = null;
let runtimeBinaryMode: OpenCodeRuntimeBinaryMode = 'auto';

/** 활성 어댑터 추적 (shutdown 시 일괄 정리용) */
const activeClients = new Set<UnifiedAgentClient>();

// ─── 헬퍼 ───

/**
 * 바이너리 모드와 프로젝트 경로를 바탕으로 opencode CLI 실행 경로를 결정한다.
 * SDK의 `cliPath` 옵션에 전달된다.
 */
function resolveCliPath(): string | undefined {
  // global 모드면 시스템 PATH에서 찾도록 undefined 반환
  if (runtimeBinaryMode === 'global') {
    return undefined;
  }

  // 프로젝트가 없으면 local 검색 불가
  if (!runtimeProjectPath) {
    return undefined;
  }

  // 로컬 바이너리 존재 여부 확인
  const localBinaryPath = getBackendLocalBinaryPath(runtimeProjectPath);
  if (existsSync(localBinaryPath)) {
    return localBinaryPath;
  }

  // local 모드인데 바이너리가 없으면 undefined (SDK가 기본 'opencode' 커맨드 사용)
  return undefined;
}

/**
 * SDK connect()에 전달할 환경변수를 생성한다.
 * OPENCODE_CONFIG_CONTENT, OPENCODE_CONFIG_DIR 등을 포함한다.
 */
function buildSdkEnv(): Record<string, string> {
  const env: Record<string, string> = {
    OPENCODE_CONFIG_CONTENT: buildRuntimeConfigJson(),
  };

  if (runtimeProjectPath) {
    env.OPENCODE_CONFIG_DIR = getBackendDirPath(runtimeProjectPath);
  }

  return env;
}

// ─── SDK 이벤트 → OpenCodeChatChunk 변환 헬퍼 ───

function createThinkingEvent(text: string): OpenCodeJsonEvent {
  return { type: 'thinking', text };
}

function createToolUseEvent(title: string, status: string): OpenCodeJsonEvent {
  // title에서 도구 이름을 추출 (첫 단어 또는 구분자 이전)
  const delimIdx = title.search(/[\s:(]/);
  const toolName = delimIdx > 0 ? title.slice(0, delimIdx).toLowerCase() : title.toLowerCase() || 'tool';

  return {
    type: 'tool_use',
    tool: { name: toolName },
    name: title,
    message: status,
  };
}

function createStepStartEvent(plan: string): OpenCodeJsonEvent {
  return { type: 'step_start', message: plan };
}

// ─── 핵심 API ───

/**
 * UnifiedAgentClient를 사용하여 OpenCode CLI와 채팅한다.
 * 기존 chatWithOpenCode()와 동일한 시그니처를 유지한다.
 */
export async function chatWithOpenCode(
  request: OpenCodeChatRequest,
  onChunk?: (chunk: OpenCodeChatChunk) => void,
): Promise<OpenCodeChatResult> {
  const client = new UnifiedAgentClient();
  activeClients.add(client);

  let accumulatedText = '';
  let capturedError: string | undefined;

  try {
    // ── thinking 이벤트 버퍼 ──
    // SDK의 thoughtChunk는 매우 잦은 빈도로 발생한다.
    // 이를 그대로 전달하면 ThinkingContainer에 수십 단계가 표시되므로,
    // 문장 단위로 버퍼링하여 의미 있는 크기의 이벤트만 방출한다.

    let thoughtBuffer = '';
    let thoughtFlushTimer: ReturnType<typeof setTimeout> | null = null;
    const THOUGHT_FLUSH_INTERVAL_MS = 800;
    const SENTENCE_END_RE = /[.。!?！？\n]\s*$/;

    const flushThought = () => {
      if (thoughtFlushTimer) {
        clearTimeout(thoughtFlushTimer);
        thoughtFlushTimer = null;
      }

      const trimmed = thoughtBuffer.trim();
      if (!trimmed) return;

      // 첫 줄만 summary로 사용 (detail에 전체 포함)
      onChunk?.({ event: createThinkingEvent(trimmed) });
      thoughtBuffer = '';
    };

    const scheduleThoughtFlush = () => {
      if (thoughtFlushTimer) clearTimeout(thoughtFlushTimer);
      thoughtFlushTimer = setTimeout(flushThought, THOUGHT_FLUSH_INTERVAL_MS);
    };

    client.on('messageChunk', (text: string) => {
      if (!text) return;
      accumulatedText += text;
      onChunk?.({ text });
    });

    client.on('thoughtChunk', (text: string) => {
      if (!text) return;
      thoughtBuffer += text;

      // 문장 끝이면 즉시 방출
      if (SENTENCE_END_RE.test(thoughtBuffer)) {
        flushThought();
      } else {
        scheduleThoughtFlush();
      }
    });

    client.on('toolCall', (title: string, status: string) => {
      // 도구 호출이 오면 pending thoughts를 먼저 방출
      flushThought();
      onChunk?.({ event: createToolUseEvent(title, status) });
    });

    client.on('plan', (plan: string) => {
      if (!plan) return;
      flushThought();
      onChunk?.({ event: createStepStartEvent(plan) });
    });

    client.on('error', (err: Error) => {
      if (!capturedError) {
        capturedError = err.message;
      }
      onChunk?.({ error: err.message });
    });

    // ── 연결 ──

    const cliPath = resolveCliPath();
    const connectResult = await client.connect({
      cli: 'opencode',
      cwd: runtimeProjectPath ?? process.cwd(),
      timeout: REQUEST_TIMEOUT_MS,
      autoApprove: true,
      model: request.model,
      env: buildSdkEnv(),
      clientInfo: CLIENT_INFO,
      ...(cliPath ? { cliPath } : {}),
    });
    
    // ── 에이전트(모드) 선택 ──
    // opencode 커스텀 에이전트는 ACP session/set_mode로 선택
    if (request.agent) {
      try {
        await client.setMode(request.agent);
      } catch (modeErr) {
        // eslint-disable-next-line no-console
        console.warn(`[ai-canvas] setMode("${request.agent}") 실패 (무시됨):`, modeErr);
      }
    }

    // SDK connect()가 setModel을 silent catch하므로, 명시적으로 한 번 더 시도
    if (request.model) {
      try {
        await client.setModel(request.model);
      } catch (modelErr) {
        // eslint-disable-next-line no-console
        console.warn(`[ai-canvas] setModel("${request.model}") 실패 (무시됨):`, modelErr);
      }
    }

    // ── 메시지 전송 ──

    await client.sendMessage(request.prompt);

    // 남은 thinking 버퍼 방출
    flushThought();

    // ── 결과 처리 ──

    if (capturedError) {
      return { success: false, error: capturedError };
    }

    if (!accumulatedText.trim()) {
      const errorMsg = 'OpenCode가 빈 응답을 반환했습니다';
      onChunk?.({ error: errorMsg });
      return { success: false, error: errorMsg };
    }

    onChunk?.({ done: true });
    return { success: true, text: accumulatedText };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (!capturedError) {
      capturedError = errorMsg;
    }
    onChunk?.({ error: capturedError });
    return { success: false, error: capturedError };

  } finally {
    // 항상 연결 정리
    await client.disconnect().catch(() => {});
    client.removeAllListeners();
    activeClients.delete(client);
  }
}

/**
 * opencode models --refresh --verbose 실행.
 * SDK에 모델 조회 API가 없으므로 기존 방식(execFile)을 유지한다.
 */
export async function fetchOpenCodeModelsVerbose(): Promise<string> {
  const cliPath = resolveCliPath() ?? 'opencode';
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...buildSdkEnv(),
  };

  // OPENCODE_CONFIG 환경변수는 제거 (CONFIG_CONTENT 우선)
  delete env.OPENCODE_CONFIG;

  const { stdout } = await execFileAsync(
    cliPath,
    ['models', '--refresh', '--verbose'],
    {
      cwd: runtimeProjectPath ?? process.cwd(),
      env,
      timeout: MODELS_CMD_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: MODELS_MAX_BUFFER,
    },
  );

  return stdout;
}

// ─── 런타임 설정 / 생명주기 ───

/** 런타임 프로젝트 경로 및 바이너리 모드를 설정한다. */
export function configureOpenCodeRuntime(
  projectPath: string | null,
  binaryMode: OpenCodeRuntimeBinaryMode = 'auto',
): void {
  runtimeProjectPath = projectPath;
  runtimeBinaryMode = binaryMode;
}

/** 현재 설정된 프로젝트 경로를 반환한다. */
export function getOpenCodeProjectPath(): string | null {
  return runtimeProjectPath;
}

/** 모든 활성 클라이언트를 종료한다. */
export function shutdownOpenCodeRuntime(): void {
  for (const client of activeClients) {
    void client.disconnect().catch(() => {});
  }
  activeClients.clear();
}
