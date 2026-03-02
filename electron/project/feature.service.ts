import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveProjectDataDir } from './context';
import {
  DEFAULT_CANVAS_NAME,
  DEFAULT_FEATURE_ID,
  DEFAULT_FEATURE_NAME,
  DEFAULT_CANVAS_CONTENT,
  ASSET_DIR_NAME,
  getFeatureDirPath,
  getFeatureMetaPath,
  isValidCanvasFolderName,
  type ServiceResult,
  ok,
  fail,
} from '../shared/utils';
import type { FeatureMeta, FeatureSummary } from './types';

function toFeatureSummary(featureId: string, meta: FeatureMeta | null, fallbackOrder: number): FeatureSummary {
  return {
    id: featureId,
    name: featureId,
    description: meta?.description,
    icon: meta?.icon,
    order: typeof meta?.order === 'number' ? meta.order : fallbackOrder,
    createdAt: meta?.createdAt,
    updatedAt: meta?.updatedAt,
    writingGoal: meta?.writingGoal,
  };
}

async function readFeatureMetaInternal(projectDataDir: string, featureId: string): Promise<FeatureMeta | null> {
  const metaPath = getFeatureMetaPath(projectDataDir, featureId);
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    const parsed = JSON.parse(raw) as FeatureMeta;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    return null;
  }
}

async function writeFeatureMetaInternal(projectDataDir: string, featureId: string, meta: FeatureMeta): Promise<void> {
  const featureDir = getFeatureDirPath(projectDataDir, featureId);
  const metaPath = getFeatureMetaPath(projectDataDir, featureId);
  await fs.mkdir(featureDir, { recursive: true });
  await fs.writeFile(metaPath, JSON.stringify(meta), 'utf-8');
}

export async function listFeatures(projectPath: string): Promise<ServiceResult<{ features: FeatureSummary[] }>> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  try {
    const entries = await fs.readdir(projectDataDir, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== ASSET_DIR_NAME);

    const features: FeatureSummary[] = [];
    for (let i = 0; i < directories.length; i += 1) {
      const featureId = directories[i].name;
      const meta = await readFeatureMetaInternal(projectDataDir, featureId);
      features.push(toFeatureSummary(featureId, meta, i));
    }

    features.sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name);
    });

    return ok({ features });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ features: [] });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function createFeature(projectPath: string, featureId: string, name: string): Promise<ServiceResult<{ feature: FeatureSummary }>> {
  void name;
  if (!isValidCanvasFolderName(featureId)) {
    return fail('Invalid feature id.');
  }

  const projectDataDir = await resolveProjectDataDir(projectPath);
  const now = new Date().toISOString();
  const featureDir = getFeatureDirPath(projectDataDir, featureId);
  const featuresResult = await listFeatures(projectPath);
  const nextOrder = featuresResult.success
    ? (featuresResult.data?.features.reduce((maxOrder, feature) => Math.max(maxOrder, feature.order), -1) ?? -1) + 1
    : 0;

  try {
    await fs.mkdir(featureDir, { recursive: false });
    const meta: FeatureMeta = {
      name: featureId,
      description: '',
      icon: '',
      order: nextOrder,
      createdAt: now,
      updatedAt: now,
      writingGoal: null,
    };
    await writeFeatureMetaInternal(projectDataDir, featureId, meta);
    return ok({ feature: toFeatureSummary(featureId, meta, 0) });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return fail('Feature already exists.');
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function renameFeature(projectPath: string, oldFeatureId: string, newFeatureId: string): Promise<ServiceResult> {
  if (!isValidCanvasFolderName(oldFeatureId) || !isValidCanvasFolderName(newFeatureId)) {
    return fail('Invalid feature id.');
  }

  const projectDataDir = await resolveProjectDataDir(projectPath);
  const oldPath = getFeatureDirPath(projectDataDir, oldFeatureId);
  const newPath = getFeatureDirPath(projectDataDir, newFeatureId);

  try {
    await fs.rename(oldPath, newPath);
    const meta = await readFeatureMetaInternal(projectDataDir, newFeatureId);
    const now = new Date().toISOString();
    await writeFeatureMetaInternal(projectDataDir, newFeatureId, {
      ...(meta ?? {}),
      name: newFeatureId,
      updatedAt: now,
    });
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function deleteFeature(projectPath: string, featureId: string): Promise<ServiceResult> {
  if (!isValidCanvasFolderName(featureId)) {
    return fail('Invalid feature id.');
  }

  const projectDataDir = await resolveProjectDataDir(projectPath);
  const featureDir = getFeatureDirPath(projectDataDir, featureId);
  try {
    await fs.rm(featureDir, { recursive: true, force: true });
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function readFeatureMeta(projectPath: string, featureId: string): Promise<ServiceResult<{ meta: FeatureMeta | null }>> {
  if (!isValidCanvasFolderName(featureId)) {
    return fail('Invalid feature id.');
  }

  try {
    const projectDataDir = await resolveProjectDataDir(projectPath);
    const meta = await readFeatureMetaInternal(projectDataDir, featureId);
    return ok({ meta });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function writeFeatureMeta(projectPath: string, featureId: string, meta: FeatureMeta): Promise<ServiceResult> {
  if (!isValidCanvasFolderName(featureId)) {
    return fail('Invalid feature id.');
  }

  try {
    const projectDataDir = await resolveProjectDataDir(projectPath);
    await writeFeatureMetaInternal(projectDataDir, featureId, meta);
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function listFeatureCanvasFiles(projectPath: string, featureId: string): Promise<ServiceResult<{ files: string[] }>> {
  if (!isValidCanvasFolderName(featureId)) {
    return fail('Invalid feature id.');
  }

  const projectDataDir = await resolveProjectDataDir(projectPath);
  const featureDir = getFeatureDirPath(projectDataDir, featureId);
  try {
    const entries = await fs.readdir(featureDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => `${featureId}/${entry.name}`)
      .sort((a, b) => a.localeCompare(b));
    return ok({ files });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ files: [] });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function createDefaultCanvas(projectPath: string): Promise<ServiceResult<{ fileName: string }>> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const featureDir = path.join(projectDataDir, DEFAULT_FEATURE_ID);
  const filePath = path.join(featureDir, DEFAULT_CANVAS_NAME);
  try {
    await fs.mkdir(featureDir, { recursive: true });
    const now = new Date().toISOString();
    await writeFeatureMetaInternal(projectDataDir, DEFAULT_FEATURE_ID, {
      name: DEFAULT_FEATURE_NAME,
      description: '',
      icon: '',
      order: 0,
      createdAt: now,
      updatedAt: now,
      writingGoal: null,
    });
    await fs.writeFile(filePath, DEFAULT_CANVAS_CONTENT, 'utf-8');
    return ok({ fileName: `${DEFAULT_FEATURE_ID}/${DEFAULT_CANVAS_NAME}` });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
