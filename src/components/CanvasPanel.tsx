import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { MilkdownEditor } from './MilkdownEditor';
import { EditorToolbar } from './EditorToolbar';
import { EditorProvider } from '../context/EditorContext';
import { FeatureExplorer } from './FeatureExplorer';
import { api } from '../api';
import { WritingGoal } from '../store/types';
import {
  composeSddContentForSave,
  detectSddPhase,
  getSddPhaseFromFilePath,
  getSddPhaseTitle,
  getSddWritingGoal,
} from '../utils/sddDocument';
import './CanvasPanel.css';

function normalizeWritingGoal(input: unknown): WritingGoal | null {
  if (!input || typeof input !== 'object') return null;
  const goal = input as Partial<WritingGoal>;
  if (
    typeof goal.purpose !== 'string'
    || typeof goal.audience !== 'string'
    || typeof goal.tone !== 'string'
    || (goal.targetLength !== 'short' && goal.targetLength !== 'medium' && goal.targetLength !== 'long')
  ) {
    return null;
  }

  return {
    purpose: goal.purpose,
    audience: goal.audience,
    tone: goal.tone,
    targetLength: goal.targetLength,
  };
}

function extractWritingGoalFromMeta(meta: unknown): WritingGoal | null {
  if (!meta || typeof meta !== 'object') {
    return null;
  }
  const value = (meta as { writingGoal?: unknown }).writingGoal;
  return normalizeWritingGoal(value);
}

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
    setActiveWritingGoal,
    autosaveStatus,
    isFileExplorerOpen,
    toggleFileExplorer,
    setCanvasTree,
    canvasWidthMode,
    setCanvasWidthMode,
  } = useStore();
  const [showOverlay, setShowOverlay] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const latestContentRef = useRef(canvasContent);
  const isDirtyRef = useRef(false);

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
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isUpdating, showOverlay]);

  // canvasContent 변경 시 dirty 플래그만 갱신 (파일 저장은 blur 시 수행)
  useEffect(() => {
    latestContentRef.current = canvasContent;
    isDirtyRef.current = true;
  }, [canvasContent]);

  // 실제 저장 로직 — blur, 파일 전환, beforeunload 시 호출
  // Zustand getState()로 최신 콘텐츠를 동기적으로 읽어 blur 타이밍 이슈 방지
  const saveNow = useCallback(async () => {
    const path = projectPath;
    const file = activeCanvasFile;
    if (!path || !file || !isDirtyRef.current) return;
    isDirtyRef.current = false;
    const content = useStore.getState().canvasContent;
    const sddPhase = getSddPhaseFromFilePath(file);
    const contentToSave = sddPhase ? composeSddContentForSave(sddPhase, content) : content;
    setAutosaveStatus({ state: 'saving', updatedAt: Date.now() });
    const result = await api.writeCanvasFile(path, file, contentToSave);
    if (result.success) {
      const status = { state: 'saved' as const, updatedAt: Date.now() };
      setAutosaveStatus(status);
      api.writeAutosaveStatus(path, status).catch(() => undefined);
    } else {
      setAutosaveStatus({ state: 'error' as const, updatedAt: Date.now(), message: result.error ?? 'Save failed' });
    }
  }, [projectPath, activeCanvasFile, setAutosaveStatus]);

  const handlePanelFocusOut = useCallback((event: FocusEvent) => {
    const panel = panelRef.current;
    if (!panel) return;

    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && panel.contains(nextTarget)) return;

    void saveNow();
  }, [saveNow]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    panel.addEventListener('focusout', handlePanelFocusOut);
    return () => panel.removeEventListener('focusout', handlePanelFocusOut);
  }, [handlePanelFocusOut]);

  // 앱 종료/새로고침 시 미저장 콘텐츠 보호
  useEffect(() => {
    const handleBeforeUnload = () => { void saveNow(); };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveNow]);

  const refreshTree = useCallback(async () => {
    if (!projectPath) return;
    const treeResult = await api.listCanvasTree(projectPath);
    if (treeResult.success && treeResult.tree) {
      setCanvasTree(treeResult.tree as any);
    }
  }, [projectPath, setCanvasTree]);

  const handleSelectCanvasFile = async (fileName: string) => {
    if (!projectPath) return;
    // 파일 전환 전 현재 파일 저장
    await saveNow();
    const result = await api.readCanvasFile(projectPath, fileName);
    if (result.success && result.content !== undefined) {
      setActiveCanvasFile(fileName);
      setCanvasContent(result.content);

      const sddPhase = detectSddPhase(fileName, result.content);
      if (sddPhase) {
        setActiveWritingGoal(getSddWritingGoal(sddPhase));
        return;
      }

      if (projectPath && activeFeatureId) {
        const metaResult = await api.readFeatureMeta(projectPath, activeFeatureId);
        if (metaResult.success) {
          setActiveWritingGoal(extractWritingGoalFromMeta(metaResult.meta));
        } else {
          setActiveWritingGoal(null);
        }
      }
    }
  };

  const activeFeatureName = activeFeatureId
    ? (features.find((feature) => feature.id === activeFeatureId)?.name ?? activeFeatureId)
    : 'No feature selected';
  const activeSddPhase = activeCanvasFile ? getSddPhaseFromFilePath(activeCanvasFile) : null;

  return (
    <EditorProvider>
      <div ref={panelRef} className={`canvas-panel canvas-width-${canvasWidthMode}`} tabIndex={-1}>
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
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M1.5 1h5l1 1H14.5a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-12A.5.5 0 0 1 1.5 1zM2 5v8h12V5H2zm0-1h12V3H7.293l-1-1H2v2z"/>
                  </svg>
                </button>
                <div className="document-title-area">
                  <div className="active-feature-name" title={activeFeatureName}>
                    {activeFeatureName}
                  </div>
                  {activeSddPhase && (
                    <div className="canvas-sdd-phase-badge" title={`SDD phase: ${getSddPhaseTitle(activeSddPhase)}`}>
                      <span className={`canvas-sdd-phase-dot canvas-sdd-phase-dot-${activeSddPhase}`} aria-hidden="true" />
                      <span className="canvas-sdd-phase-text">SDD · {getSddPhaseTitle(activeSddPhase)}</span>
                    </div>
                  )}
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="6" y="3" width="12" height="18" rx="2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`canvas-width-btn ${canvasWidthMode === 'wide' ? 'active' : ''}`}
                    onClick={() => setCanvasWidthMode('wide')}
                    title="넓게"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`canvas-width-btn ${canvasWidthMode === 'responsive' ? 'active' : ''}`}
                    onClick={() => setCanvasWidthMode('responsive')}
                    title="반응형"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m15 3 6 6-6 6" /><path d="m9 21-6-6 6-6" />
                    </svg>
                  </button>
                </div>
                <EditorToolbar />
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
              <MilkdownEditor />
              {showOverlay && (
                <div className={`canvas-updating-overlay ${isClosing ? 'closing' : ''}`}>
                  {!isClosing && (
                    <div className="overlay-content">
                      <div className="pulse-indicator">
                        <div className="pulse-orbit" />
                        <div className="pulse-orbit-secondary" />
                        <div className="pulse-core" />
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                        </svg>
                      </div>
                      <span className="updating-text">Updating</span>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </EditorProvider>
  );
}
