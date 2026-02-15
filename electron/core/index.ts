// core/ 모듈 공개 API
export { handleIpc, type IpcHandler } from './ipc';

export {
  AI_CANVAS_DIR,
  DEFAULT_CANVAS_NAME,
  CHAT_SESSION_NAME,
  WORKSPACE_NAME,
  AUTOSAVE_STATUS_NAME,
  ASSET_DIR_NAME,
  DEFAULT_CANVAS_CONTENT,
  VERSION_HISTORY_DIR_NAME,
  VERSION_MANIFEST_NAME,
  MAX_SNAPSHOTS_PER_FILE,
} from './consts';

export {
  isValidCanvasFileName,
  isValidCanvasFolderName,
  isValidCanvasFolderPath,
  getCanvasFolderPath,
  getCanvasFilePath,
  getChatSessionPath,
  getWorkspacePath,
  getAutosaveStatusPath,
  getAssetsDirPath,
  getVersionHistoryDirPath,
  markdownToBasicHtml,
} from './utils';
