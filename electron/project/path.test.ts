import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const fs = requireFromTest('node:fs/promises') as typeof import('node:fs/promises');
const os = requireFromTest('node:os') as typeof import('node:os');
const path = requireFromTest('node:path') as typeof import('node:path');

const DEFAULT_GLOBAL_ROOT = path.join(os.homedir(), '.ai-canvas');
const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createdDirs = new Set<string>();
const originalDataDirEnv = process.env.AI_CANVAS_DATA_DIR;

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  createdDirs.add(dir);
  return dir;
}

async function loadCanvasPathModule() {
  vi.resetModules();
  return import('./path');
}

afterEach(async () => {
  if (originalDataDirEnv === undefined) {
    delete process.env.AI_CANVAS_DATA_DIR;
  } else {
    process.env.AI_CANVAS_DATA_DIR = originalDataDirEnv;
  }

  for (const dir of createdDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  createdDirs.clear();
});

describe('canvas-path', () => {
  it('기본 글로벌 루트는 홈 디렉토리 하위 .ai-canvas를 사용한다', async () => {
    delete process.env.AI_CANVAS_DATA_DIR;
    const { getGlobalCanvasRoot } = await loadCanvasPathModule();
    expect(getGlobalCanvasRoot()).toBe(DEFAULT_GLOBAL_ROOT);
  });

  it('환경 변수에 절대 경로가 설정되면 해당 경로를 글로벌 루트로 사용한다', async () => {
    const overrideRoot = await makeTempDir('ai-canvas-data-root-');
    process.env.AI_CANVAS_DATA_DIR = overrideRoot;

    const { getGlobalCanvasRoot } = await loadCanvasPathModule();
    expect(getGlobalCanvasRoot()).toBe(path.resolve(overrideRoot));
  });

  it('환경 변수에 상대 경로가 설정되면 무시하고 기본 글로벌 루트를 사용한다', async () => {
    process.env.AI_CANVAS_DATA_DIR = './relative-data-root';

    const { getGlobalCanvasRoot } = await loadCanvasPathModule();
    expect(getGlobalCanvasRoot()).toBe(DEFAULT_GLOBAL_ROOT);
  });

  it('신규 프로젝트 경로는 GUID를 발급하고 registry에 저장한다', async () => {
    const dataRoot = await makeTempDir('ai-canvas-global-root-');
    const projectPath = await makeTempDir('ai-canvas-project-');
    process.env.AI_CANVAS_DATA_DIR = dataRoot;

    const { resolveProjectId, getRegistryPath } = await loadCanvasPathModule();
    const projectId = await resolveProjectId(projectPath);

    expect(projectId).toMatch(PROJECT_ID_PATTERN);

    const registryPath = getRegistryPath();
    const rawRegistry = await fs.readFile(registryPath, 'utf-8');
    const registry = JSON.parse(rawRegistry) as Record<string, { canonicalPath: string; lastOpenedAt: string }>;
    const saved = registry[projectId];

    expect(saved).toBeDefined();
    expect(saved.canonicalPath).toBe(await fs.realpath(projectPath));
    expect(typeof saved.lastOpenedAt).toBe('string');
  });

  it('동일 프로젝트 경로를 다시 resolve하면 동일 GUID를 반환한다', async () => {
    const dataRoot = await makeTempDir('ai-canvas-global-root-');
    const projectPath = await makeTempDir('ai-canvas-project-');
    process.env.AI_CANVAS_DATA_DIR = dataRoot;

    const { resolveProjectId } = await loadCanvasPathModule();
    const firstId = await resolveProjectId(projectPath);
    const secondId = await resolveProjectId(projectPath);

    expect(secondId).toBe(firstId);
  });

  it('심볼릭 링크 경로를 resolve해도 동일 GUID를 반환한다', async () => {
    const dataRoot = await makeTempDir('ai-canvas-global-root-');
    const projectPath = await makeTempDir('ai-canvas-project-');
    const symlinkPath = path.join(await makeTempDir('ai-canvas-project-link-parent-'), 'project-link');
    process.env.AI_CANVAS_DATA_DIR = dataRoot;

    await fs.symlink(projectPath, symlinkPath);

    const { resolveProjectId } = await loadCanvasPathModule();
    const idFromRealPath = await resolveProjectId(projectPath);
    const idFromSymlink = await resolveProjectId(symlinkPath);

    expect(idFromSymlink).toBe(idFromRealPath);
  });

  it('getProjectDataDir는 GUID 형식이 아니면 에러를 던진다', async () => {
    const dataRoot = await makeTempDir('ai-canvas-global-root-');
    process.env.AI_CANVAS_DATA_DIR = dataRoot;

    const { getProjectDataDir } = await loadCanvasPathModule();
    expect(() => getProjectDataDir('invalid-id')).toThrowError('Invalid project id: invalid-id');
  });

  it('registry 파일은 모듈 재로드 이후에도 동일 매핑을 유지한다', async () => {
    const dataRoot = await makeTempDir('ai-canvas-global-root-');
    const projectPath = await makeTempDir('ai-canvas-project-');
    process.env.AI_CANVAS_DATA_DIR = dataRoot;

    const moduleA = await loadCanvasPathModule();
    const firstId = await moduleA.resolveProjectId(projectPath);

    const moduleB = await loadCanvasPathModule();
    const secondId = await moduleB.resolveProjectId(projectPath);
    expect(secondId).toBe(firstId);

    const registryPath = moduleB.getRegistryPath();
    const rawRegistry = await fs.readFile(registryPath, 'utf-8');
    const registry = JSON.parse(rawRegistry) as Record<string, { canonicalPath: string; lastOpenedAt: string }>;
    expect(registry[secondId].canonicalPath).toBe(await fs.realpath(projectPath));
  });
});
