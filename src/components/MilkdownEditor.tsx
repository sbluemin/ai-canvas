import { useEffect, useCallback, useRef, useState } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { math } from '@milkdown/plugin-math';
import { prism } from '@milkdown/plugin-prism';
import { diagram, mermaidConfigCtx } from '@milkdown/plugin-diagram';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { replaceAll, getMarkdown } from '@milkdown/utils';
import { EditorView } from '@milkdown/prose/view';
import mermaid from 'mermaid';
import type { MermaidConfig } from 'mermaid';
import { useStore } from '../store/useStore';
import { useEditorContext } from '../context/EditorContext';
import { SelectionAiPopup } from './SelectionAiPopup';
import { api } from '../api';
import './MilkdownEditor.css';
import 'katex/dist/katex.min.css';
import 'prismjs/themes/prism-tomorrow.css';

const MERMAID_FONT_STACK = "'Inter', 'Noto Sans KR', sans-serif";

const getThemeToken = (): string => {
  if (typeof document === 'undefined') {
    return 'dark';
  }

  return document.documentElement.dataset.theme ?? 'dark';
};

const getCssVariable = (name: string, fallback: string): string => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const createMermaidConfig = (themeToken: string): MermaidConfig => {
  const isDark = themeToken !== 'light';
  const textPrimary = getCssVariable('--text-primary', isDark ? '#ffffff' : '#202124');
  const textSecondary = getCssVariable('--text-secondary', isDark ? '#9ca3af' : '#5f6368');
  const bgSecondary = getCssVariable('--bg-secondary', isDark ? '#1e1f20' : '#f8f9fa');
  const bgTertiary = getCssVariable('--bg-tertiary', isDark ? '#282a2c' : '#f1f3f4');
  const borderColor = getCssVariable('--border-color', isDark ? '#3c3f41' : '#dadce0');
  const accentBlue = getCssVariable('--accent-blue', isDark ? '#8ab4f8' : '#1a73e8');

  return {
    startOnLoad: false,
    theme: 'base',
    darkMode: isDark,
    securityLevel: 'strict',
    htmlLabels: true,
    fontFamily: MERMAID_FONT_STACK,
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      nodeSpacing: 40,
      rankSpacing: 48,
      padding: 10,
      useMaxWidth: true,
    },
    sequence: {
      useMaxWidth: true,
      actorMargin: 56,
      diagramMarginY: 24,
      messageMargin: 44,
      boxMargin: 12,
      noteMargin: 12,
    },
    class: {
      useMaxWidth: true,
      nodeSpacing: 40,
      rankSpacing: 44,
    },
    state: {
      useMaxWidth: true,
    },
    gantt: {
      useMaxWidth: true,
      topPadding: 32,
      barGap: 8,
      barHeight: 24,
    },
    pie: {
      useMaxWidth: true,
      textPosition: 0.68,
    },
    themeVariables: {
      darkMode: isDark,
      background: 'transparent',
      textColor: textSecondary,
      lineColor: accentBlue,
      fontFamily: MERMAID_FONT_STACK,
      primaryColor: bgTertiary,
      primaryBorderColor: borderColor,
      primaryTextColor: textPrimary,
      secondaryColor: bgSecondary,
      secondaryBorderColor: borderColor,
      tertiaryColor: bgSecondary,
      tertiaryBorderColor: borderColor,
      tertiaryTextColor: textPrimary,
      mainBkg: bgTertiary,
      nodeBorder: borderColor,
      clusterBkg: bgSecondary,
      clusterBorder: borderColor,
      edgeLabelBackground: bgSecondary,
      titleColor: textPrimary,
      actorBorder: borderColor,
      actorBkg: bgTertiary,
      actorTextColor: textPrimary,
      actorLineColor: accentBlue,
      noteBkgColor: bgSecondary,
      noteBorderColor: borderColor,
      noteTextColor: textPrimary,
      labelBoxBkgColor: bgSecondary,
      labelBoxBorderColor: borderColor,
      labelTextColor: textPrimary,
      signalColor: accentBlue,
      signalTextColor: textPrimary,
      cScale0: bgTertiary,
      cScale1: bgSecondary,
      cScale2: bgTertiary,
    },
  };
};

const createMermaidRenderId = (): string => `ai-canvas-mermaid-${Math.random().toString(36).slice(2, 10)}`;

