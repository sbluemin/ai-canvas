import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useStore } from '../store/useStore';
import type { RuntimeStatus } from '../store/types';
import './ChatModelSelector.css';

function getRuntimeStateClass(status: RuntimeStatus | null): string {
  if (!status || status.activeRuntime === 'none') return 'missing';
  return 'global';
}

function getRuntimeLabel(status: RuntimeStatus | null): string {
  if (!status || status.activeRuntime === 'none') return 'Runtime Missing';
  return 'Global Runtime';
}

export function ChatModelSelector() {
  const {
    availableModels,
    selectedModels,
    selectedVariant,
    setSelectedModel,
    setSelectedVariant,
    modelsLoading,
    setModelsLoading,
    setAvailableModels,
    runtimeStatus,
    openOnboarding,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 중복 model.id 제거 (OpenCode 출력에서 같은 모델이 여러 번 열거될 수 있음)
  const models = useMemo(() => {
    const seen = new Set<string>();
    return availableModels.opencode.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [availableModels.opencode]);

  const selectedModelId = selectedModels.opencode;
  const selectedModel = models.find((model) => model.id === selectedModelId) ?? null;

  const providers = Array.from(
    new Set(models.map((model) => model.providerId ?? model.id.split('/')[0]).filter((value): value is string => Boolean(value)))
  ).sort();

  const selectedProvider = selectedModel?.providerId ?? selectedModelId?.split('/')[0] ?? providers[0] ?? 'opencode';
  const runtimeClass = getRuntimeStateClass(runtimeStatus);
  const runtimeLabel = getRuntimeLabel(runtimeStatus);


  const handleRefresh = useCallback(async (event?: ReactMouseEvent<HTMLButtonElement>) => {
    if (event) event.stopPropagation();

    const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
    if (!isElectron || modelsLoading) return;

    setModelsLoading(true);
    try {
      const result = await window.electronAPI.ai.fetchModels();
      if (result.success && result.models) {
        setAvailableModels(result.models);
      }
    } catch (error) {
      console.error('Model fetch error:', error);
    } finally {
      setModelsLoading(false);
    }
  }, [modelsLoading, setModelsLoading, setAvailableModels]);

  useEffect(() => {
    if (isOpen) {
      setHoveredProvider(selectedProvider);
    }
  }, [isOpen, selectedProvider]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!selectedModelId && models.length > 0) {
      const firstModel = models[0];
      setSelectedModel(firstModel.id);
      setSelectedVariant(firstModel.variants?.[0] ?? null);
    }
  }, [models, selectedModelId, setSelectedModel, setSelectedVariant]);

  const toggleDropdown = () => {
    if (models.length === 0) {
      openOnboarding();
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const currentHoveredProvider = hoveredProvider ?? selectedProvider;
  const filteredModels = models.filter(
    (model) => (model.providerId ?? model.id.split('/')[0]) === currentHoveredProvider
  );

  const handleModelSelect = (modelId: string, variant: string | null = null) => {
    setSelectedModel(modelId);
    setSelectedVariant(variant);
    setIsOpen(false);
  };

  const modelName =
    selectedModel?.modelId ??
    selectedModel?.name ??
    selectedModelId?.split('/').slice(1).join('/') ??
    (modelsLoading ? 'Loading models...' : '모델 없음');

  return (
    <div className={`chat-model-selector${isOpen ? ' open' : ''}`} ref={containerRef}>
      <button
        type="button"
        className="chat-model-runtime-btn"
        onClick={openOnboarding}
        title={`Runtime: ${runtimeLabel}`}
        aria-label="Runtime 설정 열기"
      >
        <span className={`chat-model-runtime-dot ${runtimeClass}`} />
      </button>

      <button
        type="button"
        className={`chat-model-main-btn${models.length === 0 ? ' disabled' : ''}`}
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={runtimeLabel}
      >
        <span className="chat-model-main-provider">{selectedProvider}</span>
        <span className="chat-model-main-name">{modelName}</span>
        {selectedVariant && <span className="chat-model-main-variant">{selectedVariant}</span>}
      </button>

      <button
        type="button"
        className={`chat-model-toggle-btn${isOpen ? ' open' : ''}`}
        onClick={toggleDropdown}
        aria-label={isOpen ? '모델 선택 닫기' : '모델 선택 열기'}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <button
        type="button"
        className="chat-model-refresh-btn"
        onClick={handleRefresh}
        title="모델 목록 새로고침"
        aria-label="모델 목록 새로고침"
      >
        <svg className={modelsLoading ? 'spinning' : ''} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </button>

      {isOpen && models.length > 0 && (
        <div className="chat-model-dropdown" role="dialog" aria-label="모델 선택">
          <div className="chat-model-panels">
            <div className="chat-model-provider-list" role="listbox" aria-label="Provider 목록">
              {providers.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className={`chat-model-provider-item${selectedProvider === provider ? ' selected' : ''}${currentHoveredProvider === provider ? ' hovered' : ''}`}
                  onMouseEnter={() => setHoveredProvider(provider)}
                  onFocus={() => setHoveredProvider(provider)}
                  onClick={() => setHoveredProvider(provider)}
                  aria-pressed={currentHoveredProvider === provider}
                >
                  {provider}
                </button>
              ))}
            </div>

            <div className="chat-model-model-list" key={currentHoveredProvider ?? 'none'}>
              {filteredModels.length === 0 && (
                <div className="chat-model-empty">선택 가능한 모델이 없습니다.</div>
              )}

              {filteredModels.map((model) => {
                const isSelectedModel = selectedModelId === model.id;
                const variants = model.variants ?? [];
                const hasVariants = variants.length > 0;

                return (
                  <div key={model.id} className={`chat-model-row${isSelectedModel ? ' selected' : ''}`}>
                    <button
                      type="button"
                      className={`chat-model-row-main${hasVariants ? ' disabled' : ''}`}
                      disabled={hasVariants}
                      onClick={() => {
                        if (!hasVariants) {
                          handleModelSelect(model.id);
                        }
                      }}
                    >
                      <span className="chat-model-row-name">
                        {model.modelId ?? model.id.split('/').slice(1).join('/')}
                      </span>
                      {isSelectedModel && (!hasVariants || selectedVariant === null) && (
                        <span className="chat-model-check">✓</span>
                      )}
                    </button>

                    {hasVariants && (
                      <div className="chat-model-variant-list">
                        {variants.map((variant) => {
                          const isSelectedVariant = isSelectedModel && selectedVariant === variant;
                          return (
                            <button
                              key={variant}
                              type="button"
                              className={`chat-model-variant-chip${isSelectedVariant ? ' selected' : ''}`}
                              onClick={() => handleModelSelect(model.id, variant)}
                              aria-pressed={isSelectedVariant}
                            >
                              {variant}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="chat-model-footer">
            <div className="chat-model-runtime-info">
              <span className={`chat-model-runtime-dot-small ${runtimeClass}`} />
              <span className="chat-model-runtime-text">{runtimeLabel}</span>
            </div>
            <button
              type="button"
              className="chat-model-setup-btn"
              onClick={() => {
                openOnboarding();
                setIsOpen(false);
              }}
            >
              Setup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
