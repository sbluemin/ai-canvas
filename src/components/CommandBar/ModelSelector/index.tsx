import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../../store/useStore';
import './ModelSelector.css';

type MenuType = 'provider' | 'model' | 'variant' | null;

export function ModelSelector() {
  const { availableModels, selectedModels, selectedVariant, setSelectedModel, setSelectedVariant } = useStore();
  const [openMenu, setOpenMenu] = useState<MenuType>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const models = availableModels.opencode;
  const selectedModelId = selectedModels.opencode;
  const selectedModel = models.find((m) => m.id === selectedModelId) ?? null;
  const providers = Array.from(
    new Set(models.map((m) => m.providerId ?? m.id.split('/')[0]).filter((value): value is string => !!value))
  ).sort();
  const selectedProvider = selectedModel?.providerId ?? selectedModelId?.split('/')[0] ?? providers[0] ?? null;
  const providerModels = selectedProvider
    ? models.filter((model) => (model.providerId ?? model.id.split('/')[0]) === selectedProvider)
    : models;
  const variants = selectedModel?.variants ?? [];
  const effectiveVariant = selectedVariant && variants.includes(selectedVariant) ? selectedVariant : null;

  useEffect(() => {
    if (!selectedModelId && providerModels.length > 0) {
      setSelectedModel(providerModels[0].id);
      setSelectedVariant(providerModels[0].variants?.[0] ?? null);
    }
  }, [providerModels, selectedModelId, setSelectedModel, setSelectedVariant]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    if (openMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenu]);

  if (models.length === 0) {
    return (
      <div className="opencode-selectors" ref={containerRef}>
        <button type="button" className="model-selector-trigger" disabled>
          Provider 없음
        </button>
        <button type="button" className="model-selector-trigger" disabled>
          Model 없음
        </button>
        <button type="button" className="model-selector-trigger" disabled>
          Variant 없음
        </button>
      </div>
    );
  }

  return (
    <div className="opencode-selectors" ref={containerRef}>
      <div className="model-selector">
        <button
          type="button"
          className={`model-selector-trigger ${openMenu === 'provider' ? 'open' : ''}`}
          onClick={() => setOpenMenu((prev) => (prev === 'provider' ? null : 'provider'))}
        >
          <span className="model-selector-label">Provider</span>
          <span className="model-selector-trigger-text">{selectedProvider ?? '선택 없음'}</span>
          <span className="model-selector-chevron">▾</span>
        </button>
        {openMenu === 'provider' && (
          <div className="model-selector-dropdown">
            <div className="model-selector-list">
              {providers.map((provider) => (
                <button
                  key={provider}
                  className={`model-selector-item ${selectedProvider === provider ? 'selected' : ''}`}
                  onClick={() => {
                    const firstModel = models.find((model) => (model.providerId ?? model.id.split('/')[0]) === provider);
                    if (firstModel) {
                      setSelectedModel(firstModel.id);
                      setSelectedVariant(firstModel.variants?.[0] ?? null);
                    }
                    setOpenMenu(null);
                  }}
                >
                  <span className="model-name">{provider}</span>
                  {selectedProvider === provider && <span className="model-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="model-selector">
        <button
          type="button"
          className={`model-selector-trigger ${openMenu === 'model' ? 'open' : ''}`}
          onClick={() => setOpenMenu((prev) => (prev === 'model' ? null : 'model'))}
        >
          <span className="model-selector-label">Model</span>
          <span className="model-selector-trigger-text">{selectedModel?.modelId ?? selectedModel?.name ?? selectedModelId ?? '선택 없음'}</span>
          <span className="model-selector-chevron">▾</span>
        </button>
        {openMenu === 'model' && (
          <div className="model-selector-dropdown">
            <div className="model-selector-list">
              {providerModels.map((model) => (
                <button
                  key={model.id}
                  className={`model-selector-item ${selectedModelId === model.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedModel(model.id);
                    setSelectedVariant(model.variants?.[0] ?? null);
                    setOpenMenu(null);
                  }}
                >
                  <span className="model-name">{model.modelId ?? model.id.split('/').slice(1).join('/')}</span>
                  {selectedModelId === model.id && <span className="model-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="model-selector">
        <button
          type="button"
          className={`model-selector-trigger ${openMenu === 'variant' ? 'open' : ''}`}
          onClick={() => setOpenMenu((prev) => (prev === 'variant' ? null : 'variant'))}
          disabled={!selectedModel || variants.length === 0}
        >
          <span className="model-selector-label">Variant</span>
          <span className="model-selector-trigger-text">{effectiveVariant ?? 'default'}</span>
          <span className="model-selector-chevron">▾</span>
        </button>
        {openMenu === 'variant' && variants.length > 0 && (
          <div className="model-selector-dropdown">
            <div className="model-selector-list">
              {variants.map((variant) => (
                <button
                  key={variant}
                  className={`model-selector-item ${effectiveVariant === variant ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedVariant(variant);
                    setOpenMenu(null);
                  }}
                >
                  <span className="model-name">{variant}</span>
                  {effectiveVariant === variant && <span className="model-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
