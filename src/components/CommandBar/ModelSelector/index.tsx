import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../../store/useStore';
import './ModelSelector.css';

export function ModelSelector() {
  const { availableModels, selectedModels, selectedVariant, setSelectedModel, setSelectedVariant } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const models = availableModels.opencode;
  const selectedModelId = selectedModels.opencode;
  const selectedModel = models.find((m) => m.id === selectedModelId) ?? null;
  
  const providers = Array.from(
    new Set(models.map((m) => m.providerId ?? m.id.split('/')[0]).filter((value): value is string => !!value))
  ).sort();

  const selectedProvider = selectedModel?.providerId ?? selectedModelId?.split('/')[0] ?? providers[0] ?? null;

  // 드롭다운이 열릴 때 현재 선택된 provider를 hoveredProvider로 초기화
  useEffect(() => {
    if (isOpen) {
      setHoveredProvider(selectedProvider);
    }
  }, [isOpen, selectedProvider]);

  // Click Outside 닫기
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

  // 자동 선택 로직 유지
  useEffect(() => {
    if (!selectedModelId && models.length > 0) {
      const firstModel = models[0];
      setSelectedModel(firstModel.id);
      setSelectedVariant(firstModel.variants?.[0] ?? null);
    }
  }, [models, selectedModelId, setSelectedModel, setSelectedVariant]);

  if (models.length === 0) {
    return (
      <div className="opencode-selectors">
        <button type="button" className="model-selector-trigger" disabled>
          <span className="model-selector-model-text">모델 없음</span>
        </button>
      </div>
    );
  }

  const currentHoveredProvider = hoveredProvider ?? selectedProvider;
  const filteredModels = models.filter(
    (m) => (m.providerId ?? m.id.split('/')[0]) === currentHoveredProvider
  );

  const handleModelSelect = (modelId: string, variant: string | null = null) => {
    setSelectedModel(modelId);
    setSelectedVariant(variant);
    setIsOpen(false);
  };

  return (
    <div className="opencode-selectors" ref={containerRef}>
      <div className="model-selector-container">
        <button
          type="button"
          className={`model-selector-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="model-selector-summary">
            <span className="model-selector-provider-label">{selectedProvider} /</span>
            <span className="model-selector-model-text">
              {selectedModel?.modelId ?? selectedModel?.name ?? selectedModelId?.split('/').slice(1).join('/')}
              {selectedVariant ? ` · ${selectedVariant}` : ''}
            </span>
          </div>
          <span className="model-selector-chevron">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <title>Chevron</title>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </button>

        {isOpen && (
          <div className="model-selector-dropdown">
            {/* 좌측 패널: Provider List */}
            <div className="model-selector-providers">
              {providers.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className={`model-selector-item provider-item ${
                    selectedProvider === provider ? 'selected' : ''
                  } ${currentHoveredProvider === provider ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredProvider(provider)}
                >
                  <span className="provider-name">{provider}</span>
                </button>
              ))}
            </div>

            {/* 우측 패널: Model + Variant List */}
            <div className="model-selector-models" key={currentHoveredProvider ?? 'none'}>
              {filteredModels.map((model) => {
                const isSelected = selectedModelId === model.id;
                const hasVariants = model.variants && model.variants.length > 0;

                return (
                  <div key={model.id} className="model-item-wrapper">
                    <button
                      type="button"
                      className={`model-selector-item model-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (!hasVariants) {
                          handleModelSelect(model.id);
                        }
                      }}
                    >
                      <div className="model-item-content">
                        <div className="model-item-header">
                          <span className="model-name-text">
                            {model.modelId ?? model.id.split('/').slice(1).join('/')}
                          </span>
                          {isSelected && <span className="model-check">✓</span>}
                        </div>
                        
                        {hasVariants && (
                          <div className="variant-chips">
                            {model.variants?.map((variant) => (
                              <button
                                key={variant}
                                type="button"
                                className={`variant-chip ${
                                  isSelected && selectedVariant === variant ? 'selected' : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleModelSelect(model.id, variant);
                                }}
                              >
                                {variant}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

