import { useEffect, useCallback, useState } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { math } from '@milkdown/plugin-math';
import { prism } from '@milkdown/plugin-prism';
import { diagram } from '@milkdown/plugin-diagram';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { replaceAll, getMarkdown } from '@milkdown/utils';
import { EditorView } from '@milkdown/prose/view';
import { useStore } from '../store/useStore';
import { useEditorContext } from '../context/EditorContext';
import { SelectionAiPopup } from './SelectionAiPopup';
import { api } from '../api';
import './MilkdownEditor.css';
import 'katex/dist/katex.min.css';
import 'prismjs/themes/prism-tomorrow.css';

function MilkdownEditorInner() {
  const { setCanvasContent, canvasContent, projectPath, addToast } = useStore();
  
  const { editorRef } = useEditorContext();
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  const { get, loading } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, canvasContent);
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          attributes: { ...prev.attributes, spellcheck: 'false' },
        }));
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(prism)
      .use(math)
      .use(diagram)
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

  const insertMarkdown = useCallback((markdown: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const view = editor.ctx.get(editorViewCtx);
    const { from, to } = view.state.selection;
    view.dispatch(view.state.tr.insertText(markdown, from, to));
    view.focus();
  }, [editorRef]);

  const readFileAsDataUrl = useCallback((file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  }), []);

  const handleImageFile = useCallback(async (file: File) => {
    if (!projectPath) {
      addToast('error', 'Please select a project first.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.split(',')[1] ?? '';
      const result = await api.saveImageAsset(projectPath, base64, file.type || 'image/png');
      if (result.success && result.relativePath) {
        insertMarkdown(`![](${result.relativePath})`);
        addToast('success', 'Image saved as asset.');
      } else {
        addToast('error', `Image save failed: ${result.error ?? 'Unknown error'}`);
      }
    } catch (error) {
        addToast('error', `Image processing failed: ${String(error)}`);
    }
  }, [addToast, insertMarkdown, projectPath, readFileAsDataUrl]);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    void handleImageFile(file);
  }, [handleImageFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    event.preventDefault();
    imageFiles.forEach((file) => {
      void handleImageFile(file);
    });
  }, [handleImageFile]);

  return (
    <div
      className="milkdown-interactive"
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
    >
      <Milkdown />
      <SelectionAiPopup editorView={editorView} />
    </div>
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
