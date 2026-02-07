import { useCallback } from 'react';
import { useStore } from '../../../store/useStore';
import './ModelRefreshButton.css';

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`refresh-icon ${spinning ? 'spinning' : ''}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  );
}

export function ModelRefreshButton() {
  const { modelsLoading, setModelsLoading, setAvailableModels } = useStore();

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  const handleRefresh = useCallback(async () => {
    if (!isElectron || modelsLoading) return;

    setModelsLoading(true);
    try {
      const result = await window.electronAPI.ai.fetchModels();
      if (result.success && result.models) {
        setAvailableModels(result.models);
      } else {
        console.error('Failed to fetch models:', result.error);
      }
    } catch (error) {
      console.error('Model fetch error:', error);
    } finally {
      setModelsLoading(false);
    }
  }, [isElectron, modelsLoading, setModelsLoading, setAvailableModels]);

  return (
    <button
      className={`model-refresh-button ${modelsLoading ? 'loading' : ''}`}
      onClick={handleRefresh}
      disabled={modelsLoading}
      title="모델 목록 새로고침"
    >
      <RefreshIcon spinning={modelsLoading} />
    </button>
  );
}
