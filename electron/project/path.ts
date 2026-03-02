import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { GLOBAL_CANVAS_DIR_NAME } from '../shared/consts';

const REGISTRY_DIR_NAME = 'registry';
const REGISTRY_FILE_NAME = 'projects.json';
const PROJECTS_DIR_NAME = 'projects';
const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const projectIdCache = new Map<string, string>();

interface RegistryProjectEntry {
  canonicalPath: string;
  lastOpenedAt: string;
}

type ProjectRegistry = Record<string, RegistryProjectEntry>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidProjectId(value: string): boolean {
  return PROJECT_ID_PATTERN.test(value);
}

function normalizeOverridePath(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !path.isAbsolute(trimmed)) {
    return null;
  }

  return path.resolve(trimmed);
}

async function readRegistry(): Promise<ProjectRegistry> {
  try {
    const raw = await fs.readFile(getRegistryPath(), 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) {
      return {};
    }

    const normalized: ProjectRegistry = {};
    for (const [projectId, entry] of Object.entries(parsed)) {
      if (!isValidProjectId(projectId)) {
        continue;
      }
      if (!isPlainObject(entry)) {
        continue;
      }
      const canonicalPath = typeof entry.canonicalPath === 'string' ? entry.canonicalPath : null;
      const lastOpenedAt = typeof entry.lastOpenedAt === 'string' ? entry.lastOpenedAt : null;
      if (!canonicalPath || !lastOpenedAt) {
        continue;
      }
      normalized[projectId] = { canonicalPath, lastOpenedAt };
      projectIdCache.set(canonicalPath, projectId);
    }

    return normalized;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    return {};
  }
}

async function writeRegistry(registry: ProjectRegistry): Promise<void> {
  const registryPath = getRegistryPath();
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
}

function findProjectIdByCanonicalPath(registry: ProjectRegistry, canonicalPath: string): string | null {
  for (const [projectId, entry] of Object.entries(registry)) {
    if (entry.canonicalPath === canonicalPath) {
      return projectId;
    }
  }
  return null;
}

export function getGlobalCanvasRoot(): string {
  const overridePath = normalizeOverridePath(process.env.AI_CANVAS_DATA_DIR);
  if (overridePath) {
    return overridePath;
  }
  return path.join(os.homedir(), GLOBAL_CANVAS_DIR_NAME);
}

export function getRegistryPath(): string {
  return path.join(getGlobalCanvasRoot(), REGISTRY_DIR_NAME, REGISTRY_FILE_NAME);
}

export function getProjectDataDir(projectId: string): string {
  if (!isValidProjectId(projectId)) {
    throw new Error(`Invalid project id: ${projectId}`);
  }

  return path.join(getGlobalCanvasRoot(), PROJECTS_DIR_NAME, projectId);
}

export async function resolveProjectId(projectPath: string): Promise<string> {
  const canonicalPath = await fs.realpath(projectPath);
  const now = new Date().toISOString();
  const cachedProjectId = projectIdCache.get(canonicalPath);

  if (cachedProjectId && isValidProjectId(cachedProjectId)) {
    return cachedProjectId;
  }

  const registry = await readRegistry();
  const existingProjectId = findProjectIdByCanonicalPath(registry, canonicalPath);
  if (existingProjectId && isValidProjectId(existingProjectId)) {
    registry[existingProjectId] = { canonicalPath, lastOpenedAt: now };
    await writeRegistry(registry);
    projectIdCache.set(canonicalPath, existingProjectId);
    return existingProjectId;
  }

  let projectId = randomUUID();
  while (registry[projectId]) {
    projectId = randomUUID();
  }

  registry[projectId] = { canonicalPath, lastOpenedAt: now };
  await writeRegistry(registry);
  projectIdCache.set(canonicalPath, projectId);
  return projectId;
}
