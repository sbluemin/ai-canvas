import { useEffect, useRef, useState } from 'react';
import { TooltipProvider } from '@milkdown/plugin-tooltip';
import { EditorView } from '@milkdown/prose/view';
import { TextSelection } from '@milkdown/prose/state';
import { useStore } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import { DetailLogo } from './Logo';
import './SelectionAiPopup.css';

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
          <DetailLogo />
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
