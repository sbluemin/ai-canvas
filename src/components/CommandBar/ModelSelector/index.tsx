import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../../store/useStore';
import { RuntimeStatus } from '../../../store/types';
import './ModelSelector.css';

function getRuntimeStateClass(status: RuntimeStatus | null): string {
  if (!status || status.activeRuntime === 'none') return 'missing';
  if (status.activeRuntime === 'global') return 'global';
  return 'project';
}

function getRuntimeLabel(status: RuntimeStatus | null): string {
  if (!status || status.activeRuntime === 'none') return 'Runtime Missing';
  if (status.activeRuntime === 'global') return 'Global Runtime';
  return 'Project Runtime';
}

export function ModelSelector() {
  const {
    availableModels, selectedModels, selectedVariant, setSelectedModel, setSelectedVariant,
    modelsLoading, setModelsLoading, setAvailableModels,
    runtimeStatus, openOnboarding,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [chevronHovered, setChevronHovered] = useState(false);
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const models = availableModels.opencode;
  const selectedModelId = selectedModels.opencode;
  const selectedModel = models.find((m) => m.id === selectedModelId) ?? null;

  const providers = Array.from(
    new Set(models.map((m) => m.providerId ?? m.id.split('/')[0]).filter((value): value is string => !!value))
  ).sort();

  const selectedProvider = selectedModel?.providerId ?? selectedModelId?.split('/')[0] ?? providers[0] ?? null;

  const stateClass = getRuntimeStateClass(runtimeStatus);
  const runtimeLabel = getRuntimeLabel(runtimeStatus);

  // Refresh 로직 (ModelRefreshButton에서 통합)
  const handleRefresh = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  // 모델이 없는 경우 — Runtime dot + 새로고침만 표시
  if (models.length === 0 && !modelsLoading) {
    return (
      <div className="opencode-selectors" ref={containerRef}>
        <button type="button" className="runtime-dot-zone" onClick={openOnboarding} title="Runtime Settings">
          <span className={`runtime-dot ${stateClass}`} />
        </button>
        <span className="capsule-separator" />
        <span className="model-selector-trigger disabled">
          <span className="model-selector-model-text">모델 없음</span>
        </span>
        <button type="button" className="model-selector-refresh-zone" onClick={handleRefresh} title="모델 목록 새로고침">
          <svg className={modelsLoading ? 'spinning' : ''} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
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

  // chevron hover 시에만 refresh 아이콘 표시 (드롭다운 열린 상태에서는 항상 chevron)
  const showRefresh = (chevronHovered && !isOpen) || modelsLoading;

  return (
    <div className="opencode-selectors" ref={containerRef}>
      {/* 좌측: Runtime Dot 영역 (클릭 → 온보딩) */}
      <button type="button" className="runtime-dot-zone" onClick={openOnboarding} title="Runtime Settings">
        <span className={`runtime-dot ${stateClass}`} />
      </button>

      {/* 구분선 */}
      <span className="capsule-separator" />

      {/* 우측: Model 선택 영역 */}
      <div className="model-selector-container">
        {/* Split Button: 텍스트 클릭 → 드롭다운 토글, chevron 클릭 → refresh 또는 토글 */}
        <div className={`model-selector-trigger ${isOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="model-selector-main-btn"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className="model-selector-provider-label">{selectedProvider} /</span>
            <span className="model-selector-model-text">
              {selectedModel?.modelId ?? selectedModel?.name ?? selectedModelId?.split('/').slice(1).join('/')}
              {selectedVariant ? ` · ${selectedVariant}` : ''}
            </span>
          </button>
          <button
            type="button"
            className={`model-selector-chevron-btn ${showRefresh ? 'refresh-mode' : ''}`}
            onMouseEnter={() => setChevronHovered(true)}
            onMouseLeave={() => setChevronHovered(false)}
            onClick={() => {
              if (showRefresh) {
                handleRefresh();
              } else {
                setIsOpen(!isOpen);
              }
            }}
            title={showRefresh ? '모델 목록 새로고침' : '모델 선택'}
          >
            {showRefresh ? (
              <svg className={modelsLoading ? 'spinning' : ''} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </button>
        </div>

        {isOpen && (
          <div className="model-selector-dropdown">
            <div className="model-selector-panels">
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

            {/* 드롭다운 Footer: 런타임 상세 */}
            <div className="model-selector-footer">
              <div className="footer-runtime-info">
                <span className={`runtime-dot-small ${stateClass}`} />
                <span className="footer-runtime-label">{runtimeLabel}</span>
              </div>
              <button
                type="button"
                className="footer-setup-btn"
                onClick={(e) => {
                  e.stopPropagation();
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
    </div>
  );
}
