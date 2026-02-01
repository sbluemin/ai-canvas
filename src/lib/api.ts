import type { ChatStreamCallbacks } from '../shared/types';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

export type { ChatStreamCallbacks };

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
    const filename = prompt('열 파일명을 입력하세요');
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

  async readFile(filePath: string): Promise<string> {
    if (isElectron) {
      return window.electronAPI.readFile(filePath);
    }
    const response = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`);
    if (!response.ok) throw new Error('파일 읽기 실패');
    const data = await response.json();
    return data.content;
  },

  async listFiles(): Promise<string[]> {
    if (isElectron) {
      return [];
    }
    const response = await fetch('/api/files/list');
    if (!response.ok) return [];
    const data = await response.json();
    return data.files;
  },

  async chat(prompt: string, callbacks: ChatStreamCallbacks): Promise<void> {
    if (isElectron) {
      callbacks.onText('Electron 환경에서는 아직 채팅이 지원되지 않습니다.');
      callbacks.onDone();
      return;
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok || !response.body) {
      callbacks.onError('채팅 요청 실패');
      callbacks.onDone();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) callbacks.onText(data.text);
            if (data.error) callbacks.onError(data.error);
            if (data.done) callbacks.onDone();
          } catch { }
        }
      }
    }
  },
};
