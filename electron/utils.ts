import path from 'node:path';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import {
  AI_CANVAS_DIR,
  OPENCODE_RUNTIME_DIR,
  DEFAULT_CANVAS_NAME,
  CHAT_SESSION_NAME,
  FEATURE_META_NAME,
  WORKSPACE_NAME,
  AUTOSAVE_STATUS_NAME,
  ASSET_DIR_NAME,
  DEFAULT_FEATURE_ID,
  DEFAULT_FEATURE_NAME,
  DEFAULT_CANVAS_CONTENT,
} from './consts';

export {
  AI_CANVAS_DIR,
  OPENCODE_RUNTIME_DIR,
  DEFAULT_CANVAS_NAME,
  CHAT_SESSION_NAME,
  FEATURE_META_NAME,
  WORKSPACE_NAME,
  AUTOSAVE_STATUS_NAME,
  ASSET_DIR_NAME,
  DEFAULT_FEATURE_ID,
  DEFAULT_FEATURE_NAME,
  DEFAULT_CANVAS_CONTENT,
};

export interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export function ok<T>(data?: T): ServiceResult<T> {
  return { success: true, data };
}

export function fail<T = void>(error: string): ServiceResult<T> {
  return { success: false, error };
}

export type IpcHandler<T = any> = (
  event: IpcMainInvokeEvent,
  ...args: any[]
) => Promise<T> | T;

export function handleIpc<T>(channel: string, handler: IpcHandler<T>) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  });
}

/**
 * 캔버스 파일명 유효성 검증
 * 서브디렉토리 경로 허용 (예: "auth/login-flow.md")
 * 보안: ".." 경로 탈출, 백슬래시, 절대 경로 차단
 */
export function isValidCanvasFileName(fileName: string): boolean {
  if (!fileName.endsWith('.md')) return false;
  if (fileName.includes('\\')) return false;
  if (fileName.includes('..')) return false;
  if (fileName.startsWith('/')) return false;
  const segments = fileName.split('/');
  if (segments.some((s) => s.length === 0)) return false;
  const baseName = segments[segments.length - 1];
  return baseName.length > 3;
}

/**
 * 폴더명 유효성 검증
 * 보안: ".." 경로 탈출, 슬래시, 백슬래시 차단
 */
export function isValidCanvasFolderName(folderName: string): boolean {
  if (!folderName || folderName.length === 0) return false;
  if (folderName.includes('/') || folderName.includes('\\')) return false;
  if (folderName.includes('..')) return false;
  if (folderName.startsWith('.')) return false;
  return folderName.length > 0;
}

/**
 * 폴더 경로 유효성 검증 (중첩 경로 허용)
 * 예: "auth", "auth/oauth" 허용, "../escape" 차단
 */
export function isValidCanvasFolderPath(folderPath: string): boolean {
  if (!folderPath || folderPath.length === 0) return false;
  if (folderPath.includes('\\')) return false;
  if (folderPath.includes('..')) return false;
  if (folderPath.startsWith('/')) return false;
  const segments = folderPath.split('/');
  return segments.every((s) => s.length > 0 && !s.startsWith('.'));
}

export function getCanvasFolderPath(projectPath: string, folderPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, folderPath);
}

export function getCanvasFilePath(projectPath: string, fileName: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, fileName);
}

export function getFeatureDirPath(projectPath: string, featureId: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, featureId);
}

export function getFeatureMetaPath(projectPath: string, featureId: string): string {
  return path.join(getFeatureDirPath(projectPath, featureId), FEATURE_META_NAME);
}

export function getChatSessionPath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, CHAT_SESSION_NAME);
}

export function getFeatureChatSessionPath(projectPath: string, featureId: string): string {
  return path.join(getFeatureDirPath(projectPath, featureId), CHAT_SESSION_NAME);
}

export function getWorkspacePath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, WORKSPACE_NAME);
}

export function getAutosaveStatusPath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, AUTOSAVE_STATUS_NAME);
}

export function getAssetsDirPath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, ASSET_DIR_NAME);
}

export function getBackendDirPath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, OPENCODE_RUNTIME_DIR);
}

export function getBackendLocalBinaryPath(projectPath: string): string {
  const fileName = process.platform === 'win32' ? 'opencode.exe' : 'opencode';
  return path.join(getBackendDirPath(projectPath), fileName);
}

export function markdownToBasicHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = escaped
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  return `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:Inter,Segoe UI,sans-serif;padding:32px;line-height:1.6;color:#111827}code{background:#f3f4f6;padding:2px 4px;border-radius:4px}pre{background:#111827;color:#f9fafb;padding:12px;border-radius:8px;overflow:auto}img{max-width:100%}</style></head><body><p>${html}</p></body></html>`;
}
