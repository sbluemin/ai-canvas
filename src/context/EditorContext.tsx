import { createContext, useContext, useRef, type MutableRefObject, type ReactNode } from 'react';
import type { Editor } from '@milkdown/core';

interface EditorContextValue {
  editorRef: MutableRefObject<Editor | null>;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const editorRef = useRef<Editor | null>(null);
  
  return (
    <EditorContext.Provider value={{ editorRef }}>
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
