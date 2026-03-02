import fs from 'node:fs/promises';
import { resolveProjectDataDir } from './context';
import {
  getFeatureDirPath,
  getFeatureChatSessionPath,
  getWorkspacePath,
  getAutosaveStatusPath,
  isValidCanvasFolderName,
  type ServiceResult,
  ok,
  fail,
} from '../shared/utils';

export async function readChatSession(projectPath: string, featureId: string): Promise<ServiceResult<{ messages: unknown[] }>> {
  if (!isValidCanvasFolderName(featureId)) {
    return fail('Invalid feature id.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const filePath = getFeatureChatSessionPath(projectDataDir, featureId);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return ok({ messages: [] });
    }
    return ok({ messages: parsed });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ messages: [] });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function writeChatSession(projectPath: string, featureId: string, messages: unknown[]): Promise<ServiceResult> {
  if (!isValidCanvasFolderName(featureId)) {
    return fail('Invalid feature id.');
  }
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const filePath = getFeatureChatSessionPath(projectDataDir, featureId);
  try {
    const featureDir = getFeatureDirPath(projectDataDir, featureId);
    await fs.mkdir(featureDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(messages), 'utf-8');
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function readWorkspace(projectPath: string): Promise<ServiceResult<{ workspace: unknown }>> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const workspacePath = getWorkspacePath(projectDataDir);
  try {
    const raw = await fs.readFile(workspacePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return ok({ workspace: parsed });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ workspace: null });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function writeWorkspace(projectPath: string, workspace: unknown): Promise<ServiceResult> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const workspacePath = getWorkspacePath(projectDataDir);
  try {
    await fs.mkdir(projectDataDir, { recursive: true });
    await fs.writeFile(workspacePath, JSON.stringify(workspace), 'utf-8');
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function readAutosaveStatus(projectPath: string): Promise<ServiceResult<{ status: unknown }>> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const autosaveStatusPath = getAutosaveStatusPath(projectDataDir);
  try {
    const raw = await fs.readFile(autosaveStatusPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return ok({ status: parsed });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ok({ status: null });
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function writeAutosaveStatus(projectPath: string, status: unknown): Promise<ServiceResult> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const autosaveStatusPath = getAutosaveStatusPath(projectDataDir);
  try {
    await fs.mkdir(projectDataDir, { recursive: true });
    await fs.writeFile(autosaveStatusPath, JSON.stringify(status), 'utf-8');
    return ok();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
