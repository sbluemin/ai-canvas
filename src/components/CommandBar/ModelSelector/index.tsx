import { useStore } from '../../../store/useStore';
import type { AiProvider } from '../../../types/chat';
import './ModelSelector.css';

interface ModelSelectorProps {
  provider: AiProvider;
}

export function ModelSelector({ provider }: ModelSelectorProps) {
  const { availableModels, selectedModels, setSelectedModel } = useStore();

  const models = availableModels[provider];
  const selectedModelId = selectedModels[provider];

  if (models.length === 0) {
    return (
      <div className="model-selector">
        <div className="model-selector-empty">
          모델 목록을 불러오려면 새로고침하세요
        </div>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <div className="model-selector-label">모델</div>
      <div className="model-selector-list">
        {models.map((model) => (
          <button
            key={model.id}
            className={`model-selector-item ${selectedModelId === model.id ? 'selected' : ''}`}
            onClick={() => setSelectedModel(provider, model.id)}
          >
            <span className="model-name">{model.name}</span>
            {model.releaseDate && (
              <span className="model-date">{model.releaseDate}</span>
            )}
            {selectedModelId === model.id && (
              <span className="model-check">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
