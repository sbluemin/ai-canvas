import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  type ServiceResult,
  ok,
  fail,
} from './utils';
import { configureOpenCodeRuntime } from './unified-agent-adapter';
import { buildRuntimeConfigJson } from './ai-prompts';
import { getGlobalCanvasRoot } from './canvas-path';

const execFileAsync = promisify(execFile);
const GLOBAL_RUNTIME_DIR = getGlobalCanvasRoot();
const RUNTIME_STATE_PATH = path.join(GLOBAL_RUNTIME_DIR, 'runtime-state.json');

type ActiveRuntime = 'global' | 'none';

interface RuntimeStateFile {
  onboardingDone?: boolean;
}

export interface RuntimeStatus {
  activeRuntime: ActiveRuntime;
  globalInstalled: boolean;
  onboardingDone: boolean;
}

type AuthTerminalClosedCallback = (result: { success: boolean; error?: string }) => void;

function normalizeOnboardingDone(onboardingDone: RuntimeStateFile['onboardingDone']): boolean {
  return onboardingDone === true;
}

async function ensureRuntimeStateDir(): Promise<void> {
  await fs.mkdir(GLOBAL_RUNTIME_DIR, { recursive: true });
}

async function readRuntimeState(): Promise<RuntimeStateFile> {
  try {
    const raw = await fs.readFile(RUNTIME_STATE_PATH, 'utf-8');
    return JSON.parse(raw) as RuntimeStateFile;
  } catch {
    return {};
  }
}

async function writeRuntimeState(patch: RuntimeStateFile): Promise<RuntimeStateFile> {
  const current = await readRuntimeState();
  const next = { ...current, ...patch };
  await ensureRuntimeStateDir();
  await fs.writeFile(RUNTIME_STATE_PATH, JSON.stringify(next), 'utf-8');
  return next;
}

async function detectGlobalBinary(): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('where.exe', ['opencode'], { windowsHide: true, timeout: 5000 });
      return stdout.trim().length > 0;
    }

    const { stdout } = await execFileAsync('which', ['opencode'], { timeout: 5000 });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

function applyRuntimeContext(projectPath: string | null, activeRuntime: ActiveRuntime): void {
  if (activeRuntime === 'none') {
    configureOpenCodeRuntime(null);
    return;
  }

  configureOpenCodeRuntime(projectPath);
}

async function readStatus(projectPath: string | null): Promise<RuntimeStatus> {
  const state = await readRuntimeState();
  const onboardingDone = normalizeOnboardingDone(state.onboardingDone);
  const globalInstalled = await detectGlobalBinary();
  const activeRuntime: ActiveRuntime = globalInstalled ? 'global' : 'none';

  applyRuntimeContext(projectPath, activeRuntime);

  return {
    activeRuntime,
    globalInstalled,
    onboardingDone,
  };
}

function escapeShellSingleQuote(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

function createTerminalLaunchEnv(runtimeConfig: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OPENCODE_CONFIG_CONTENT: runtimeConfig,
  };

  delete env.OPENCODE_CONFIG;
  return env;
}

function createAuthCompletionMarkerPath(): string {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  return path.join(os.tmpdir(), `ai-canvas-auth-${id}.done`);
}

function watchAuthCompletion(markerPath: string, onClosed?: AuthTerminalClosedCallback): void {
  if (!onClosed) {
    return;
  }

  let completed = false;

  const finalize = (result: { success: boolean; error?: string }) => {
    if (completed) return;
    completed = true;
    onClosed(result);
  };

  const interval = setInterval(() => {
    if (!existsSync(markerPath)) {
      return;
    }

    clearInterval(interval);
    clearTimeout(timeout);
    void fs.rm(markerPath, { force: true });
    finalize({ success: true });
  }, 800);

  const timeout = setTimeout(() => {
    clearInterval(interval);
    finalize({ success: false, error: '로그인 터미널 종료를 확인하지 못했습니다' });
  }, 30 * 60 * 1000);
}

