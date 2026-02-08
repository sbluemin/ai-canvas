import { useEffect, useRef, useState } from 'react';
import { TooltipProvider } from '@milkdown/plugin-tooltip';
import { EditorView } from '@milkdown/prose/view';
import { TextSelection } from '@milkdown/prose/state';
import { useStore } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import './SelectionAiPopup.css';

function AiMarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 512 512" fill="none" role="img" aria-label="AI Canvas Mark">
      <defs>
        <linearGradient id="aic-grad-popup" x1="100" y1="400" x2="400" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D8B4FE"/>
          <stop offset="0.5" stopColor="#818CF8"/>
          <stop offset="1" stopColor="#93C5FD"/>
        </linearGradient>
        <filter id="aic-glow-popup" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="aic-sparkle-popup" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <g transform="translate(256 256) scale(1.15) translate(-256 -256)">
        {/* 캔버스 프레임 */}
        <g transform="translate(256 256) rotate(-8) translate(-256 -256)">
          <rect x="132" y="156" width="260" height="208" rx="56" fill="white" fillOpacity="0.10" stroke="white" strokeOpacity="0.22" strokeWidth="10"/>
          <rect x="164" y="188" width="196" height="144" rx="44" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="8"/>
        </g>

        {/* 메인 스트로크 + 하이라이트 */}
        <g filter="url(#aic-glow-popup)">
          <path d="M 120 380 C 180 380, 180 280, 260 240 S 370 180, 400 130" stroke="url(#aic-grad-popup)" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M 130 370 C 185 370, 185 275, 260 235 S 360 175, 390 130" stroke="white" strokeOpacity="0.3" strokeWidth="8" strokeLinecap="round" fill="none" style={{ mixBlendMode: 'overlay' as const }}/>
        </g>

        {/* 스파클 포인트 */}
        <g transform="translate(410 110)" filter="url(#aic-sparkle-popup)">
          <path d="M 0 -48 C 4 -16, 16 -4, 48 0 C 16 4, 4 16, 0 48 C -4 16, -16 4, -48 0 C -16 -4, -4 -16, 0 -48 Z" fill="#FFFFFF"/>
          <circle r="12" fill="#D8B4FE" opacity="0.4"/>
          <circle cx="-40" cy="30" r="6" fill="#93C5FD" opacity="0.9"/>
          <circle cx="30" cy="40" r="8" fill="#D8B4FE" opacity="0.7"/>
          <circle cx="40" cy="-20" r="4" fill="#FFFFFF" opacity="0.6"/>
        </g>
      </g>
    </svg>
  );
}

function extractSelectionContext(canvasContent: string, selectedText: string) {
  const selectionIndex = canvasContent.indexOf(selectedText);
  if (selectionIndex === -1) {
    return { before: '', after: '' };
  }
  const before = canvasContent.slice(Math.max(0, selectionIndex - 200), selectionIndex);
  const after = canvasContent.slice(selectionIndex + selectedText.length, selectionIndex + selectedText.length + 200);
  return { before, after };
}

interface SelectionAiPopupProps {
  editorView: EditorView | null;
}

export const SelectionAiPopup = ({ editorView }: SelectionAiPopupProps) => {
  const tooltipProvider = useRef<TooltipProvider | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState('');
  const [inputValue, setInputValue] = useState('');
  
  const { isLoading, canvasContent } = useStore();
  const { sendMessage } = useChatRequest();

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !editorView) {
      return;
    }

    const tooltipProviderInstance = new TooltipProvider({
      content: container,
      shouldShow: (view) => {
        const { state } = view;
        const { selection } = state;
        const { empty, from, to } = selection;

        if (empty) {
          setSelectedText('');
          return false;
        }

        const text = state.doc.textBetween(from, to, ' ').trim();
        
        if (text.length < 2) {
          setSelectedText('');
          return false;
        }

        setSelectedText(text);
        return true;
      },
    });
    
    tooltipProvider.current = tooltipProviderInstance;
    tooltipProviderInstance.update(editorView);

    const handleMouseUp = () => {
      requestAnimationFrame(() => {
        if (tooltipProvider.current && editorView) {
          tooltipProvider.current.update(editorView);
        }
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey || e.key === 'Shift') {
        requestAnimationFrame(() => {
          if (tooltipProvider.current && editorView) {
            tooltipProvider.current.update(editorView);
          }
        });
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (container.contains(target)) {
        return;
      }
      if (editorView.dom.contains(target)) {
        return;
      }
      setSelectedText('');
      setInputValue('');
    };

    const editorDom = editorView.dom;
    editorDom.addEventListener('mouseup', handleMouseUp);
    editorDom.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      editorDom.removeEventListener('mouseup', handleMouseUp);
      editorDom.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('mousedown', handleClickOutside);
      tooltipProviderInstance.destroy();
    };
  }, [editorView]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const question = inputValue.trim();
    const currentSelection = selectedText;
    const context = extractSelectionContext(canvasContent, currentSelection);
    
    setInputValue('');
    setSelectedText('');
    
    if (editorView) {
      const { state, dispatch } = editorView;
      const pos = state.selection.from;
      dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos, pos)));
      editorView.dom.blur();
    }

    await sendMessage(question, {
      selection: {
        text: currentSelection,
        before: context.before,
        after: context.after,
      },
    });
  };

  if (!selectedText) {
    return <div ref={containerRef} style={{ display: 'none' }} className="selection-ai-popup-container" />;
  }

  return (
    <div ref={containerRef} className="selection-ai-popup-container">
      <form className="selection-ai-popup" onSubmit={handleSubmit}>
        <div className="ai-popup-icon">
          <AiMarkIcon />
        </div>
        <input
          type="text"
          className="ai-popup-input"
          placeholder="Ask AI about this selection"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </form>
    </div>
  );
};
