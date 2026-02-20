import type { AiProvider } from '../types';
import type { FeatureSummary, AvailableModels } from '../store/types';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase_message_stream'; phase: 'evaluating' | 'updating'; message: string }
  | { runId: string; type: 'phase1_result'; message: string; needsCanvasUpdate: boolean; updatePlan?: string }
  | { runId: string; type: 'phase2_result'; message: string; canvasContent: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };

export type { AiProvider };

type ThemeMode = 'dark' | 'light' | 'system';
export type RuntimeMode = 'auto' | 'local' | 'global';

export interface RuntimeStatus {
  mode: RuntimeMode;
  activeRuntime: 'local' | 'global' | 'none';
  localInstalled: boolean;
  globalInstalled: boolean;
  onboardingDone: boolean;
  localBinaryPath: string;
  configDir: string;
}

export interface RuntimeInstallProgress {
  projectPath: string;
  phase: 'downloading' | 'extracting' | 'finalizing' | 'done' | 'error';
  percent: number;
  receivedBytes?: number;
  totalBytes?: number;
}

export interface RuntimeModelsRefreshedEvent {
  success: boolean;
  models?: AvailableModels;
  error?: string;
}

export interface ChatRequestOptions {
  selection?: {
    text: string;
    before: string;
    after: string;
  };
  writingGoal?: {
    purpose: string;
    audience: string;
    tone: string;
    targetLength: 'short' | 'medium' | 'long';
  };
  modelId?: string;
  variant?: string;
  fileMentions?: {
    id: string;
    fileName: string;
    filePath: string;
  }[];
}

