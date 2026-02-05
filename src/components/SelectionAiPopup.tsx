import { useEffect, useRef, useState } from 'react';
import { TooltipProvider } from '@milkdown/plugin-tooltip';
import { EditorView } from '@milkdown/prose/view';
import { TextSelection } from '@milkdown/prose/state';
import { useStore } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import './SelectionAiPopup.css';

function AiMarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 512 512" fill="none" role="img" aria-label="AI Canvas 마크">
      <defs>
        <linearGradient id="aic-accent-popup" x1="120" y1="360" x2="412" y2="132" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22D3EE"/>
          <stop offset="0.5" stopColor="#818CF8"/>
          <stop offset="1" stopColor="#C084FC"/>
        </linearGradient>
        <linearGradient id="aic-accent2-popup" x1="132" y1="388" x2="404" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5EEAD4"/>
          <stop offset="0.45" stopColor="#60A5FA"/>
          <stop offset="1" stopColor="#A78BFA"/>
        </linearGradient>
        <filter id="aic-soft-popup" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="10" result="b"/>
          <feMerge>
            <feMergeNode in="b"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g transform="translate(256 256) rotate(-8) translate(-256 -256)">
        <rect x="132" y="156" width="260" height="208" rx="56" fill="white" fillOpacity="0.10" stroke="white" strokeOpacity="0.22" strokeWidth="10"/>
        <rect x="164" y="188" width="196" height="144" rx="44" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="8"/>
      </g>
      <path d="M140 346 C 208 262, 274 244, 372 170" stroke="url(#aic-accent-popup)" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" filter="url(#aic-soft-popup)"/>
      <path d="M146 352 C 214 270, 280 252, 378 176" stroke="url(#aic-accent2-popup)" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity="0.55"/>
      <path d="M392 116 L408 154 L446 170 L408 186 L392 224 L376 186 L338 170 L376 154 Z" fill="white" fillOpacity="0.95"/>
      <circle cx="380" cy="182" r="10" fill="url(#aic-accent-popup)"/>
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
          placeholder="AI에게 물어보기"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      </form>
    </div>
  );
};
