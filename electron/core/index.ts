// core/ 모듈 공개 API
export { handleIpc, type IpcHandler } from './ipc';

export {
  AI_CANVAS_DIR,
  OPENCODE_RUNTIME_DIR,
  OPENCODE_CONFIG_FILE,
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
  isValidCanvasFileName,
  isValidCanvasFolderName,
  isValidCanvasFolderPath,
  getCanvasFolderPath,
  getCanvasFilePath,
  getFeatureDirPath,
  getFeatureMetaPath,
  getChatSessionPath,
  getFeatureChatSessionPath,
  getWorkspacePath,
  getAutosaveStatusPath,
  getAssetsDirPath,
  getBackendDirPath,
  getBackendConfigPath,
  getBackendLocalBinaryPath,
  markdownToBasicHtml,
} from './utils';
