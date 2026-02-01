import { useEffect, useCallback, useState } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { replaceAll, getMarkdown } from '@milkdown/utils';
import { EditorView } from '@milkdown/prose/view';
import { useStore } from '../store/useStore';
import { useEditorContext } from '../context/EditorContext';
import { SelectionAiPopup } from './SelectionAiPopup';
import './MilkdownEditor.css';

function MilkdownEditorInner() {
  const { canvasContent, setCanvasContent } = useStore();
  const { editorRef } = useEditorContext();
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  const { get, loading } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, canvasContent);
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
  );

  const storeEditorRef = useCallback(() => {
    if (!loading) {
      const editor = get();
      if (editor) {
        editorRef.current = editor;
        const view = editor.ctx.get(editorViewCtx);
        setEditorView(view);
      }
    }
  }, [loading, get, editorRef]);

  useEffect(() => {
    storeEditorRef();
    return () => {
      editorRef.current = null;
    };
  }, [storeEditorRef, editorRef]);

  useEffect(() => {
    const editor = get();
    if (editor) {
      const currentMarkdown = editor.action(getMarkdown());
      if (currentMarkdown !== canvasContent) {
        editor.action(replaceAll(canvasContent));
      }
    }
  }, [canvasContent, get]);

  useEffect(() => {
    const interval = setInterval(() => {
      const editor = get();
      if (editor) {
        const markdown = editor.action(getMarkdown());
        if (markdown !== canvasContent) {
          setCanvasContent(markdown);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [get, setCanvasContent, canvasContent]);

  return (
    <>
      <Milkdown />
      <SelectionAiPopup editorView={editorView} />
    </>
  );
}

export function MilkdownEditor() {
  return (
    <MilkdownProvider>
      <div className="milkdown-wrapper">
        <MilkdownEditorInner />
      </div>
    </MilkdownProvider>
  );
}