export const api = {
  isElectron,

  /**
   * AI 채팅 요청 (통합 IPC)
   */
  async chat(
    runId: string,
    prompt: string,
    history: { role: 'user' | 'assistant'; content: string; provider?: AiProvider }[],
    canvasContent: string,
    options?: ChatRequestOptions
  ): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) {
      return { success: false, error: 'Chat is only available in Electron environment' };
    }

    return window.electronAPI.ai.chat({
      runId,
      prompt,
      history,
      canvasContent,
      modelId: options?.modelId,
      variant: options?.variant,
      selection: options?.selection,
      writingGoal: options?.writingGoal,
      fileMentions: options?.fileMentions,
    });
  },

  /**
   * AI 채팅 이벤트 구독
   */
  onChatEvent(callback: (event: AiChatEvent) => void): () => void {
    if (!isElectron) {
      return () => {};
    }
    return window.electronAPI.ai.onChatEvent(callback);
  },

  async openProjectDirectory(): Promise<string | null> {
    if (!isElectron) return null;
    return window.electronAPI.project.openDirectory();
  },

  async initCanvasDir(projectPath: string): Promise<{ success: boolean; path?: string; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.initCanvasDir(projectPath);
  },

  async listFeatures(projectPath: string): Promise<{ success: boolean; features?: FeatureSummary[]; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.listFeatures(projectPath) as Promise<{ success: boolean; features?: FeatureSummary[]; error?: string }>;
  },

  async createFeature(projectPath: string, featureId: string, name: string): Promise<{ success: boolean; feature?: FeatureSummary; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.createFeature(projectPath, featureId, name) as Promise<{ success: boolean; feature?: FeatureSummary; error?: string }>;
  },

  async renameFeature(projectPath: string, oldFeatureId: string, newFeatureId: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.renameFeature(projectPath, oldFeatureId, newFeatureId);
  },

  async deleteFeature(projectPath: string, featureId: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.deleteFeature(projectPath, featureId);
  },

  async readFeatureMeta(projectPath: string, featureId: string): Promise<{ success: boolean; meta?: unknown; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.readFeatureMeta(projectPath, featureId);
  },

  async writeFeatureMeta(projectPath: string, featureId: string, meta: unknown): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.writeFeatureMeta(projectPath, featureId, meta);
  },

  async listFeatureCanvasFiles(projectPath: string, featureId: string): Promise<{ success: boolean; files?: string[]; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.listFeatureCanvasFiles(projectPath, featureId);
  },

  async readWorkspace(projectPath: string): Promise<{ success: boolean; workspace?: unknown; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.readWorkspace(projectPath);
  },

  async writeWorkspace(projectPath: string, workspace: unknown): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.writeWorkspace(projectPath, workspace);
  },

  async readAutosaveStatus(projectPath: string): Promise<{ success: boolean; status?: unknown; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.readAutosaveStatus(projectPath);
  },

  async writeAutosaveStatus(projectPath: string, status: unknown): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.writeAutosaveStatus(projectPath, status);
  },

  async readCanvasFile(projectPath: string, fileName: string): Promise<{ success: boolean; content?: string; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.readCanvasFile(projectPath, fileName);
  },

  async writeCanvasFile(projectPath: string, fileName: string, content: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.writeCanvasFile(projectPath, fileName, content);
  },

  async renameCanvasFile(projectPath: string, oldFileName: string, newFileName: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.renameCanvasFile(projectPath, oldFileName, newFileName);
  },

  async deleteCanvasFile(projectPath: string, fileName: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.deleteCanvasFile(projectPath, fileName);
  },

  async readChatSession(projectPath: string, featureId: string): Promise<{ success: boolean; messages?: unknown[]; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.readChatSession(projectPath, featureId);
  },

  async writeChatSession(projectPath: string, featureId: string, messages: unknown[]): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.writeChatSession(projectPath, featureId, messages);
  },

  async saveImageAsset(projectPath: string, base64: string, mimeType: string): Promise<{ success: boolean; relativePath?: string; absolutePath?: string; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.saveImageAsset(projectPath, base64, mimeType);
  },

  async exportDocument(projectPath: string, format: 'html' | 'pdf' | 'docx', markdownContent: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.exportDocument(projectPath, format, markdownContent);
  },

  async exportShareBundle(projectPath: string, bundle: unknown): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.exportShareBundle(projectPath, bundle);
  },

  async importShareBundle(): Promise<{ success: boolean; bundle?: unknown; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.importShareBundle();
  },

  async createDefaultCanvas(projectPath: string): Promise<{ success: boolean; fileName?: string; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.createDefaultCanvas(projectPath);
  },

  async openInExplorer(projectPath: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.openInExplorer(projectPath);
  },

  async listCanvasTree(projectPath: string): Promise<{ success: boolean; tree?: unknown[]; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.listCanvasTree(projectPath);
  },

  async listProjectFiles(projectPath: string): Promise<{ success: boolean; files?: string[]; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.listProjectFiles(projectPath);
  },

  async createCanvasFolder(projectPath: string, folderPath: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.createCanvasFolder(projectPath, folderPath);
  },

  async deleteCanvasFolder(projectPath: string, folderPath: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.deleteCanvasFolder(projectPath, folderPath);
  },

  async moveCanvasFile(projectPath: string, oldPath: string, newPath: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.moveCanvasFile(projectPath, oldPath, newPath);
  },

  async renameCanvasFolder(projectPath: string, oldFolderPath: string, newFolderPath: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.project.renameCanvasFolder(projectPath, oldFolderPath, newFolderPath);
  },

  async readAppSettings(): Promise<{ success: boolean; settings?: { theme: ThemeMode }; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.settings.read();
  },

  async writeAppSettings(settings: { theme: ThemeMode }): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.settings.write(settings);
  },

  async runtimeCheckStatus(projectPath: string | null): Promise<{ success: boolean; data?: RuntimeStatus; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.runtime.checkStatus(projectPath);
  },

  async runtimeSetMode(projectPath: string, mode: RuntimeMode): Promise<{ success: boolean; data?: RuntimeStatus; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.runtime.setMode(projectPath, mode);
  },

  async runtimeInstallLocal(projectPath: string): Promise<{ success: boolean; data?: RuntimeStatus; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.runtime.installLocal(projectPath);
  },

  async runtimeOpenAuthTerminal(projectPath: string | null): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.runtime.openAuthTerminal(projectPath);
  },

  async runtimeOpenTerminal(projectPath: string | null): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.runtime.openTerminal(projectPath);
  },

  async runtimeCompleteOnboarding(projectPath: string): Promise<{ success: boolean; data?: RuntimeStatus; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.runtime.completeOnboarding(projectPath);
  },

  async runtimeClearContext(): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.runtime.clearContext();
  },

  onRuntimeInstallProgress(callback: (progress: RuntimeInstallProgress) => void): () => void {
    if (!isElectron) {
      return () => {};
    }
    return window.electronAPI.runtime.onInstallProgress(callback);
  },

  onRuntimeModelsRefreshed(callback: (event: RuntimeModelsRefreshedEvent) => void): () => void {
    if (!isElectron) {
      return () => {};
    }
    return window.electronAPI.runtime.onModelsRefreshed((payload) => callback(payload as RuntimeModelsRefreshedEvent));
  },

  async showEmojiPanel(): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) return { success: false, error: 'Electron only' };
    return window.electronAPI.window.showEmojiPanel();
  },
};
