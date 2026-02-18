import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { MilkdownEditor } from './MilkdownEditor';
import { EditorToolbar } from './EditorToolbar';
import { EditorProvider } from '../context/EditorContext';
import { DiffPreview } from './DiffPreview';
import { FileExplorer } from './FileExplorer';
import { api } from '../api';
import type { CanvasWidthMode } from '../store/types';
import './CanvasPanel.css';

interface ContextMenuState {
  x: number;
  y: number;
  file: string;
}

export function CanvasPanel() {
  const { 
    canvasContent, 
    setCanvasContent,
    aiRun,
    projectPath,
    canvasFiles,
    activeCanvasFile,
    setActiveCanvasFile,
    setCanvasFiles,
    addToast,
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
  const [draggingFile, setDraggingFile] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

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

  const handleRenameFile = async (targetFile?: string) => {
    const file = targetFile ?? activeCanvasFile;
    if (!projectPath || !file) return;

    const currentName = file.replace(/\.md$/, '');
    const nextName = prompt('Enter new file name', currentName)?.trim();
    if (!nextName || nextName === currentName) return;

    const normalized = nextName.endsWith('.md') ? nextName : `${nextName}.md`;
    const result = await api.renameCanvasFile(projectPath, file, normalized);
    if (!result.success) {
      addToast('error', `Rename failed: ${result.error}`);
      return;
    }

    const updatedFiles = canvasFiles.map((f) => (f === file ? normalized : f));
    setCanvasFiles(updatedFiles);
    if (activeCanvasFile === file) {
      setActiveCanvasFile(normalized);
    }
    await refreshTree();
    addToast('success', `Renamed to: ${normalized}`);
  };

  const handleCreateFile = async () => {
    if (!projectPath) return;

    const name = prompt('Enter new file name')?.trim();
    if (!name) return;

    const normalized = name.endsWith('.md') ? name : `${name}.md`;
    if (canvasFiles.includes(normalized)) {
      addToast('error', `File "${normalized}" already exists.`);
      return;
    }

    const result = await api.writeCanvasFile(projectPath, normalized, `# ${name.replace(/\.md$/, '')}\n\nStart writing here.\n`);
    if (!result.success) {
      addToast('error', `Create failed: ${result.error}`);
      return;
    }

    setCanvasFiles([...canvasFiles, normalized]);
    await handleSelectCanvasFile(normalized);
    await refreshTree();
    addToast('success', `Created: ${normalized}`);
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!projectPath) return;

    const result = await api.deleteCanvasFile(projectPath, fileName);
    if (!result.success) {
      addToast('error', `Delete failed: ${result.error}`);
      return;
    }

    const updatedFiles = canvasFiles.filter((f) => f !== fileName);
    setCanvasFiles(updatedFiles);

    if (activeCanvasFile === fileName) {
      if (updatedFiles.length > 0) {
        await handleSelectCanvasFile(updatedFiles[0]);
      } else {
        setActiveCanvasFile(null);
        setCanvasContent('');
      }
    }
    await refreshTree();
    setDeleteConfirm(null);
    addToast('success', `Deleted: ${fileName}`);
  };

  const handleDuplicateFile = async (fileName: string) => {
    if (!projectPath) return;

    const readResult = await api.readCanvasFile(projectPath, fileName);
    if (!readResult.success || readResult.content === undefined) {
      addToast('error', `Read failed: ${readResult.error}`);
      return;
    }

    const baseName = fileName.replace(/\.md$/, '');
    let copyName = `${baseName} (copy).md`;
    let counter = 1;
    while (canvasFiles.includes(copyName)) {
      counter++;
      copyName = `${baseName} (copy ${counter}).md`;
    }

    const writeResult = await api.writeCanvasFile(projectPath, copyName, readResult.content);
    if (!writeResult.success) {
      addToast('error', `Duplicate failed: ${writeResult.error}`);
      return;
    }

    setCanvasFiles([...canvasFiles, copyName]);
    await refreshTree();
    addToast('success', `Duplicated: ${copyName}`);
  };

  const handleTabClick = (file: string) => {
    if (file === activeCanvasFile) {
      handleRenameFile();
    } else {
      handleSelectCanvasFile(file);
    }
  };

  const handleTabContextMenu = (e: React.MouseEvent, file: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  };

  const handleDragStart = (fileName: string) => {
    setDraggingFile(fileName);
  };

  const handleDrop = (targetFile: string) => {
    if (!draggingFile || draggingFile === targetFile) return;
    const currentIndex = canvasFiles.indexOf(draggingFile);
    const targetIndex = canvasFiles.indexOf(targetFile);
    if (currentIndex === -1 || targetIndex === -1) return;
    const nextFiles = [...canvasFiles];
    nextFiles.splice(currentIndex, 1);
    nextFiles.splice(targetIndex, 0, draggingFile);
    setCanvasFiles(nextFiles);
    setDraggingFile(null);
  };

  const handleWidthModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCanvasWidthMode(event.target.value as CanvasWidthMode);
  };

  return (
    <EditorProvider>
      <div className={`canvas-panel canvas-width-${canvasWidthMode}`}>
        <div className={`canvas-panel-layout ${isFileExplorerOpen ? 'with-explorer' : ''}`}>
          {isFileExplorerOpen && (
            <FileExplorer
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
                  title="Toggle file explorer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 1h5l1 1H14.5a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-12A.5.5 0 0 1 1.5 1zM2 5v8h12V5H2zm0-1h12V3H7.293l-1-1H2v2z"/>
                  </svg>
                </button>
                <div className="document-title-area">
                  <div className="canvas-tabs">
                    {canvasFiles.map((file) => {
                      const displayName = (file.includes('/') ? file.split('/').pop() : file)?.replace(/\.md$/, '') ?? file;
                      return (
                        <button
                          key={file}
                          type="button"
                          className={`canvas-tab ${file === activeCanvasFile ? 'active' : ''}`}
                          draggable
                          onDragStart={() => handleDragStart(file)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop(file)}
                          onDragEnd={() => setDraggingFile(null)}
                          onClick={() => handleTabClick(file)}
                          onContextMenu={(e) => handleTabContextMenu(e, file)}
                          title={file}
                        >
                          {displayName}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className="canvas-tab canvas-tab-add"
                      onClick={handleCreateFile}
                      title="New canvas file"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="header-right">
                <div className="canvas-width-control">
                  <label htmlFor="canvas-width-mode">Width</label>
                  <select
                    id="canvas-width-mode"
                    value={canvasWidthMode}
                    onChange={handleWidthModeChange}
                  >
                    <option value="default">기본값</option>
                    <option value="wide">넓게</option>
                    <option value="responsive">반응형</option>
                  </select>
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

        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="tab-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              type="button"
              onClick={() => {
                handleRenameFile(contextMenu.file);
                setContextMenu(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                handleDuplicateFile(contextMenu.file);
                setContextMenu(null);
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setDeleteConfirm(contextMenu.file);
                setContextMenu(null);
              }}
            >
              Delete
            </button>
          </div>
        )}

        {deleteConfirm && (
          <div className="delete-confirm-overlay" onClick={() => setDeleteConfirm(null)}>
            <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <p>Delete <strong>{deleteConfirm}</strong>?</p>
              <p className="delete-confirm-hint">This action cannot be undone.</p>
              <div className="delete-confirm-actions">
                <button type="button" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => handleDeleteFile(deleteConfirm)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </EditorProvider>
  );
}
