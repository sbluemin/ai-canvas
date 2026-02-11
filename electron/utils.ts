import path from 'node:path';
import {
  AI_CANVAS_DIR,
  CHAT_SESSION_NAME,
  WORKSPACE_NAME,
  AUTOSAVE_STATUS_NAME,
  ASSET_DIR_NAME,
} from './consts';

export function isValidCanvasFileName(fileName: string): boolean {
  if (!fileName.endsWith('.md')) return false;
  if (fileName.includes('/') || fileName.includes('\\')) return false;
  if (fileName.includes('..')) return false;
  return fileName.length > 3;
}

export function getCanvasFilePath(projectPath: string, fileName: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, fileName);
}

export function getChatSessionPath(projectPath: string): string {
  return path.join(projectPath, AI_CANVAS_DIR, CHAT_SESSION_NAME);
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

export function markdownToBasicHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = escaped
    .replace(/^######\s+(.+)$/gm, '<h6></h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5></h5>')
    .replace(/^####\s+(.+)$/gm, '<h4></h4>')
    .replace(/^###\s+(.+)$/gm, '<h3></h3>')
    .replace(/^##\s+(.+)$/gm, '<h2></h2>')
    .replace(/^#\s+(.+)$/gm, '<h1></h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong></strong>')
    .replace(/\*(.+?)\*/g, '<em></em>')
    .replace(/`([^`]+)`/g, '<code></code>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  return `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:Inter,Segoe UI,sans-serif;padding:32px;line-height:1.6;color:#111827}code{background:#f3f4f6;padding:2px 4px;border-radius:4px}pre{background:#111827;color:#f9fafb;padding:12px;border-radius:8px;overflow:auto}img{max-width:100%}</style></head><body><p>${html}</p></body></html>`;
}
