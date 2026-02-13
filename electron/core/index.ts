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
  markdownToBasicHtml,
} from './utils';
