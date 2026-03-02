import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { resolveProjectDataDir } from './context';
import {
  ASSET_DIR_NAME,
  getAssetsDirPath,
  type ServiceResult,
  ok,
  fail,
} from '../shared/utils';

export async function saveImageAsset(
  projectPath: string,
  base64: string,
  mimeType: string
): Promise<ServiceResult<{ relativePath: string; absolutePath: string }>> {
  const projectDataDir = await resolveProjectDataDir(projectPath);
  const assetDir = getAssetsDirPath(projectDataDir);
  const ext = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/jpeg'
      ? 'jpg'
      : mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'image/gif'
          ? 'gif'
          : 'png';

  try {
    await fs.mkdir(assetDir, { recursive: true });
    const buffer = Buffer.from(base64, 'base64');
    const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12);
    const fileName = `${Date.now()}-${hash}.${ext}`;
    const fullPath = path.join(assetDir, fileName);
    await fs.writeFile(fullPath, buffer);

    return ok({
      relativePath: `${ASSET_DIR_NAME}/${fileName}`,
      absolutePath: fullPath,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
