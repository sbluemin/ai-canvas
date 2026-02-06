import type { AiProvider } from '../types';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

type AiChatEvent =
  | { runId: string; type: 'phase'; phase: 'evaluating' | 'updating' }
  | { runId: string; type: 'phase1_result'; message: string; needsCanvasUpdate: boolean; updatePlan?: string }
  | { runId: string; type: 'phase2_result'; message: string; canvasContent: string }
  | { runId: string; type: 'error'; phase: 'evaluating' | 'updating'; error: string }
  | { runId: string; type: 'done' };

export type { AiProvider };

export interface ChatRequestOptions {
  selection?: {
    text: string;
    before: string;
    after: string;
  };
}

export const api = {
  isElectron,

  async showSaveDialog(): Promise<string | null> {
    if (isElectron) {
      return window.electronAPI.showSaveDialog();
    }
    const filename = prompt('저장할 파일명을 입력하세요 (예: document.md)');
    return filename ? filename : null;
  },

  async showOpenDialog(): Promise<string | null> {
    if (isElectron) {
      return window.electronAPI.showOpenDialog();
    }
    const filename = prompt('열 파일명을 입력하세요 (예: document.md)');
    return filename ? filename : null;
  },

  async readFile(filePath: string): Promise<string> {
    if (isElectron) {
      return window.electronAPI.readFile(filePath);
    }
    const response = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`);
    if (!response.ok) throw new Error('파일 읽기 실패');
    return response.text();
  },

  async writeFile(filePath: string, content: string): Promise<boolean> {
    if (isElectron) {
      return window.electronAPI.writeFile(filePath, content);
    }
    const response = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    if (!response.ok) throw new Error('파일 저장 실패');
    return true;
  },

  /**
   * AI 채팅 요청 (통합 IPC)
   */
  async chat(
    runId: string,
    prompt: string,
    history: { role: 'user' | 'assistant'; content: string; provider?: AiProvider }[],
    canvasContent: string,
    provider: AiProvider,
    options?: ChatRequestOptions
  ): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) {
      return { success: false, error: 'Chat is only available in Electron environment' };
    }

    return window.electronAPI.ai.chat({
      runId,
      provider,
      prompt,
      history,
      canvasContent,
      selection: options?.selection,
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
};
