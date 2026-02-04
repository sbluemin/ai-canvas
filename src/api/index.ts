import type { ChatStreamCallbacks, ChatHistory } from '../types';
import { buildPhase1Prompt, buildPhase2Prompt } from '../prompts';
import type { CanvasProvider } from '../store/useStore';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export type { ChatStreamCallbacks, ChatHistory };

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
    options?: ChatOptions
  ): Promise<void> {
    const fullPrompt = options?.canvasContent !== undefined
      ? buildPhase1Prompt(prompt, options.canvasContent, history, {
          selection: options.selection,
        })
      : prompt;

    if (isElectron) {
      return new Promise((resolve) => {
        let accumulatedText = '';
        
        const unsubscribe = window.electronAPI.gemini.onChatChunk((chunk) => {
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

        window.electronAPI.gemini.chat(fullPrompt).then((result) => {
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
    callbacks: ChatStreamCallbacks
  ): Promise<void> {
    const { userRequest, canvasContent, updatePlan } = options;
    const fullPrompt = buildPhase2Prompt(userRequest, canvasContent, updatePlan);

    if (isElectron) {
      return new Promise((resolve) => {
        let accumulatedText = '';
        
        const unsubscribe = window.electronAPI.gemini.onChatChunk((chunk) => {
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

        window.electronAPI.gemini.chat(fullPrompt).then((result) => {
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

  async chatWithProvider(
    provider: CanvasProvider,
    prompt: string,
    callbacks: ChatStreamCallbacks,
    history: ChatHistory[] = [],
    options?: ChatOptions
  ): Promise<void> {
    const fullPrompt = options?.canvasContent !== undefined
      ? buildPhase1Prompt(prompt, options.canvasContent, history, {
          selection: options.selection,
        })
      : prompt;

    if (!isElectron) {
      callbacks.onError('Chat is only available in Electron environment');
      callbacks.onDone();
      return;
    }

    const providerApi = provider === 'gemini' 
      ? window.electronAPI.gemini 
      : window.electronAPI.codex;

    return new Promise((resolve) => {
      let accumulatedText = '';
      
      const unsubscribe = providerApi.onChatChunk((chunk) => {
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

      providerApi.chat(fullPrompt).then((result) => {
        if (!result.success && result.error) {
          callbacks.onError(result.error);
          unsubscribe();
          callbacks.onDone();
          resolve();
        }
      });
    });
  },

  async chatPhase2WithProvider(
    provider: CanvasProvider,
    options: Phase2ChatOptions,
    callbacks: ChatStreamCallbacks
  ): Promise<void> {
    const { userRequest, canvasContent, updatePlan } = options;
    const fullPrompt = buildPhase2Prompt(userRequest, canvasContent, updatePlan);

    if (!isElectron) {
      callbacks.onError('Chat is only available in Electron environment');
      callbacks.onDone();
      return;
    }

    const providerApi = provider === 'gemini'
      ? window.electronAPI.gemini
      : window.electronAPI.codex;

    return new Promise((resolve) => {
      let accumulatedText = '';
      
      const unsubscribe = providerApi.onChatChunk((chunk) => {
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

      providerApi.chat(fullPrompt).then((result) => {
        if (!result.success && result.error) {
          callbacks.onError(result.error);
          unsubscribe();
          callbacks.onDone();
          resolve();
        }
      });
    });
  },
};
