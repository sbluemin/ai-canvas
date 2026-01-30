import { useState, useCallback } from 'react';
import { 
  toggleStrongCommand, 
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  turnIntoTextCommand
} from '@milkdown/preset-commonmark';
import { undoCommand, redoCommand } from '@milkdown/plugin-history';
import { callCommand } from '@milkdown/utils';
import { useEditorContext } from '../context/EditorContext';
import './EditorToolbar.css';

function UndoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
  );
}

function BoldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="6" r="1.5" fill="currentColor" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function NumberListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <text x="3" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text>
      <text x="3" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text>
      <text x="3" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text>
    </svg>
  );
}

function FormulaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <text x="2" y="17" fontSize="14" fill="currentColor" stroke="none" fontFamily="serif" fontStyle="italic">fx</text>
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function EditorToolbar() {
  const [isHeadingOpen, setIsHeadingOpen] = useState(false);
  const [selectedHeading, setSelectedHeading] = useState('제목 1');
  const { editorRef } = useEditorContext();

  const executeCommand = useCallback((command: Parameters<typeof callCommand>[0], payload?: unknown) => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      editor.action(callCommand(command, payload));
    } catch (error) {
      console.error('Command execution failed:', error);
    }
  }, [editorRef]);

  const handleUndo = () => {
    executeCommand(undoCommand.key);
  };

  const handleRedo = () => {
    executeCommand(redoCommand.key);
  };

  const handleBold = () => {
    executeCommand(toggleStrongCommand.key);
  };

  const handleItalic = () => {
    executeCommand(toggleEmphasisCommand.key);
  };

  const handleBulletList = () => {
    executeCommand(wrapInBulletListCommand.key);
  };

  const handleNumberList = () => {
    executeCommand(wrapInOrderedListCommand.key);
  };

  const handleFormula = () => {
    console.log('Formula - 추후 구현 예정');
  };

  const handleHeadingSelect = (heading: string, level: number | null) => {
    setSelectedHeading(heading);
    setIsHeadingOpen(false);
    if (level === null) {
      executeCommand(turnIntoTextCommand.key);
    } else {
      executeCommand(wrapInHeadingCommand.key, level);
    }
  };

  return (
    <div className="editor-toolbar">
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleUndo} title="실행 취소">
          <UndoIcon />
        </button>
        <button className="toolbar-btn" onClick={handleRedo} title="다시 실행">
          <RedoIcon />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <div className="heading-dropdown">
          <button 
            className="heading-btn" 
            onClick={() => setIsHeadingOpen(!isHeadingOpen)}
          >
            <span>{selectedHeading}</span>
            <ChevronDownIcon />
          </button>
          {isHeadingOpen && (
            <div className="heading-menu">
              <button onClick={() => handleHeadingSelect('제목 1', 1)}>제목 1</button>
              <button onClick={() => handleHeadingSelect('제목 2', 2)}>제목 2</button>
              <button onClick={() => handleHeadingSelect('제목 3', 3)}>제목 3</button>
              <button onClick={() => handleHeadingSelect('본문', null)}>본문</button>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleBold} title="굵게">
          <BoldIcon />
        </button>
        <button className="toolbar-btn" onClick={handleItalic} title="기울임">
          <ItalicIcon />
        </button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleBulletList} title="글머리 기호 목록">
          <BulletListIcon />
        </button>
        <button className="toolbar-btn" onClick={handleNumberList} title="번호 매기기 목록">
          <NumberListIcon />
        </button>
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleFormula} title="수식">
          <FormulaIcon />
        </button>
      </div>
    </div>
  );
}
