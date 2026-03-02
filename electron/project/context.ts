import { getProjectDataDir, resolveProjectId } from './path';

export async function resolveProjectDataDir(projectPath: string): Promise<string> {
  const projectId = await resolveProjectId(projectPath);
  return getProjectDataDir(projectId);
}
