import { useEffect, useRef, useState } from 'react';
import { TooltipProvider } from '@milkdown/plugin-tooltip';
import { EditorView } from '@milkdown/prose/view';
import './SelectionTooltip.css';

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L9.5 9.5L2 12L9.5 14.5L12 22L14.5 14.5L22 12L14.5 9.5L12 2Z" fill="url(#sparkle-gradient)" />
      <defs>
        <linearGradient id="sparkle-gradient" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#4285f4" />
          <stop offset="0.5" stopColor="#9b72cb" />
          <stop offset="1" stopColor="#d96570" />
        </linearGradient>
      </defs>
    </svg>
  );
}

interface SelectionTooltipProps {
  editorView: EditorView | null;
}

export const SelectionTooltip = ({ editorView }: SelectionTooltipProps) => {
  const tooltipProvider = useRef<TooltipProvider | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState('');
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editorView) {
      return;
    }

    tooltipProvider.current = new TooltipProvider({
      content: container,
      shouldShow: (view) => {
        const { state } = view;
        const { selection } = state;
        const { empty, from, to } = selection;

        if (empty) {
          return false;
        }

        const text = state.doc.textBetween(from, to, ' ').trim();
        
        if (text.length < 2) {
          return false;
        }

        setSelectedText(text);
        return true;
      },
    });

    const updateTooltip = () => {
      if (tooltipProvider.current && editorView) {
        tooltipProvider.current.update(editorView);
      }
    };

    updateTooltip();

    return () => {
      tooltipProvider.current?.destroy();
    };
  }, [editorView]);

  useEffect(() => {
    if (tooltipProvider.current && editorView) {
      tooltipProvider.current.update(editorView);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('AI 질문 제출:', inputValue, '선택된 텍스트:', selectedText);
    setInputValue('');
  };

  const handleInputMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const truncatedText = selectedText.length > 50 
    ? selectedText.substring(0, 50) + '...' 
    : selectedText;

  return (
    <div ref={containerRef} className="selection-tooltip-container">
      <form className="selection-tooltip" onSubmit={handleSubmit}>
        <div className="tooltip-icon">
          <SparkleIcon />
        </div>
        <input
          type="text"
          className="tooltip-input"
          placeholder={`"${truncatedText}" 에 대해 물어보기`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onMouseDown={handleInputMouseDown}
        />
      </form>
    </div>
  );
};
