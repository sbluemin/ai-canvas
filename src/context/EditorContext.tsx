import {
  createContext,
  useContext,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { Editor } from '@milkdown/core';

export type ActiveBlockType = 'heading1' | 'heading2' | 'heading3' | 'body';
export type ActiveListType = 'bullet' | 'ordered' | null;

export interface ActiveInlineMarks {
  bold: boolean;
  italic: boolean;
}

interface EditorContextValue {
  editorRef: MutableRefObject<Editor | null>;
  activeBlockType: ActiveBlockType;
  setActiveBlockType: Dispatch<SetStateAction<ActiveBlockType>>;
  activeInlineMarks: ActiveInlineMarks;
  setActiveInlineMarks: Dispatch<SetStateAction<ActiveInlineMarks>>;
  activeListType: ActiveListType;
  setActiveListType: Dispatch<SetStateAction<ActiveListType>>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const editorRef = useRef<Editor | null>(null);
  const [activeBlockType, setActiveBlockType] = useState<ActiveBlockType>('body');
  const [activeInlineMarks, setActiveInlineMarks] = useState<ActiveInlineMarks>({ bold: false, italic: false });
  const [activeListType, setActiveListType] = useState<ActiveListType>(null);
  
  return (
    <EditorContext.Provider
      value={{
        editorRef,
        activeBlockType,
        setActiveBlockType,
        activeInlineMarks,
        setActiveInlineMarks,
        activeListType,
        setActiveListType,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider');
  }
  return context;
}
