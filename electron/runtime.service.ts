import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getBackendDirPath,
  getBackendLocalBinaryPath,
  type ServiceResult,
  ok,
  fail,
} from './utils';
import { configureOpenCodeRuntime } from './opencode-runtime/runtime';
import { buildRuntimeConfigJson } from './ai-prompts';

const execFileAsync = promisify(execFile);

type RuntimeMode = 'auto' | 'local' | 'global';
type ActiveRuntime = 'local' | 'global' | 'none';

interface RuntimeStateFile {
  mode?: RuntimeMode;
  onboardingDone?: boolean;
}

export interface RuntimeStatus {
  mode: RuntimeMode;
  activeRuntime: ActiveRuntime;
  localInstalled: boolean;
  globalInstalled: boolean;
  onboardingDone: boolean;
  localBinaryPath: string;
  configDir: string;
}

export interface RuntimeInstallProgress {
  projectPath: string;
  phase: 'downloading' | 'extracting' | 'finalizing' | 'done' | 'error';
  percent: number;
  receivedBytes?: number;
  totalBytes?: number;
}

type RuntimeInstallProgressCallback = (progress: RuntimeInstallProgress) => void;
type AuthTerminalClosedCallback = (result: { success: boolean; error?: string }) => void;

function getRuntimeStatePath(projectPath: string): string {
  return path.join(getBackendDirPath(projectPath), 'runtime-state.json');
}

function normalizeRuntimeMode(mode: RuntimeStateFile['mode']): RuntimeMode {
  if (mode === 'local' || mode === 'global' || mode === 'auto') {
    return mode;
  }
  return 'auto';
}

function normalizeOnboardingDone(onboardingDone: RuntimeStateFile['onboardingDone']): boolean {
  return onboardingDone === true;
}

async function readRuntimeState(projectPath: string): Promise<RuntimeStateFile> {
  const statePath = getRuntimeStatePath(projectPath);

  try {
    const raw = await fs.readFile(statePath, 'utf-8');
    return JSON.parse(raw) as RuntimeStateFile;
  } catch {
    return {};
  }
}