export async function checkRuntimeStatus(projectPath: string | null): Promise<ServiceResult<RuntimeStatus>> {
  try {
    return ok(await readStatus(projectPath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function openAuthTerminal(projectPath: string | null, onClosed?: AuthTerminalClosedCallback): Promise<ServiceResult> {
  try {
    const status = await readStatus(projectPath);
    const markerPath = createAuthCompletionMarkerPath();
    const markerPathPosix = markerPath.replace(/\\/g, '/');

    if (status.activeRuntime === 'none') {
      return fail('먼저 OpenCode를 글로벌로 설치해주세요');
    }

    if (process.platform === 'win32') {
      const command = `opencode auth login; New-Item -ItemType File -Path '${markerPath.replace(/'/g, "''")}' -Force | Out-Null`;
      spawn('cmd.exe', ['/c', 'start', '', 'powershell.exe', '-NoProfile', '-Command', command], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();

      watchAuthCompletion(markerPath, onClosed);
      return ok();
    }

    if (process.platform === 'darwin') {
      const script = `tell application "Terminal" to do script "opencode auth login; touch '${escapeShellSingleQuote(markerPathPosix)}'; exit"`;
      await execFileAsync('osascript', ['-e', script]);

      watchAuthCompletion(markerPath, onClosed);
      return ok();
    }

    const command = `opencode auth login; touch '${escapeShellSingleQuote(markerPathPosix)}'`;
    const terminalCandidates = [
      ['x-terminal-emulator', ['-e', 'bash', '-lc', command]],
      ['gnome-terminal', ['--', 'bash', '-lc', command]],
      ['konsole', ['-e', 'bash', '-lc', command]],
      ['xterm', ['-e', 'bash', '-lc', command]],
    ] as const;

    for (const [binary, args] of terminalCandidates) {
      try {
        spawn(binary, args, { detached: true, stdio: 'ignore' }).unref();
        watchAuthCompletion(markerPath, onClosed);
        return ok();
      } catch {
      }
    }

    return fail('시스템 터미널을 실행하지 못했습니다');
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function openRuntimeTerminal(projectPath: string | null): Promise<ServiceResult> {
  try {
    if (!projectPath) {
      return fail('프로젝트가 열려 있지 않습니다');
    }

    const status = await readStatus(projectPath);
    if (status.activeRuntime === 'none') {
      return fail('먼저 OpenCode를 글로벌로 설치해주세요');
    }

    const runtimeConfig = buildRuntimeConfigJson();
    const terminalEnv = createTerminalLaunchEnv(runtimeConfig);

    if (process.platform === 'win32') {
      const projectPathEscaped = projectPath.replace(/'/g, "''");
      const command = [
        `Set-Location -LiteralPath '${projectPathEscaped}'`,
        'opencode',
      ].join('; ');

      spawn('cmd.exe', ['/c', 'start', '', 'powershell.exe', '-NoExit', '-NoProfile', '-Command', command], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: terminalEnv,
      }).unref();

      return ok();
    }

    const shellCommand = [
      `cd '${escapeShellSingleQuote(projectPath.replace(/\\/g, '/'))}'`,
      `export OPENCODE_CONFIG_CONTENT='${escapeShellSingleQuote(runtimeConfig)}'`,
      'opencode',
    ].join('; ');

    if (process.platform === 'darwin') {
      const script = `tell application "Terminal" to do script "${shellCommand.replace(/"/g, '\\"')}"`;
      await execFileAsync('osascript', ['-e', script]);
      return ok();
    }

    const terminalCandidates = [
      ['x-terminal-emulator', ['-e', 'bash', '-lc', shellCommand]],
      ['gnome-terminal', ['--', 'bash', '-lc', shellCommand]],
      ['konsole', ['-e', 'bash', '-lc', shellCommand]],
      ['xterm', ['-e', 'bash', '-lc', shellCommand]],
    ] as const;

    for (const [binary, args] of terminalCandidates) {
      try {
        spawn(binary, args, { detached: true, stdio: 'ignore' }).unref();
        return ok();
      } catch {
      }
    }

    return fail('시스템 터미널을 실행하지 못했습니다');
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function completeRuntimeOnboarding(projectPath: string | null): Promise<ServiceResult<RuntimeStatus>> {
  try {
    await writeRuntimeState({ onboardingDone: true });
    return ok(await readStatus(projectPath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export function clearRuntimeContext(): void {
  configureOpenCodeRuntime(null);
}
