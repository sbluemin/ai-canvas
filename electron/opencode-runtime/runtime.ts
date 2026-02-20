/**
 * OpenCode 프로세스 런타임 매니저
 *
 * opencode CLI를 child_process로 spawn하고, stdout/stderr 스트리밍을 관리한다.
 * 이 모듈은 프로세스 생명주기만 담당하며, 외부에서는 client.ts를 통해 접근한다.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { resolveOpencodeBinary } from './binary-resolver';
import { configureBinaryResolverContext } from './binary-resolver';
import type { OpenCodeChatRequest, OpenCodeChatChunk, OpenCodeChatResult, OpenCodeJsonEvent, OpenCodeRuntimeBinaryMode } from '../ai-types';
import { getBackendDirPath } from '../utils';
import { buildRuntimeConfigJson } from '../ai-prompts';

let runtimeProjectPath: string | null = null;
let runtimeBinaryMode: OpenCodeRuntimeBinaryMode = 'auto';

export function configureRuntimeProjectPath(projectPath: string | null, binaryMode: OpenCodeRuntimeBinaryMode = 'auto'): void {
  runtimeProjectPath = projectPath;
  runtimeBinaryMode = binaryMode;
}

export function getRuntimeProjectPath(): string | null {
  return runtimeProjectPath;
}

// ─── 환경 설정 유틸 ───

/**
 * 디버거 / VS Code 관련 환경변수 접두사 목록.
 * child process에 전달되면 디버거가 자동 attach 되어 정상 동작을 방해한다.
 */
const DEBUGGER_ENV_PREFIXES = [
  'NODE_OPTIONS',
  'NODE_INSPECT_RESUME_ON_START',
  'NODE_DEBUG_OPTION',
  'VSCODE_INSPECTOR_OPTIONS',
  'VSCODE_PID',
  'VSCODE_CWD',
  'VSCODE_NLS_CONFIG',
  'VSCODE_IPC_HOOK',
  'VSCODE_AMD_ENTRYPOINT',
  'VSCODE_HANDLES_UNCAUGHT_ERRORS',
  'VSCODE_LOG_LEVEL',
  'ELECTRON_RUN_AS_NODE',
  'DEBUGGER_PPID',
];

function createRuntimeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (DEBUGGER_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      delete env[key];
    }
  }

  if (runtimeProjectPath) {
    env.OPENCODE_CONFIG_DIR = getBackendDirPath(runtimeProjectPath);
  } else {
    delete env.OPENCODE_CONFIG_DIR;
  }

  env.OPENCODE_CONFIG_CONTENT = buildRuntimeConfigJson();

  delete env.OPENCODE_CONFIG;

  return env;
}

// ─── stderr 필터링 유틸 ───