async function writeRuntimeState(projectPath: string, patch: RuntimeStateFile): Promise<RuntimeStateFile> {
  const backendDir = getBackendDirPath(projectPath);
  const statePath = getRuntimeStatePath(projectPath);
  const current = await readRuntimeState(projectPath);
  const next = { ...current, ...patch };

  await fs.mkdir(backendDir, { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(next), 'utf-8');

  return next;
}

async function readRuntimeMode(projectPath: string): Promise<RuntimeMode> {
  const state = await readRuntimeState(projectPath);
  return normalizeRuntimeMode(state.mode);
}

async function writeRuntimeMode(projectPath: string, mode: RuntimeMode): Promise<void> {
  await writeRuntimeState(projectPath, { mode });
}

async function ensureBackendScaffold(projectPath: string): Promise<void> {
  const backendDir = getBackendDirPath(projectPath);

  await fs.mkdir(backendDir, { recursive: true });
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

function pickActiveRuntime(mode: RuntimeMode, localInstalled: boolean, globalInstalled: boolean): ActiveRuntime {
  if (mode === 'local') {
    return localInstalled ? 'local' : 'none';
  }

  if (mode === 'global') {
    return globalInstalled ? 'global' : 'none';
  }

  if (localInstalled) return 'local';
  if (globalInstalled) return 'global';
  return 'none';
}

function applyBackendRuntimeContext(projectPath: string | null, activeRuntime: ActiveRuntime): void {
  if (!projectPath) {
    if (activeRuntime === 'global') {
      configureOpenCodeRuntime(null, 'global');
      return;
    }

    configureOpenCodeRuntime(null, 'auto');
    return;
  }

  if (activeRuntime === 'local') {
    configureOpenCodeRuntime(projectPath, 'local');
    return;
  }

  if (activeRuntime === 'global') {
    configureOpenCodeRuntime(projectPath, 'global');
    return;
  }

  configureOpenCodeRuntime(projectPath, 'auto');
}

async function readStatus(projectPath: string): Promise<RuntimeStatus> {
  const state = await readRuntimeState(projectPath);
  const mode = normalizeRuntimeMode(state.mode);
  const onboardingDone = normalizeOnboardingDone(state.onboardingDone);
  const localBinaryPath = getBackendLocalBinaryPath(projectPath);
  const configDir = getBackendDirPath(projectPath);
  const localInstalled = existsSync(localBinaryPath);
  const globalInstalled = await detectGlobalBinary();
  const activeRuntime = pickActiveRuntime(mode, localInstalled, globalInstalled);

  applyBackendRuntimeContext(projectPath, activeRuntime);

  return {
    mode,
    activeRuntime,
    localInstalled,
    globalInstalled,
    onboardingDone,
    localBinaryPath,
    configDir,
  };
}

async function readGlobalStatus(): Promise<RuntimeStatus> {
  const globalInstalled = await detectGlobalBinary();
  const activeRuntime: ActiveRuntime = globalInstalled ? 'global' : 'none';

  applyBackendRuntimeContext(null, activeRuntime);

  return {
    mode: 'global',
    activeRuntime,
    localInstalled: false,
    globalInstalled,
    onboardingDone: true,
    localBinaryPath: '',
    configDir: '',
  };
}

function resolveReleaseAssetName(): string {
  const archMap: Record<string, string> = {
    x64: 'x64',
    arm64: 'arm64',
  };
  const arch = archMap[process.arch] ?? process.arch;

  if (process.platform === 'win32') {
    return `windows-${arch}.zip`;
  }

  if (process.platform === 'darwin') {
    return arch === 'arm64' ? 'darwin-universal.tar.gz' : `darwin-${arch}.tar.gz`;
  }

  return `linux-${arch}.tar.gz`;
}

async function downloadLatestReleaseArchive(
  tempFilePath: string,
  onChunk?: (receivedBytes: number, totalBytes: number) => void
): Promise<void> {
  const releaseResponse = await fetch('https://api.github.com/repos/anomalyco/opencode/releases/latest', {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ai-canvas-runtime-installer',
    },
  });

  if (!releaseResponse.ok) {
    throw new Error(`릴리스 정보를 가져오지 못했습니다 (${releaseResponse.status})`);
  }

  const release = await releaseResponse.json() as {
    assets?: Array<{ name?: string; browser_download_url?: string }>;
  };

  const suffix = resolveReleaseAssetName();
  const asset = release.assets?.find((item) => typeof item.name === 'string' && item.name.includes(suffix));

  if (!asset?.browser_download_url) {
    throw new Error(`현재 플랫폼(${process.platform}/${process.arch})용 바이너리를 찾지 못했습니다`);
  }

  const binaryResponse = await fetch(asset.browser_download_url, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': 'ai-canvas-runtime-installer',
    },
  });

  if (!binaryResponse.ok) {
    throw new Error(`바이너리 다운로드 실패 (${binaryResponse.status})`);
  }

  const totalBytes = Number(binaryResponse.headers.get('content-length') ?? '0');
  const body = binaryResponse.body;
  if (!body) {
    const arrayBuffer = await binaryResponse.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));
    onChunk?.(1, 1);
    return;
  }

  const writer = await fs.open(tempFilePath, 'w');
  const reader = body.getReader();
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (!value || value.byteLength === 0) {
        continue;
      }

      await writer.write(value);
      receivedBytes += value.byteLength;
      onChunk?.(receivedBytes, totalBytes);
    }
  } finally {
    await writer.close();
  }
}

