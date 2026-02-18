/**
 * OpenCode 바이너리 경로 탐색 모듈
 *
 * Windows에서 opencode Go 바이너리(opencode.exe)의 경로를 직접 찾는다.
 * cmd.exe를 경유하는 .cmd 래퍼를 사용하면 커맨드라인 인자의 <, >, | 등
 * 특수문자가 리다이렉트로 해석되어 프롬프트가 손상된다.
 * 바이너리를 직접 실행하면 cmd.exe를 거치지 않으므로 이 문제를 우회할 수 있다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getBackendLocalBinaryPath } from '../../core';

/** 캐시된 바이너리 경로 */
let resolvedBinaryPath: string | null | undefined;

type RuntimeBinaryMode = 'auto' | 'local' | 'global';

let runtimeProjectPath: string | null = null;
let runtimeBinaryMode: RuntimeBinaryMode = 'auto';

export function configureBinaryResolverContext(projectPath: string | null, mode: RuntimeBinaryMode = 'auto'): void {
  runtimeProjectPath = projectPath;
  runtimeBinaryMode = mode;
  resetBinaryCache();
}

/**
 * opencode 바이너리 경로를 탐색한다.
 * 탐색 결과는 캐시되어 이후 호출 시 재사용된다.
 *
 * 탐색 우선순위:
 * 0. OPENCODE_BIN_PATH 환경변수
 * 1. 프로젝트 로컬(.ai-canvas/.runtime/opencode[.exe]) 바이너리
 * 2. where.exe로 PATH에서 .exe 직접 탐색 (Windows)
 * 3. npm 글로벌 설치 경로에서 Go 바이너리 역추적 (Windows)
 */
export function resolveOpencodeBinary(): string | null {
  if (resolvedBinaryPath !== undefined) {
    return resolvedBinaryPath;
  }

  // 0순위: 환경변수 OPENCODE_BIN_PATH가 설정되어 있으면 사용
  if (process.env.OPENCODE_BIN_PATH && existsSync(process.env.OPENCODE_BIN_PATH)) {
    resolvedBinaryPath = process.env.OPENCODE_BIN_PATH;
    console.log('[OpenCode] OPENCODE_BIN_PATH 환경변수 사용:', resolvedBinaryPath);
    return resolvedBinaryPath;
  }

  // 1순위: 프로젝트 로컬 바이너리
  if (runtimeBinaryMode !== 'global' && runtimeProjectPath) {
    const localBinaryPath = getBackendLocalBinaryPath(runtimeProjectPath);
    if (existsSync(localBinaryPath)) {
      resolvedBinaryPath = localBinaryPath;
      console.log('[OpenCode] 프로젝트 로컬 바이너리 사용:', resolvedBinaryPath);
      return resolvedBinaryPath;
    }

    if (runtimeBinaryMode === 'local') {
      resolvedBinaryPath = null;
      return null;
    }
  }

  if (process.platform !== 'win32') {
    resolvedBinaryPath = null;
    return null;
  }

  // 2순위: where.exe로 PATH에서 opencode.exe를 직접 탐색
  const exeFromWhere = findExeViaWhere();
  if (exeFromWhere) {
    resolvedBinaryPath = exeFromWhere;
    console.log('[OpenCode] where.exe로 바이너리 발견:', resolvedBinaryPath);
    return resolvedBinaryPath;
  }

  // 3순위: npm 글로벌 설치 경로에서 Go 바이너리를 직접 탐색
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
 * 캐시를 초기화한다. (테스트용)
 */
export function resetBinaryCache(): void {
  resolvedBinaryPath = undefined;
}

// ─── 내부 헬퍼 함수들 ───

/**
 * where.exe를 사용하여 PATH에 등록된 opencode 관련 실행 파일을 탐색한다.
 */
function findExeViaWhere(): string | null {
  try {
    const whereOutput = execFileSync('where.exe', ['opencode'], {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 5000,
    }).toString().trim();

    const paths = whereOutput.split(/\r?\n/).map((p: string) => p.trim()).filter(Boolean);

    // .exe 파일이 PATH에 직접 등록된 경우
    const directExe = paths.find((p: string) => p.toLowerCase().endsWith('.exe'));
    if (directExe && existsSync(directExe)) {
      return directExe;
    }

    // .cmd 파일만 있는 경우 (npm 설치), .cmd에서 바이너리를 역추적
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
 */
function resolveExeFromCmdWrapper(cmdPath: string): string | null {
  try {
    const content = readFileSync(cmdPath, 'utf-8');

    const match = content.match(/"([^"]*node_modules[^"]*opencode[^"]*)"\s+%\*/i);
    if (!match) return null;

    const cmdDir = dirname(cmdPath);
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
