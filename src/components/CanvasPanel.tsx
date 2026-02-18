import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { MilkdownEditor } from './MilkdownEditor';
import { EditorToolbar } from './EditorToolbar';
import { EditorProvider } from '../context/EditorContext';
import { DiffPreview } from './DiffPreview';
import { FeatureExplorer } from './FeatureExplorer';
import { api } from '../api';
import './CanvasPanel.css';

export function CanvasPanel() {
  const { 
    canvasContent, 
    setCanvasContent,
    aiRun,
    projectPath,
    features,
    activeFeatureId,
    activeCanvasFile,
    setActiveCanvasFile,
    setAutosaveStatus,
    autosaveStatus,
    pendingCanvasPatch,
    isFileExplorerOpen,
    toggleFileExplorer,
    setCanvasTree,
    canvasWidthMode,
    setCanvasWidthMode,
  } = useStore();
  const [showOverlay, setShowOverlay] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);

  const isUpdating = aiRun?.phase === 'updating';

  useEffect(() => {
    if (isUpdating) {
      setShowOverlay(true);
      setIsClosing(false);
    } else if (showOverlay && !isUpdating) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShowOverlay(false);
        setIsClosing(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isUpdating, showOverlay]);

  useEffect(() => {
    if (!projectPath || !activeCanvasFile || useStore.getState().pendingCanvasPatch) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    setAutosaveStatus({ state: 'idle' });
    autosaveTimerRef.current = window.setTimeout(async () => {
      if (useStore.getState().pendingCanvasPatch) return;
      setAutosaveStatus({ state: 'saving', updatedAt: Date.now() });
      const result = await api.writeCanvasFile(projectPath, activeCanvasFile, canvasContent);
      if (result.success) {
        const status = { state: 'saved' as const, updatedAt: Date.now() };
        setAutosaveStatus(status);
        api.writeAutosaveStatus(projectPath, status).catch(() => undefined);
      } else {
        setAutosaveStatus({ state: 'error' as const, updatedAt: Date.now(), message: result.error ?? 'Save failed' });
      }
    }, 1000);
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [canvasContent, projectPath, activeCanvasFile, setAutosaveStatus]);

  const refreshTree = useCallback(async () => {
    if (!projectPath) return;
    const treeResult = await api.listCanvasTree(projectPath);
    if (treeResult.success && treeResult.tree) {
      setCanvasTree(treeResult.tree as any);
    }
  }, [projectPath, setCanvasTree]);

  const handleSelectCanvasFile = async (fileName: string) => {
    if (!projectPath) return;
    const result = await api.readCanvasFile(projectPath, fileName);
    if (result.success && result.content !== undefined) {
      setActiveCanvasFile(fileName);
      setCanvasContent(result.content);
    }
  };

  const activeFeatureName = activeFeatureId
    ? (features.find((feature) => feature.id === activeFeatureId)?.name ?? activeFeatureId)
    : 'No feature selected';

  return (
    <EditorProvider>
      <div className={`canvas-panel canvas-width-${canvasWidthMode}`}>
        <div className={`canvas-panel-layout ${isFileExplorerOpen ? 'with-explorer' : ''}`}>
          {isFileExplorerOpen && (
            <FeatureExplorer
              onSelectFile={handleSelectCanvasFile}
              onRefreshTree={refreshTree}
            />
          )}
          <div className="canvas-wrapper">
            <div className="canvas-header">
              <div className="header-left">
                <button
                  type="button"
                  className="explorer-toggle-btn"
                  onClick={toggleFileExplorer}
                  title="Toggle feature explorer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 1h5l1 1H14.5a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-12A.5.5 0 0 1 1.5 1zM2 5v8h12V5H2zm0-1h12V3H7.293l-1-1H2v2z"/>
                  </svg>
                </button>
                <div className="document-title-area">
                  <div className="active-feature-name" title={activeFeatureName}>
                    {activeFeatureName}
                  </div>
                </div>
              </div>
              <div className="header-right">
                <div className="canvas-width-control">
                  <button
                    type="button"
                    className={`canvas-width-btn ${canvasWidthMode === 'default' ? 'active' : ''}`}
                    onClick={() => setCanvasWidthMode('default')}
                    title="기본값"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="3" width="12" height="18" rx="2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`canvas-width-btn ${canvasWidthMode === 'wide' ? 'active' : ''}`}
                    onClick={() => setCanvasWidthMode('wide')}
                    title="넓게"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`canvas-width-btn ${canvasWidthMode === 'responsive' ? 'active' : ''}`}
                    onClick={() => setCanvasWidthMode('responsive')}
                    title="반응형"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 3 6 6-6 6" /><path d="m9 21-6-6 6-6" />
                    </svg>
                  </button>
                </div>
                {!pendingCanvasPatch && <EditorToolbar />}
                <div className={`save-status-indicator ${autosaveStatus.state}`}>
                  {autosaveStatus.state === 'saving'
                    ? 'Saving...'
                    : autosaveStatus.state === 'saved'
                      ? 'Saved'
                      : autosaveStatus.state === 'error'
                        ? 'Save failed'
                        : 'Idle'}
                </div>
              </div>
            </div>
            <div className="canvas-content">
              {pendingCanvasPatch ? (
                <DiffPreview />
              ) : (
                <MilkdownEditor />
              )}
              {showOverlay && (
                <div className={`canvas-updating-overlay ${isClosing ? 'closing' : ''}`}>
                  {!isClosing && <div className="pulse-indicator" />}
                </div>
              )}
            </div>
            {projectPath && activeCanvasFile && (
              <div className="canvas-footer">
                <span className="file-path">{projectPath}/.ai-canvas/{activeCanvasFile}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </EditorProvider>
  );
}
