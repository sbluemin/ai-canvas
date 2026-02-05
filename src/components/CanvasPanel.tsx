import { useState, useRef, useEffect } from 'react';
import { Gemini, OpenAI, Claude } from '@lobehub/icons';
import { useStore } from '../store/useStore';
import { AiProvider } from '../types/chat';
import { MilkdownEditor } from './MilkdownEditor';
import { EditorToolbar } from './EditorToolbar';
import { EditorProvider } from '../context/EditorContext';
import { api } from '../api';
import './CanvasPanel.css';

const providers: { id: AiProvider; name: string; Icon: any }[] = [
  { id: 'gemini', name: 'Gemini', Icon: Gemini.Color || Gemini },
  { id: 'openai', name: 'OpenAI', Icon: OpenAI },
  { id: 'anthropic', name: 'Anthropic', Icon: Claude.Color || Claude },
];

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function CanvasPanel() {
  const { canvasContent, currentFilePath, setCurrentFilePath, aiRun, activeProvider, setActiveProvider } = useStore();
  const [documentTitle, setDocumentTitle] = useState('AI Canvas - 재사용 가능한 코어 아키텍처');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);

  const isUpdating = aiRun?.phase === 'updating';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (providerMenuRef.current && !providerMenuRef.current.contains(event.target as Node)) {
        setIsProviderMenuOpen(false);
      }
    }

    if (isProviderMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProviderMenuOpen]);

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

  const handleSave = async () => {
    try {
      let path = currentFilePath;
      if (!path) {
        const result = await api.showSaveDialog();
        if (!result) return;
        path = result;
        setCurrentFilePath(path);
      }
      await api.writeFile(path, canvasContent);
      alert(`저장 완료: ${path}`);
    } catch (error) {
      alert(`저장 실패: ${error}`);
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
              <div className="provider-select" ref={providerMenuRef}>
                <button 
                  className={`provider-badge-btn ${isProviderMenuOpen ? 'active' : ''}`}
                  onClick={() => setIsProviderMenuOpen(!isProviderMenuOpen)}
                >
                  {(() => {
                    const active = providers.find(p => p.id === activeProvider);
                    return active ? <active.Icon size={20} /> : null;
                  })()}
                  <span className="provider-name">
                    {providers.find(p => p.id === activeProvider)?.name}
                  </span>
                  <svg className="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                
                {isProviderMenuOpen && (
                  <div className="provider-dropdown">
                    {providers.map((provider) => (
                      <button
                        key={provider.id}
                        className={`provider-option ${activeProvider === provider.id ? 'selected' : ''}`}
                        onClick={() => {
                          setActiveProvider(provider.id);
                          setIsProviderMenuOpen(false);
                        }}
                      >
                        <provider.Icon size={18} />
                        <span>{provider.name}</span>
                        {activeProvider === provider.id && (
                          <svg className="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="document-title-area">
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
                  <div className="title-display" onClick={() => setIsEditingTitle(true)}>
                    <span className="document-title">{documentTitle}</span>
                    <button className="edit-title-btn">
                      <EditIcon />
                    </button>
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
          {currentFilePath && (
            <div className="canvas-footer">
              <span className="file-path">{currentFilePath}</span>
            </div>
          )}
        </div>
      </div>
    </EditorProvider>
  );
}
