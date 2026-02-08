import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { MilkdownEditor } from './MilkdownEditor';
import { EditorToolbar } from './EditorToolbar';
import { EditorProvider } from '../context/EditorContext';
import { api } from '../api';
import './CanvasPanel.css';

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
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
  } = useStore();
  const [documentTitle, setDocumentTitle] = useState('AI Canvas');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showFileDropdown, setShowFileDropdown] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isUpdating = aiRun?.phase === 'updating';

  useEffect(() => {
    if (activeCanvasFile) {
      const nameWithoutExt = activeCanvasFile.replace(/\.md$/, '');
      setDocumentTitle(nameWithoutExt);
    }
  }, [activeCanvasFile]);

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
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    if (!projectPath || !activeCanvasFile) {
      alert('프로젝트가 선택되지 않았습니다.');
      return;
    }
    try {
      const result = await api.writeCanvasFile(projectPath, activeCanvasFile, canvasContent);
      if (!result.success) {
        alert(`저장 실패: ${result.error}`);
        return;
      }
      alert(`저장 완료: ${activeCanvasFile}`);
    } catch (error) {
      alert(`저장 실패: ${error}`);
    }
  };

  const handleSelectCanvasFile = async (fileName: string) => {
    if (!projectPath) return;
    setShowFileDropdown(false);
    const result = await api.readCanvasFile(projectPath, fileName);
    if (result.success && result.content !== undefined) {
      setActiveCanvasFile(fileName);
      setCanvasContent(result.content);
    }
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  return (
    <EditorProvider>
      <div className="canvas-panel">
        <div className="canvas-wrapper">
          <div className="canvas-header">
            <div className="header-left">
              <div className="document-title-area" ref={dropdownRef}>
                {isEditingTitle ? (
                  <input
                    ref={titleInputRef}
                    type="text"
                    className="title-input"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    onBlur={handleTitleSubmit}
                    onKeyDown={handleTitleKeyDown}
                  />
                ) : (
                  <div 
                    className="title-display" 
                    onClick={() => canvasFiles.length > 1 ? setShowFileDropdown(!showFileDropdown) : setIsEditingTitle(true)}
                  >
                    <span className="document-title">{documentTitle}</span>
                    {canvasFiles.length > 1 ? (
                      <button className="edit-title-btn">
                        <ChevronDownIcon />
                      </button>
                    ) : (
                      <button className="edit-title-btn" onClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}>
                        <EditIcon />
                      </button>
                    )}
                  </div>
                )}
                {showFileDropdown && canvasFiles.length > 1 && (
                  <div className="canvas-file-dropdown">
                    {canvasFiles.map((file) => (
                      <div
                        key={file}
                        className={`canvas-file-item ${file === activeCanvasFile ? 'active' : ''}`}
                        onClick={() => handleSelectCanvasFile(file)}
                      >
                        {file.replace(/\.md$/, '')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="header-right">
              <EditorToolbar />
              <div className="header-divider" />
              <div className="canvas-actions">
                <button onClick={handleSave} className="save-btn" title="저장">
                  저장
                </button>
              </div>
            </div>
          </div>
          <div className="canvas-content">
            <MilkdownEditor />
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
