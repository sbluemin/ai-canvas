import { spawn, execFileSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface OpenCodeChatRequest {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  variant?: string;
}

export interface OpenCodeChatChunk {
  text?: string;
  error?: string;
  done?: boolean;
}

export interface OpenCodeChatResult {
  success: boolean;
  text?: string;
  error?: string;
}

function composePrompt(prompt: string, systemInstruction?: string): string {
  if (!systemInstruction) {
    return prompt;
  }
  return `${systemInstruction}\n\n${prompt}`;
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

interface OpenCodeJsonEvent {
  type?: string;
  text?: string;
  part?: {
    text?: string;
  };
  error?: string;
}

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
  // 디버거 관련 환경변수를 모두 제거
  for (const key of Object.keys(env)) {
    if (DEBUGGER_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      delete env[key];
    }
  }
  return env;
}

/**
 * stderr 출력에서 디버거 관련 노이즈 메시지를 제거한다.
 * 실제 에러 메시지만 남기기 위해 사용.
 */
const NOISE_PATTERNS = [
  // Node.js 디버거 관련 메시지
  /^Debugger attached\.?\s*$/,
  /^Waiting for the debugger to disconnect\.?\s*$/,
  /^Debugger listening on ws:\/\//,
  /^For help, see: https:\/\/nodejs\.org\/en\/docs\/inspector/,
  // OpenCode CLI 상태 출력 (스피너, 빌드 상태 등)
  /^>\s+\S+/,            // "> build · gpt-5.3-codex" 같은 상태 라인
  /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏●○◉◎]/,  // 스피너 문자
];

/** ANSI 이스케이프 코드를 제거 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

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

/**
 * Windows에서 opencode Go 바이너리(opencode.exe)의 경로를 직접 찾는다.
 * cmd.exe를 경유하는 .cmd 래퍼를 사용하면 커맨드라인 인자의 <, >, | 등
 * 특수문자가 리다이렉트로 해석되어 프롬프트가 손상된다.
 * 바이너리를 직접 실행하면 cmd.exe를 거치지 않으므로 이 문제를 우회할 수 있다.
 *
 * 다양한 설치 방법을 지원한다:
 * - scoop / choco / winget / 직접 설치 → PATH에 .exe가 직접 등록됨
 * - npm 글로벌 설치 → .cmd 래퍼를 통해 Node.js 스크립트 → Go 바이너리 호출 구조
 */
let resolvedBinaryPath: string | null | undefined;

function resolveOpencodeBinary(): string | null {
  // 이미 탐색한 결과를 캐시
  if (resolvedBinaryPath !== undefined) {
    return resolvedBinaryPath;
  }

  // 0순위: 환경변수 OPENCODE_BIN_PATH가 설정되어 있으면 사용
  if (process.env.OPENCODE_BIN_PATH && existsSync(process.env.OPENCODE_BIN_PATH)) {
    resolvedBinaryPath = process.env.OPENCODE_BIN_PATH;
    console.log('[OpenCode] OPENCODE_BIN_PATH 환경변수 사용:', resolvedBinaryPath);
    return resolvedBinaryPath;
  }

  // 1순위: where.exe로 PATH에서 opencode.exe를 직접 탐색
  //        (scoop, choco, winget, 직접 설치 등 PATH에 .exe가 등록된 경우)
  const exeFromWhere = findExeViaWhere();
  if (exeFromWhere) {
    resolvedBinaryPath = exeFromWhere;
    console.log('[OpenCode] where.exe로 바이너리 발견:', resolvedBinaryPath);
    return resolvedBinaryPath;
  }

  // 2순위: npm 글로벌 설치 경로에서 Go 바이너리를 직접 탐색
  const exeFromNpm = findExeViaNpmGlobal();
  if (exeFromNpm) {
    resolvedBinaryPath = exeFromNpm;
    console.log('[OpenCode] npm 글로벌 경로에서 바이너리 발견:', resolvedBinaryPath);
    return resolvedBinaryPath;
  }

  console.warn('[OpenCode] opencode.exe 바이너리를 찾지 못함, spawn 폴백 사용');
  resolvedBinaryPath = null;
  return null;
}

/**
 * where.exe를 사용하여 PATH에 등록된 opencode 관련 실행 파일을 탐색한다.
 * .exe 파일이 있으면 바로 반환하고, .cmd만 있으면 해당 .cmd에서 바이너리를 역추적한다.
 */
