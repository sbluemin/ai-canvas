import type { ChatStreamCallbacks, ChatHistory, AiProvider } from '../types';
import { buildPhase1Prompt, buildPhase2Prompt } from '../prompts';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export type { ChatStreamCallbacks, ChatHistory, AiProvider };

export interface ChatOptions {
  canvasContent?: string;
  selection?: {
    text: string;
    before: string;
    after: string;
  };
}

export interface Phase2ChatOptions {
  userRequest: string;
  canvasContent: string;
  updatePlan: string;
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

  async chat(
    prompt: string,
    callbacks: ChatStreamCallbacks,
    history: ChatHistory[] = [],
    options?: ChatOptions,
    provider: AiProvider = 'gemini'
  ): Promise<void> {
    const fullPrompt = options?.canvasContent !== undefined
      ? buildPhase1Prompt(prompt, options.canvasContent, history, {
          selection: options.selection,
        })
      : prompt;

    if (isElectron) {
      // Provider 이름을 API 이름으로 매핑
      const apiNameMap: Record<AiProvider, string> = {
        gemini: 'gemini',
        openai: 'codex',
        anthropic: 'anthropic',
        copilot: 'copilot',
      };
      const apiName = apiNameMap[provider] || provider;
      const api = (window.electronAPI as any)[apiName];

      if (!api) {
        callbacks.onError(`Provider ${provider} is not supported`);
        callbacks.onDone();
        return;
      }

      return new Promise((resolve) => {
        let accumulatedText = '';
        
        const unsubscribe = api.onChatChunk((chunk: any) => {
          if (chunk.text) {
            accumulatedText += chunk.text;
            callbacks.onText(accumulatedText);
          }
          if (chunk.error) {
            callbacks.onError(chunk.error);
            unsubscribe();
            callbacks.onDone();
            resolve();
          }
          if (chunk.done) {
            unsubscribe();
            callbacks.onDone();
            resolve();
          }
        });

        api.chat(fullPrompt).then((result: any) => {
          if (!result.success && result.error) {
            callbacks.onError(result.error);
            unsubscribe();
            callbacks.onDone();
            resolve();
          }
        });
      });
    }

    callbacks.onError('Chat is only available in Electron environment');
    callbacks.onDone();
  },

  async chatPhase2(
    options: Phase2ChatOptions,
    callbacks: ChatStreamCallbacks,
    provider: AiProvider = 'gemini'
  ): Promise<void> {
    const { userRequest, canvasContent, updatePlan } = options;
    const fullPrompt = buildPhase2Prompt(userRequest, canvasContent, updatePlan);

    if (isElectron) {
      // Provider 이름을 API 이름으로 매핑
      const apiNameMap: Record<AiProvider, string> = {
        gemini: 'gemini',
        openai: 'codex',
        anthropic: 'anthropic',
        copilot: 'copilot',
      };
      const apiName = apiNameMap[provider] || provider;
      const api = (window.electronAPI as any)[apiName];

      if (!api) {
        callbacks.onError(`Provider ${provider} is not supported`);
        callbacks.onDone();
        return;
      }

      return new Promise((resolve) => {
        let accumulatedText = '';
        
        const unsubscribe = api.onChatChunk((chunk: any) => {
          if (chunk.text) {
            accumulatedText += chunk.text;
            callbacks.onText(accumulatedText);
          }
          if (chunk.error) {
            callbacks.onError(chunk.error);
            unsubscribe();
            callbacks.onDone();
            resolve();
          }
          if (chunk.done) {
            unsubscribe();
            callbacks.onDone();
            resolve();
          }
        });

        api.chat(fullPrompt).then((result: any) => {
          if (!result.success && result.error) {
            callbacks.onError(result.error);
            unsubscribe();
            callbacks.onDone();
            resolve();
          }
        });
      });
    }

    callbacks.onError('Chat is only available in Electron environment');
    callbacks.onDone();
  },
};