/** ANSI 이스케이프 코드를 제거 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(new RegExp('\\u001b\\[[0-9;]*[a-zA-Z]', 'g'), '');
}

const NOISE_PATTERNS = [
  /^Debugger attached\.?\s*$/,
  /^Waiting for the debugger to disconnect\.?\s*$/,
  /^Debugger listening on ws:\/\//,
  /^For help, see: https:\/\/nodejs\.org\/en\/docs\/inspector/,
  /^>\s+\S+/,
  /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏●○◉◎]/,
];

function stripDebuggerNoise(stderrText: string): string {
  const cleaned = stripAnsi(stderrText);
  return cleaned
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      return !NOISE_PATTERNS.some((pattern) => pattern.test(trimmed));
    })
    .join('\n')
    .trim();
}

function decodeErrorBuffer(buffer: Buffer): string {
  const utf8Text = buffer.toString('utf-8');
  if (process.platform !== 'win32' || !utf8Text.includes('\uFFFD')) {
    return utf8Text;
  }

  try {
    return new TextDecoder('euc-kr').decode(buffer);
  } catch {
    return utf8Text;
  }
}

// ─── 프롬프트 유틸 ───

function composePrompt(prompt: string, systemInstruction?: string): string {
  if (!systemInstruction) {
    return prompt;
  }
  return `${systemInstruction}\n\n${prompt}`;
}

// ─── 런타임 클래스 ───

export class OpenCodeRuntime {
  private readonly activeChildren = new Set<ChildProcess>();

  /** opencode CLI 자식 프로세스를 생성한다. */
  createChild(args: string[]): ChildProcess {
    const env = createRuntimeEnv();
    const binaryPath = resolveOpencodeBinary();
    let child: ChildProcess;

    const cwd = runtimeProjectPath ?? undefined;

    if (binaryPath) {
      child = spawn(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
        cwd,
        windowsHide: true,
      });
    } else {
      if (process.platform === 'win32') {
        console.warn('[OpenCode] 바이너리를 찾지 못함, opencode 직접 spawn 시도');
      }

      child = spawn('opencode', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
        cwd,
        windowsHide: true,
        shell: false,
      });
    }

    this.activeChildren.add(child);
    const cleanup = () => {
      this.activeChildren.delete(child);
    };
    child.once('close', cleanup);
    child.once('error', cleanup);
    return child;
  }

  /** chat 명령을 실행하고 스트리밍 결과를 반환한다. */
  async chat(request: OpenCodeChatRequest, onChunk?: (chunk: OpenCodeChatChunk) => void): Promise<OpenCodeChatResult> {
    return new Promise((resolve) => {
      const agentName = request.agent ?? 'plan';
      const args = ['run', composePrompt(request.prompt, request.systemInstruction), '--format', 'json', '--agent', agentName];
      if (request.model) {
        args.push('--model', request.model);
      }
      if (request.variant) {
        args.push('--variant', request.variant);
      }

      const child = this.createChild(args);
      const stdout = child.stdout;
      const stderr = child.stderr;

      if (!stdout || !stderr) {
        resolve({ success: false, error: 'OpenCode process stdio is unavailable' });
        return;
      }

      let stdoutBuffer = '';
      let accumulatedText = '';
      let capturedError = '';
      const stderrChunks: Buffer[] = [];
      let completed = false;

      const finalize = (result: OpenCodeChatResult) => {
        if (completed) return;
        completed = true;
        resolve(result);
      };

      const flushLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const payload = JSON.parse(trimmed) as OpenCodeJsonEvent;
          const chunkText = payload.part?.text ?? payload.text;
          if (typeof chunkText === 'string' && chunkText.length > 0) {
            accumulatedText += chunkText;
            onChunk?.({ text: chunkText });
            return;
          }

          if (payload.type === 'error' && payload.error) {
            capturedError = payload.error;
          }
        } catch {
          // Non-JSON 라인 무시
        }
      };

      stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString('utf-8');
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';
        for (const line of lines) {
          flushLine(line);
        }
      });

      stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.on('error', (error) => {
        const errorMessage = `OpenCode process failed: ${error.message}`;
        onChunk?.({ error: errorMessage });
        finalize({ success: false, error: errorMessage });
      });

      child.on('close', (code) => {
        if (stdoutBuffer.trim()) {
          flushLine(stdoutBuffer);
        }

        if (code !== 0) {
          const rawStderr = decodeErrorBuffer(Buffer.concat(stderrChunks)).trim();
          const stderrMessage = stripDebuggerNoise(rawStderr);
          const errorMessage = (capturedError || stderrMessage || `OpenCode exited with code ${code}`).trim();
          onChunk?.({ error: errorMessage });
          finalize({ success: false, error: errorMessage });
          return;
        }

        if (!accumulatedText.trim()) {
          const rawStderr = decodeErrorBuffer(Buffer.concat(stderrChunks)).trim();
          const stderrMessage = stripDebuggerNoise(rawStderr);
          const errorMessage = (capturedError || stderrMessage || 'OpenCode returned empty response').trim();
          onChunk?.({ error: errorMessage });
          finalize({ success: false, error: errorMessage });
          return;
        }

        onChunk?.({ done: true });
        finalize({ success: true, text: accumulatedText });
      });
    });
  }

  /** `opencode models --refresh --verbose` 명령을 실행해 캐시를 갱신한 뒤 전체 모델 목록을 반환한다. */
  async runModelsVerbose(): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.createChild(['models', '--refresh', '--verbose']);
      const stdout = child.stdout;
      const stderr = child.stderr;

      if (!stdout || !stderr) {
        reject(new Error('OpenCode process stdio is unavailable'));
        return;
      }

      let stdoutText = '';
      const stderrChunks: Buffer[] = [];

      stdout.on('data', (chunk: Buffer) => {
        stdoutText += chunk.toString('utf-8');
      });

      stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.on('error', (error) => {
        reject(new Error(`OpenCode process failed: ${error.message}`));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          const rawStderr = decodeErrorBuffer(Buffer.concat(stderrChunks)).trim();
          const stderrText = stripDebuggerNoise(rawStderr);
          reject(new Error(stderrText || `OpenCode exited with code ${code}`));
          return;
        }

        resolve(stdoutText);
      });
    });
  }

  /** 모든 활성 자식 프로세스를 종료한다. */
  shutdown(): void {
    for (const child of this.activeChildren) {
      if (child.killed) continue;
      child.kill();
    }
    this.activeChildren.clear();
  }
}

const runtime = new OpenCodeRuntime();

export async function chatWithOpenCode(
  request: OpenCodeChatRequest,
  onChunk?: (chunk: OpenCodeChatChunk) => void
): Promise<OpenCodeChatResult> {
  return runtime.chat(request, onChunk);
}

export async function fetchOpenCodeModelsVerbose(): Promise<string> {
  return runtime.runModelsVerbose();
}

export function shutdownOpenCodeRuntime(): void {
  runtime.shutdown();
}

export function configureOpenCodeRuntime(projectPath: string | null, binaryMode: OpenCodeRuntimeBinaryMode = 'auto'): void {
  configureRuntimeProjectPath(projectPath, binaryMode);
  configureBinaryResolverContext(projectPath, binaryMode);
}

export function getOpenCodeProjectPath(): string | null {
  return getRuntimeProjectPath();
}