function findExeViaWhere(): string | null {
  try {
    const whereOutput = execFileSync('where.exe', ['opencode'], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 5000,
    }).toString().trim();

    const paths = whereOutput.split(/\r?\n/).map((p: string) => p.trim()).filter(Boolean);

    // .exe 파일이 PATH에 직접 등록된 경우 (scoop, choco, winget, 직접 설치)
    const directExe = paths.find((p: string) => p.toLowerCase().endsWith('.exe'));
    if (directExe && existsSync(directExe)) {
      return directExe;
    }

    // .cmd 파일만 있는 경우 (npm 설치), .cmd 내용에서 Node.js 래퍼 경로를 추출하여
    // Go 바이너리 위치를 역추적
    const cmdPath = paths.find((p: string) => p.toLowerCase().endsWith('.cmd'));
    if (cmdPath) {
      const exeFromCmd = resolveExeFromCmdWrapper(cmdPath);
      if (exeFromCmd) return exeFromCmd;
    }
  } catch {
    // where.exe 실패 (opencode가 PATH에 없는 경우)
  }
  return null;
}

/**
 * npm이 생성한 .cmd 래퍼 파일의 내용을 분석하여 Go 바이너리 경로를 역추적한다.
 * .cmd 형식 예시: "%_prog%" "%dp0%\node_modules\opencode-ai\bin\opencode" %*
 */
function resolveExeFromCmdWrapper(cmdPath: string): string | null {
  try {
    const content = readFileSync(cmdPath, 'utf-8');

    // .cmd에서 Node.js 래퍼 스크립트 경로를 추출
    const match = content.match(/"([^"]*node_modules[^"]*opencode[^"]*)"\s+%\*/i);
    if (!match) return null;

    const cmdDir = dirname(cmdPath);
    // %dp0% 또는 %~dp0를 .cmd 파일의 디렉터리로 치환
    const scriptRelPath = match[1].replace(/%~?dp0%?/gi, '');
    const scriptPath = join(cmdDir, scriptRelPath);

    if (!existsSync(scriptPath)) return null;

    const scriptDir = dirname(realpathSync(scriptPath));
    return findBinaryNearScript(scriptDir);
  } catch {
    return null;
  }
}

/**
 * opencode Node.js 래퍼 스크립트 근처에서 플랫폼에 맞는 Go 바이너리를 찾는다.
 */
function findBinaryNearScript(scriptDir: string): string | null {
  const archMap: Record<string, string> = { x64: 'x64', arm64: 'arm64', arm: 'arm' };
  const arch = archMap[process.arch] ?? process.arch;
  const pkgName = `opencode-windows-${arch}`;

  const candidates = [
    join(scriptDir, '..', 'node_modules', pkgName, 'bin', 'opencode.exe'),
    join(scriptDir, '..', '..', 'node_modules', pkgName, 'bin', 'opencode.exe'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * npm 글로벌 설치 경로에서 직접 Go 바이너리를 탐색하는 폴백.
 * where.exe 탐색이 실패했을 때 사용된다.
 */
function findExeViaNpmGlobal(): string | null {
  try {
    const npmPrefix = process.env.APPDATA
      ? join(process.env.APPDATA, 'npm')
      : null;
    if (!npmPrefix) return null;

    const wrapperScript = join(npmPrefix, 'node_modules', 'opencode-ai', 'bin', 'opencode');
    if (!existsSync(wrapperScript)) return null;

    const scriptDir = dirname(realpathSync(wrapperScript));
    return findBinaryNearScript(scriptDir);
  } catch {
    return null;
  }
}

export class OpenCodeRuntime {
  private readonly activeChildren = new Set<ChildProcess>();

  private createChild(args: string[]): ChildProcess {
    const env = createRuntimeEnv();
    let child: ChildProcess;

    if (process.platform === 'win32') {
      // Windows: cmd.exe 특수문자 이스케이프 문제를 우회하기 위해
      // Go 바이너리를 직접 실행 (cmd.exe를 거치지 않음)
      const binaryPath = resolveOpencodeBinary();
      if (binaryPath) {
        child = spawn(binaryPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
          windowsHide: true,
        });
      } else {
        // 바이너리를 찾지 못한 경우, 'opencode' 직접 실행 (PATH에 등록되어 있어야 함)
        console.warn('[OpenCode] 바이너리를 찾지 못함, opencode 직접 spawn 시도');
        child = spawn('opencode', args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
          windowsHide: true,
          shell: false,
        });
      }
    } else {
      // macOS/Linux: PATH에 등록된 opencode를 직접 실행
      child = spawn('opencode', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
        windowsHide: true,
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

  async chat(request: OpenCodeChatRequest, onChunk?: (chunk: OpenCodeChatChunk) => void): Promise<OpenCodeChatResult> {
    return new Promise((resolve) => {
      const args = ['run', composePrompt(request.prompt, request.systemInstruction), '--format', 'json'];
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
          // Ignore non-JSON lines.
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

  async runModelsVerbose(): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.createChild(['models', '--verbose']);
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

  shutdown(): void {
    for (const child of this.activeChildren) {
      if (child.killed) {
        continue;
      }
      child.kill();
    }
    this.activeChildren.clear();
  }
}