const renderMermaidBlock = async (
  block: HTMLElement,
  themeToken: string,
): Promise<void> => {
  const source = block.dataset.value ?? block.textContent ?? '';
  if (!source.trim()) {
    return;
  }

  const renderKey = `${themeToken}::${source}`;
  if (block.dataset.mermaidRenderKey === renderKey) {
    return;
  }

  block.dataset.value = source;

  try {
    const { svg, bindFunctions } = await mermaid.render(createMermaidRenderId(), source, block);
    block.innerHTML = svg;
    bindFunctions?.(block);
    block.dataset.mermaidRenderKey = renderKey;
    delete block.dataset.mermaidRenderError;
  } catch (error) {
    block.textContent = source;
    block.dataset.mermaidRenderError = String(error);
    delete block.dataset.mermaidRenderKey;
  }
};

const renderMermaidBlocks = async (
  root: HTMLElement,
  themeToken: string,
): Promise<void> => {
  mermaid.initialize(createMermaidConfig(themeToken));

  const blocks = Array.from(root.querySelectorAll<HTMLElement>('div[data-type="diagram"]'));
  await Promise.allSettled(blocks.map((block) => renderMermaidBlock(block, themeToken)));
};

function MilkdownEditorInner() {
  const { setCanvasContent, canvasContent, projectPath, addToast } = useStore();
  const canvasContentRef = useRef(canvasContent);
  const [mermaidThemeToken, setMermaidThemeToken] = useState(getThemeToken);

  const { editorRef } = useEditorContext();
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  useEffect(() => {
    canvasContentRef.current = canvasContent;
  }, [canvasContent]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const syncThemeToken = () => {
      setMermaidThemeToken(root.dataset.theme ?? 'dark');
    };

    syncThemeToken();

    const observer = new MutationObserver(syncThemeToken);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!editorView) {
      return;
    }

    const root = editorView.dom as HTMLElement;
    let rafId: number | null = null;

    const scheduleRender = () => {
      if (rafId !== null) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        void renderMermaidBlocks(root, mermaidThemeToken);
      });
    };

    scheduleRender();

    const observer = new MutationObserver(scheduleRender);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-value'],
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [editorView, mermaidThemeToken]);

  // 테마 변경 시 에디터를 재생성하지 않음 — 재생성 중 ProseMirror가
  // 이미 해제된 commonmark 컨텍스트(headingAttr 등)를 참조해 크래시 발생.
  // Mermaid 블록 재렌더링은 별도 useEffect(renderMermaidBlocks)에서 처리.
  const { get, loading } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, canvasContentRef.current);
        ctx.set(mermaidConfigCtx.key, createMermaidConfig(getThemeToken()));
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
  , []);

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

  // 에디터→store 동기화: 폴링 대신 input/blur 이벤트 기반
  useEffect(() => {
    if (!editorView) return;

    let debounceTimer: number | null = null;

    const syncToStore = () => {
      const editor = get();
      if (!editor) return;
      const markdown = editor.action(getMarkdown());
      if (markdown !== canvasContentRef.current) {
        canvasContentRef.current = markdown;
        setCanvasContent(markdown);
      }
    };

    // blur 시 즉시 동기화 → CanvasPanel onBlur에서 최신 내용으로 저장 가능
    const handleBlur = () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      syncToStore();
    };

    // 입력 시 500ms 디바운스 동기화
    const handleInput = () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(syncToStore, 500);
    };

    editorView.dom.addEventListener('blur', handleBlur, true);
    editorView.dom.addEventListener('input', handleInput);

    return () => {
      editorView.dom.removeEventListener('blur', handleBlur, true);
      editorView.dom.removeEventListener('input', handleInput);
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    };
  }, [editorView, get, setCanvasContent]);

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

  const handlePaste = useCallback((event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;
    event.preventDefault();
    void handleImageFile(file);
  }, [handleImageFile]);

  const handleDrop = useCallback((event: DragEvent) => {
    const files = Array.from(event.dataTransfer?.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    event.preventDefault();
    imageFiles.forEach((file) => {
      void handleImageFile(file);
    });
  }, [handleImageFile]);

  useEffect(() => {
    if (!editorView) {
      return;
    }

    const root = editorView.dom as HTMLElement;

    const onPaste = (event: ClipboardEvent) => {
      handlePaste(event);
    };

    const onDrop = (event: DragEvent) => {
      handleDrop(event);
    };

    const onDragOver = (event: DragEvent) => {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) {
        return;
      }

      event.preventDefault();
    };

    root.addEventListener('paste', onPaste);
    root.addEventListener('drop', onDrop);
    root.addEventListener('dragover', onDragOver);

    return () => {
      root.removeEventListener('paste', onPaste);
      root.removeEventListener('drop', onDrop);
      root.removeEventListener('dragover', onDragOver);
    };
  }, [editorView, handleDrop, handlePaste]);

  return (
    <div className="milkdown-interactive">
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