async function extractArchive(archivePath: string, targetDir: string): Promise<void> {
  if (archivePath.endsWith('.zip')) {
    if (process.platform === 'win32') {
      await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`],
        { windowsHide: true }
      );
      return;
    }

    await execFileAsync('unzip', ['-o', archivePath, '-d', targetDir]);
    return;
  }

  await execFileAsync('tar', ['-xzf', archivePath, '-C', targetDir]);
}

async function findBinaryRecursive(rootDir: string): Promise<string | null> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const binaryName = process.platform === 'win32' ? 'opencode.exe' : 'opencode';

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isFile() && entry.name === binaryName) {
      return fullPath;
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(rootDir, entry.name);
    const nested = await findBinaryRecursive(fullPath);
    if (nested) return nested;
  }

  return null;
}

export async function checkRuntimeStatus(projectPath: string | null): Promise<ServiceResult<RuntimeStatus>> {
  try {
    if (!projectPath) {
      return ok(await readGlobalStatus());
    }

    await ensureBackendScaffold(projectPath);
    return ok(await readStatus(projectPath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function setRuntimeMode(projectPath: string, mode: RuntimeMode): Promise<ServiceResult<RuntimeStatus>> {
  try {
    await ensureBackendScaffold(projectPath);
    await writeRuntimeMode(projectPath, mode);
    return ok(await readStatus(projectPath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function installLocalRuntime(
  projectPath: string,
  onProgress?: RuntimeInstallProgressCallback
): Promise<ServiceResult<RuntimeStatus>> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-canvas-opencode-'));
  const archivePath = path.join(tempDir, process.platform === 'win32' ? 'opencode.zip' : 'opencode.tar.gz');

  const emitProgress = (phase: RuntimeInstallProgress['phase'], percent: number, receivedBytes?: number, totalBytes?: number) => {
    if (!onProgress) {
      return;
    }

    onProgress({
      projectPath,
      phase,
      percent,
      ...(typeof receivedBytes === 'number' ? { receivedBytes } : {}),
      ...(typeof totalBytes === 'number' && totalBytes > 0 ? { totalBytes } : {}),
    });
  };

  try {
    await ensureBackendScaffold(projectPath);

    emitProgress('downloading', 0, 0);
    await downloadLatestReleaseArchive(archivePath, (receivedBytes, totalBytes) => {
      const percent = totalBytes > 0
        ? Math.max(1, Math.min(90, Math.floor((receivedBytes / totalBytes) * 90)))
        : Math.max(1, Math.min(90, Math.floor(receivedBytes / (1024 * 1024)) + 1));
      emitProgress('downloading', percent, receivedBytes, totalBytes);
    });

    emitProgress('extracting', 92);
    await extractArchive(archivePath, tempDir);

    const foundBinary = await findBinaryRecursive(tempDir);
    if (!foundBinary) {
      throw new Error('압축 파일에서 opencode 실행 파일을 찾지 못했습니다');
    }

    emitProgress('finalizing', 96);
    const targetBinaryPath = getBackendLocalBinaryPath(projectPath);
    await fs.copyFile(foundBinary, targetBinaryPath);

    if (process.platform !== 'win32') {
      await fs.chmod(targetBinaryPath, 0o755);
    }

    await writeRuntimeMode(projectPath, 'local');
    const status = await readStatus(projectPath);
    emitProgress('done', 100);
    return ok(status);
  } catch (error) {
    emitProgress('error', 0);
    return fail(error instanceof Error ? error.message : String(error));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function escapeShellSingleQuote(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

function resolveTerminalBinary(status: RuntimeStatus): string {
  if (status.activeRuntime === 'local') {
    return status.localBinaryPath;
  }

  return 'opencode';
}

function createTerminalLaunchEnv(status: RuntimeStatus, runtimeConfig: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OPENCODE_CONFIG_CONTENT: runtimeConfig,
  };

  if (status.activeRuntime === 'local') {
    env.OPENCODE_CONFIG_DIR = status.configDir;
  } else {
    delete env.OPENCODE_CONFIG_DIR;
  }

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

export async function openAuthTerminal(projectPath: string | null, onClosed?: AuthTerminalClosedCallback): Promise<ServiceResult> {
  try {
    if (projectPath) {
      await ensureBackendScaffold(projectPath);
    }

    const status = projectPath ? await readStatus(projectPath) : await readGlobalStatus();
    const configDir = status.configDir;
    const markerPath = createAuthCompletionMarkerPath();
    const markerPathPosix = markerPath.replace(/\\/g, '/');

    if (status.activeRuntime === 'none') {
      return fail('먼저 런타임 설치 또는 선택이 필요합니다');
    }

    if (process.platform === 'win32') {
      const command = status.activeRuntime === 'local'
        ? `$env:OPENCODE_CONFIG_DIR='${configDir.replace(/'/g, "''")}'; opencode auth login; New-Item -ItemType File -Path '${markerPath.replace(/'/g, "''")}' -Force | Out-Null`
        : `opencode auth login; New-Item -ItemType File -Path '${markerPath.replace(/'/g, "''")}' -Force | Out-Null`;
      spawn('cmd.exe', ['/c', 'start', '', 'powershell.exe', '-NoProfile', '-Command', command], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();

      watchAuthCompletion(markerPath, onClosed);
      return ok();
    }

    if (process.platform === 'darwin') {
      const script = `tell application \"Terminal\" to do script \"${status.activeRuntime === 'local' ? `export OPENCODE_CONFIG_DIR='${escapeShellSingleQuote(configDir)}'; ` : ''}opencode auth login; touch '${escapeShellSingleQuote(markerPathPosix)}'; exit\"`;
      await execFileAsync('osascript', ['-e', script]);

      watchAuthCompletion(markerPath, onClosed);
      return ok();
    }

    const command = `${status.activeRuntime === 'local' ? `export OPENCODE_CONFIG_DIR='${escapeShellSingleQuote(configDir)}'; ` : ''}opencode auth login; touch '${escapeShellSingleQuote(markerPathPosix)}'`;
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
        // try next terminal
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

    await ensureBackendScaffold(projectPath);

    const status = await readStatus(projectPath);
    if (status.activeRuntime === 'none') {
      return fail('먼저 런타임 설치 또는 선택이 필요합니다');
    }

    const binaryPath = resolveTerminalBinary(status);
    const runtimeConfig = buildRuntimeConfigJson();
    const terminalEnv = createTerminalLaunchEnv(status, runtimeConfig);

    if (process.platform === 'win32') {
      const projectPathEscaped = projectPath.replace(/'/g, "''");
      const binaryEscaped = binaryPath.replace(/'/g, "''");
      const command = [
        `Set-Location -LiteralPath '${projectPathEscaped}'`,
        `& '${binaryEscaped}'`,
      ].join('; ');

      spawn('cmd.exe', ['/c', 'start', '', 'powershell.exe', '-NoExit', '-NoProfile', '-Command', command], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: terminalEnv,
      }).unref();

      return ok();
    }

    const binaryCommand = `'${escapeShellSingleQuote(binaryPath)}'`;
    const shellCommand = [
      `cd '${escapeShellSingleQuote(projectPath.replace(/\\/g, '/'))}'`,
      `export OPENCODE_CONFIG_CONTENT='${escapeShellSingleQuote(runtimeConfig)}'`,
      status.activeRuntime === 'local'
        ? `export OPENCODE_CONFIG_DIR='${escapeShellSingleQuote(status.configDir.replace(/\\/g, '/'))}'`
        : 'unset OPENCODE_CONFIG_DIR',
      binaryCommand,
    ].join('; ');

    if (process.platform === 'darwin') {
      const script = `tell application \"Terminal\" to do script \"${shellCommand.replace(/"/g, '\\"')}\"`;
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
        // try next terminal
      }
    }

    return fail('시스템 터미널을 실행하지 못했습니다');
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function completeRuntimeOnboarding(projectPath: string): Promise<ServiceResult<RuntimeStatus>> {
  try {
    await ensureBackendScaffold(projectPath);
    await writeRuntimeState(projectPath, { onboardingDone: true });
    return ok(await readStatus(projectPath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export function clearRuntimeContext(): void {
  configureOpenCodeRuntime(null, 'auto');
}
