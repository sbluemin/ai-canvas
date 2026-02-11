import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { MilkdownEditor } from './MilkdownEditor';
import { EditorToolbar } from './EditorToolbar';
import { EditorProvider } from '../context/EditorContext';
import { DiffPreview } from './DiffPreview';
import { api } from '../api';
import './CanvasPanel.css';

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
  } = useStore();
  const [showOverlay, setShowOverlay] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [draggingFile, setDraggingFile] = useState<string | null>(null);
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
    // pending 상태에서는 autosave 억제 (최신 상태 참조)
    if (!projectPath || !activeCanvasFile || useStore.getState().pendingCanvasPatch) return;
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }
    setAutosaveStatus({ state: 'idle' });
    autosaveTimerRef.current = window.setTimeout(async () => {
      // 저장 직전에도 pending 상태 재확인
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

  const handleSelectCanvasFile = async (fileName: string) => {
    if (!projectPath) return;
    const result = await api.readCanvasFile(projectPath, fileName);
    if (result.success && result.content !== undefined) {
      setActiveCanvasFile(fileName);
      setCanvasContent(result.content);
    }
  };

  const handleRenameFile = async () => {
    if (!projectPath || !activeCanvasFile) return;

    const currentName = activeCanvasFile.replace(/\.md$/, '');
    const nextName = prompt('Enter new file name', currentName)?.trim();
    if (!nextName || nextName === currentName) return;

    const normalized = nextName.endsWith('.md') ? nextName : `${nextName}.md`;
    const result = await api.renameCanvasFile(projectPath, activeCanvasFile, normalized);
    if (!result.success) {
      addToast('error', `Rename failed: ${result.error}`);
      return;
    }

    const updatedFiles = canvasFiles.map((file) => (file === activeCanvasFile ? normalized : file));
    setCanvasFiles(updatedFiles);
    setActiveCanvasFile(normalized);
    addToast('success', `Renamed to: ${normalized}`);
  };

  const handleTabClick = (file: string) => {
    if (file === activeCanvasFile) {
      // 이미 활성화된 탭 클릭 시 이름 변경 모드
      handleRenameFile();
    } else {
      handleSelectCanvasFile(file);
    }
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

  return (
    <EditorProvider>
      <div className="canvas-panel">
        <div className="canvas-wrapper">
          <div className="canvas-header">
            <div className="header-left">
              <div className="document-title-area">
                <div className="canvas-tabs">
                  {canvasFiles.map((file) => (
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
                    >
                      {file.replace(/\.md$/, '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="header-right">
              {/* Diff 미리보기 모드가 아닐 때만 EditorToolbar 표시 */}
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
            {/* Diff 미리보기 모드 또는 에디터 모드 */}
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
    </EditorProvider>
  );
}
