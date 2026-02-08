import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../../store/useStore';
import type { AiProvider } from '../../../types/chat';
import './ModelSelector.css';

interface ModelSelectorProps {
  provider: AiProvider;
}

export function ModelSelector({ provider }: ModelSelectorProps) {
  const { availableModels, selectedModels, setSelectedModel } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const models = availableModels[provider];
  const selectedModelId = selectedModels[provider];
  const selectedModel = models.find((m) => m.id === selectedModelId);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (models.length === 0) {
    return (
      <div className="model-selector" ref={containerRef}>
        <button type="button" className="model-selector-trigger" disabled>
          모델 없음
        </button>
      </div>
    );
  }

  return (
    <div className="model-selector" ref={containerRef}>
      <button
        type="button"
        className={`model-selector-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span className="model-selector-trigger-text">
          {selectedModel?.name ?? selectedModelId}
        </span>
        <span className="model-selector-chevron">▾</span>
      </button>
      {isOpen && (
        <div className="model-selector-dropdown">
          <div className="model-selector-list">
            {models.map((model) => (
              <button
                key={model.id}
                className={`model-selector-item ${selectedModelId === model.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedModel(provider, model.id);
                  setIsOpen(false);
                }}
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
      )}
    </div>
  );
}
