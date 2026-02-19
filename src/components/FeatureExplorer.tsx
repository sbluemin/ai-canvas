import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { TreeEntry, FeatureSummary, Conversation, Message, WritingGoal } from '../store/types';
import { api } from '../api';
import { generateId } from '../utils';
import './FeatureExplorer.css';

interface FeatureExplorerProps {
  onSelectFile: (filePath: string) => void;
  onRefreshTree: () => Promise<void>;
}

interface ContextMenuState {
  x: number;
  y: number;
  entry: TreeEntry;
}

interface WorkspaceData {
  featureConversations: Record<string, Conversation[]>;
  featureActiveConversationIds: Record<string, string | null>;
}

interface InputDialogState {
  mode: 'create-feature' | 'rename-feature' | 'new-file' | 'rename-file' | 'delete-feature' | 'delete-file';
  title: string;
  placeholder: string;
  submitLabel: string;
  featureId?: string;
  filePath?: string;
  initialValue: string;
}

function normalizeFeatureId(input: string): string {
  return input
    .trim()
    .replace(/[\\/]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/\s+/g, '-');
}

function serializeMessages(messages: Message[]) {
  return messages.map((message) => ({
    ...message,
    timestamp: message.timestamp.toISOString(),
  }));
}

function serializeConversations(conversations: Conversation[]) {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: serializeMessages(conversation.messages),
  }));
}

function parseStoredMessages(rawMessages: unknown[] | undefined): Message[] {
  if (!Array.isArray(rawMessages)) return [];

  const parsed: Message[] = [];
  rawMessages.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const message = item as Record<string, unknown>;
    const role = message.role === 'assistant' ? 'assistant' : message.role === 'user' ? 'user' : null;
    if (!role || typeof message.content !== 'string') return;
    const parsedTimestamp = typeof message.timestamp === 'string' || typeof message.timestamp === 'number'
      ? new Date(message.timestamp)
      : new Date();

    parsed.push({
      id: typeof message.id === 'string' ? message.id : generateId('msg'),
      role,
      content: message.content,
      timestamp: Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp,
      provider: message.provider === 'opencode' ? 'opencode' : undefined,
      fileMentions: Array.isArray(message.fileMentions) ? message.fileMentions as Message['fileMentions'] : undefined,
    });
  });

  return parsed;
}

function parseStoredConversations(rawConversations: unknown): Conversation[] {
  if (!Array.isArray(rawConversations)) return [];
  return rawConversations.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return {
        id: generateId('conv'),
        title: `Chat ${index + 1}`,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    const conversation = item as Record<string, unknown>;
    return {
      id: typeof conversation.id === 'string' ? conversation.id : generateId('conv'),
      title: typeof conversation.title === 'string' ? conversation.title : `Chat ${index + 1}`,
      messages: parseStoredMessages(Array.isArray(conversation.messages) ? conversation.messages : []),
      createdAt: typeof conversation.createdAt === 'number' ? conversation.createdAt : Date.now(),
      updatedAt: typeof conversation.updatedAt === 'number' ? conversation.updatedAt : Date.now(),
    };
  });
}

function parseWorkspace(rawWorkspace: unknown): WorkspaceData {
  if (!rawWorkspace || typeof rawWorkspace !== 'object') {
    return { featureConversations: {}, featureActiveConversationIds: {} };
  }

  const workspace = rawWorkspace as Record<string, unknown>;
  const featureConversations: Record<string, Conversation[]> = {};
  const featureActiveConversationIds: Record<string, string | null> = {};

  if (workspace.featureConversations && typeof workspace.featureConversations === 'object') {
    Object.entries(workspace.featureConversations as Record<string, unknown>).forEach(([featureId, value]) => {
      featureConversations[featureId] = parseStoredConversations(value);
    });
  }

  if (workspace.featureActiveConversationIds && typeof workspace.featureActiveConversationIds === 'object') {
    Object.entries(workspace.featureActiveConversationIds as Record<string, unknown>).forEach(([featureId, value]) => {
      featureActiveConversationIds[featureId] = typeof value === 'string' ? value : null;
    });
  }

  return { featureConversations, featureActiveConversationIds };
}

function getFeatureNodes(canvasTree: TreeEntry[]): TreeEntry[] {
  return canvasTree.filter((entry) => entry.type === 'folder' && entry.name !== '.runtime' && entry.path !== '.runtime');
}

function getFeatureFiles(canvasTree: TreeEntry[], featureId: string): string[] {
  const featureNode = canvasTree.find((entry) => entry.type === 'folder' && entry.path === featureId);
  const files = (featureNode?.children ?? [])
    .filter((child) => child.type === 'file' && child.path.startsWith(`${featureId}/`))
    .map((child) => child.path)
    .sort((a, b) => a.localeCompare(b));
  return files;
}

function findFeature(featureId: string, features: FeatureSummary[]): FeatureSummary | null {
  return features.find((feature) => feature.id === featureId) ?? null;
}

function normalizeWritingGoal(input: unknown): WritingGoal | null {
  if (!input || typeof input !== 'object') return null;
  const goal = input as Partial<WritingGoal>;
  if (
    typeof goal.purpose !== 'string'
    || typeof goal.audience !== 'string'
    || typeof goal.tone !== 'string'
    || (goal.targetLength !== 'short' && goal.targetLength !== 'medium' && goal.targetLength !== 'long')
  ) {
    return null;
  }

  return {
    purpose: goal.purpose,
    audience: goal.audience,
    tone: goal.tone,
    targetLength: goal.targetLength,
  };
}

function extractWritingGoalFromMeta(meta: unknown): WritingGoal | null {
  if (!meta || typeof meta !== 'object') {
    return null;
  }

  const value = (meta as { writingGoal?: unknown }).writingGoal;
  return normalizeWritingGoal(value);
}

function createDefaultConversation(messages: Message[]): Conversation {
  return {
    id: generateId('conv'),
    title: 'Chat 1',
    messages,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function TreeNode({
  entry,
  depth,
  activeFile,
  activeFeatureId,
  isActiveFeatureBusy,
  features,
  onSelect,
  onSelectFeature,
  onStartFeatureDrag,
  onCancelFeatureDrag,
  onDropFeature,
  expandedFolders,
  onToggleFolder,
  onContextMenu,
}: {
  entry: TreeEntry;
  depth: number;
  activeFile: string | null;
  activeFeatureId: string | null;
  isActiveFeatureBusy: boolean;
  features: FeatureSummary[];
  onSelect: (path: string) => void;
  onSelectFeature: (featureId: string) => void;
  onStartFeatureDrag: (featureId: string) => void;
  onCancelFeatureDrag: () => void;
  onDropFeature: (featureId: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: TreeEntry) => void;
}) {
  const isExpanded = expandedFolders.has(entry.path);
  const isRootFeature = depth === 0 && entry.type === 'folder';
  const feature = isRootFeature ? findFeature(entry.path, features) : null;

  if (entry.type === 'folder') {
    const isActiveFeature = isRootFeature && entry.path === activeFeatureId;

    return (
      <div className="tree-node">
        <button
          type="button"
          className={`tree-item tree-folder ${isActiveFeature ? 'active' : ''} ${isActiveFeature && isActiveFeatureBusy ? 'active-pulse' : ''}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          draggable={isRootFeature}
          onDragStart={() => {
            if (isRootFeature) {
              onStartFeatureDrag(entry.path);
            }
          }}
          onDragEnd={() => {
            if (isRootFeature) {
              onCancelFeatureDrag();
            }
          }}
          onDragOver={(event) => {
            if (isRootFeature) {
              event.preventDefault();
            }
          }}
          onDrop={() => {
            if (isRootFeature) {
              onDropFeature(entry.path);
            }
          }}
          onClick={() => {
            onToggleFolder(entry.path);
            if (isRootFeature) {
              onSelectFeature(entry.path);
            }
          }}
          onContextMenu={(e) => onContextMenu(e, entry)}
        >
          <span className={`tree-chevron ${isExpanded ? 'expanded' : ''}`}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3.5 2L6.5 5L3.5 8" />
            </svg>
          </span>
          {feature?.icon ? (
            <span className="tree-icon tree-icon-emoji" aria-hidden="true">{feature.icon}</span>
          ) : (
            <svg className="tree-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 4.5V12.5C2 13.05 2.45 13.5 3 13.5H13C13.55 13.5 14 13.05 14 12.5V5.5C14 4.95 13.55 4.5 13 4.5H8L6.5 3H3C2.45 3 2 3.45 2 4V4.5Z" />
            </svg>
          )}
          <span className="tree-label">{feature?.name ?? entry.name}</span>
          {isActiveFeature && <span className={`feature-active-dot ${isActiveFeatureBusy ? 'pulse' : ''}`} aria-hidden="true" />}
        </button>
        {isExpanded && entry.children && (
          <div className="tree-children">
            {entry.children
              .filter((child) => child.type === 'file')
              .map((child) => (
                <TreeNode
                  key={child.path}
                  entry={child}
                  depth={depth + 1}
                  activeFile={activeFile}
                  activeFeatureId={activeFeatureId}
                  isActiveFeatureBusy={isActiveFeatureBusy}
                  features={features}
                  onSelect={onSelect}
                  onSelectFeature={onSelectFeature}
                  onStartFeatureDrag={onStartFeatureDrag}
                  onCancelFeatureDrag={onCancelFeatureDrag}
                  onDropFeature={onDropFeature}
                  expandedFolders={expandedFolders}
                  onToggleFolder={onToggleFolder}
                  onContextMenu={onContextMenu}
                />
              ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = entry.path === activeFile;
  return (
    <button
      type="button"
      className={`tree-item tree-file ${isActive ? 'active' : ''}`}
      style={{ paddingLeft: `${28 + depth * 16}px` }}
      onClick={() => onSelect(entry.path)}
      onContextMenu={(e) => onContextMenu(e, entry)}
      title={entry.path}
    >
      <svg className="tree-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9.5 1.5H4C3.45 1.5 3 1.95 3 2.5V13.5C3 14.05 3.45 14.5 4 14.5H12C12.55 14.5 13 14.05 13 13.5V5L9.5 1.5Z" />
        <path d="M9.5 1.5V5H13" />
      </svg>
      <span className="tree-label">{entry.name.replace(/\.md$/, '')}</span>
    </button>
  );
}

export function FeatureExplorer({ onSelectFile, onRefreshTree }: FeatureExplorerProps) {
  const {
    projectPath,
    features,
    setFeatures,
    activeFeatureId,
    setActiveFeatureId,
    canvasTree,
    activeCanvasFile,
    isLoading,
    autosaveStatus,
    addToast,
    setCanvasFiles,
    setActiveCanvasFile,
    setCanvasContent,
    setConversations,
    setActiveConversationId,
    setMessages,
    conversations,
    activeConversationId,
    setActiveWritingGoal,
  } = useStore();

  const isActiveFeatureBusy = isLoading || autosaveStatus.state === 'saving';

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [draggingFeatureId, setDraggingFeatureId] = useState<string | null>(null);
  const [inputDialog, setInputDialog] = useState<InputDialogState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const inputFieldRef = useRef<HTMLInputElement>(null);
  const emojiInputRef = useRef<HTMLInputElement>(null);
  const emojiTargetFeatureIdRef = useRef<string | null>(null);

  useEffect(() => {
    onRefreshTree();
  }, [onRefreshTree]);

  // inputDialog가 열릴 때 input에 포커스 — confirm() 후 window 포커스 복원 지연 대응
  useEffect(() => {
    if (!inputDialog) return;
    const tryFocus = () => inputFieldRef.current?.focus();
    tryFocus();
    const rafId = requestAnimationFrame(tryFocus);
    const timerId = setTimeout(tryFocus, 100);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [inputDialog]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: TreeEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const persistCurrentFeatureWorkspace = async () => {
    if (!projectPath || !activeFeatureId) return null;

    const workspaceResult = await api.readWorkspace(projectPath);
    const baseWorkspace = workspaceResult.success && workspaceResult.workspace && typeof workspaceResult.workspace === 'object'
      ? workspaceResult.workspace as Record<string, unknown>
      : {};

    const parsed = parseWorkspace(baseWorkspace);
    parsed.featureConversations[activeFeatureId] = conversations;
    parsed.featureActiveConversationIds[activeFeatureId] = activeConversationId;

    const activeConversation = activeConversationId
      ? conversations.find((conversation) => conversation.id === activeConversationId)
      : null;
    const chatSessionMessages = serializeMessages(activeConversation ? activeConversation.messages : []);
    await api.writeChatSession(projectPath, activeFeatureId, chatSessionMessages);

    const nextWorkspace = {
      ...baseWorkspace,
      featureConversations: Object.fromEntries(
        Object.entries(parsed.featureConversations).map(([featureId, convs]) => [featureId, serializeConversations(convs)]),
      ),
      featureActiveConversationIds: parsed.featureActiveConversationIds,
    };

    await api.writeWorkspace(projectPath, nextWorkspace);
    return parsed;
  };

  const switchFeature = async (featureId: string) => {
    if (!projectPath) return;
    if (featureId === activeFeatureId) return;

    const parsedWorkspace = await persistCurrentFeatureWorkspace();

    setActiveFeatureId(featureId);
    setExpandedFolders((prev) => new Set(prev).add(featureId));

    const filesResult = await api.listFeatureCanvasFiles(projectPath, featureId);
    const files = filesResult.success && filesResult.files ? filesResult.files : getFeatureFiles(canvasTree, featureId);
    setCanvasFiles(files);

    const sessionResult = await api.readChatSession(projectPath, featureId);
    const sessionMessages = sessionResult.success && sessionResult.messages
      ? parseStoredMessages(sessionResult.messages)
      : [];

    const storedConversations = parsedWorkspace?.featureConversations[featureId] ?? [];
    if (storedConversations.length > 0) {
      const preferredActiveId = parsedWorkspace?.featureActiveConversationIds[featureId] ?? null;
      const nextActiveId = preferredActiveId && storedConversations.some((conv) => conv.id === preferredActiveId)
        ? preferredActiveId
        : storedConversations[0].id;
      setConversations(storedConversations);
      setActiveConversationId(nextActiveId);
      const activeConversation = storedConversations.find((conv) => conv.id === nextActiveId);
      setMessages(activeConversation ? activeConversation.messages : []);
    } else {
      const defaultConversation = createDefaultConversation(sessionMessages);
      setConversations([defaultConversation]);
      setActiveConversationId(defaultConversation.id);
      setMessages(sessionMessages);
    }

    const metaResult = await api.readFeatureMeta(projectPath, featureId);
    if (metaResult.success) {
      setActiveWritingGoal(extractWritingGoalFromMeta(metaResult.meta));
    } else {
      setActiveWritingGoal(null);
    }

    if (files.length > 0) {
      onSelectFile(files[0]);
    } else {
      setActiveCanvasFile(null);
      setCanvasContent('');
    }
  };

  const refreshFeatures = async () => {
    if (!projectPath) return;
    const featuresResult = await api.listFeatures(projectPath);
    if (featuresResult.success && featuresResult.features) {
      setFeatures(featuresResult.features);
      return;
    }

    addToast('error', `Failed: ${featuresResult.error ?? 'refresh features failed'}`);
  };

  const saveFeatureOrder = async (orderedFeatures: FeatureSummary[]) => {
    if (!projectPath) return;

    for (let index = 0; index < orderedFeatures.length; index += 1) {
      const feature = orderedFeatures[index];
      const metaResult = await api.readFeatureMeta(projectPath, feature.id);
      const baseMeta = metaResult.success && metaResult.meta && typeof metaResult.meta === 'object'
        ? metaResult.meta as Record<string, unknown>
        : {};
      await api.writeFeatureMeta(projectPath, feature.id, {
        ...baseMeta,
        name: feature.id,
        icon: feature.icon ?? '',
        order: index,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleStartFeatureDrag = (featureId: string) => {
    setDraggingFeatureId(featureId);
  };

  const handleCancelFeatureDrag = () => {
    setDraggingFeatureId(null);
  };

  const handleDropFeature = async (targetFeatureId: string) => {
    if (!draggingFeatureId || draggingFeatureId === targetFeatureId) {
      setDraggingFeatureId(null);
      return;
    }

    const fromIndex = features.findIndex((feature) => feature.id === draggingFeatureId);
    const toIndex = features.findIndex((feature) => feature.id === targetFeatureId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingFeatureId(null);
      return;
    }

    const nextFeatures = [...features];
    const [moved] = nextFeatures.splice(fromIndex, 1);
    nextFeatures.splice(toIndex, 0, moved);
    const orderedFeatures = nextFeatures.map((feature, index) => ({ ...feature, order: index }));

    setFeatures(orderedFeatures);
    await saveFeatureOrder(orderedFeatures);
    setDraggingFeatureId(null);
    addToast('success', 'Feature order updated.');
  };

  const handleCreateFeature = async (featureName: string): Promise<boolean> => {
    if (!projectPath) return false;

    const featureId = normalizeFeatureId(featureName);
    if (!featureId) {
      addToast('error', 'Feature name is invalid.');
      return false;
    }

    const result = await api.createFeature(projectPath, featureId, featureName);
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return false;
    }

    await refreshFeatures();
    await onRefreshTree();
    setExpandedFolders((prev) => new Set(prev).add(featureId));
    await switchFeature(featureId);
    addToast('success', `Created feature: ${featureId}`);
    return true;
  };

  const handleCreateFileInFeature = async (featureId: string, fileName: string): Promise<boolean> => {
    if (!projectPath) return false;

    const normalizedBaseName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    const filePath = `${featureId}/${normalizedBaseName}`;

    const result = await api.writeCanvasFile(
      projectPath,
      filePath,
      `# ${fileName.replace(/\.md$/, '')}\n\nStart writing here.\n`,
    );
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return false;
    }

    await onRefreshTree();
    if (featureId !== activeFeatureId) {
      await switchFeature(featureId);
    } else {
      setExpandedFolders((prev) => new Set(prev).add(featureId));
    }

    const filesResult = await api.listFeatureCanvasFiles(projectPath, featureId);
    if (filesResult.success && filesResult.files) {
      setCanvasFiles(filesResult.files);
    }

    onSelectFile(filePath);
    addToast('success', `Created: ${normalizedBaseName}`);
    return true;
  };

  const handleRenameFeature = async (featureId: string, nextInputName: string): Promise<boolean> => {
    if (!projectPath) return false;

    const feature = findFeature(featureId, features);
    const nextFeatureId = normalizeFeatureId(nextInputName);
    if (!nextFeatureId) {
      addToast('error', 'Feature name is invalid.');
      return false;
    }

    if (nextFeatureId !== featureId) {
      const renameResult = await api.renameFeature(projectPath, featureId, nextFeatureId);
      if (!renameResult.success) {
        addToast('error', `Failed: ${renameResult.error}`);
        return false;
      }
    }

    const metaResult = await api.readFeatureMeta(projectPath, nextFeatureId);
    if (metaResult.success && metaResult.meta) {
      const nextMeta = {
        ...metaResult.meta,
        name: nextFeatureId,
        icon: feature?.icon ?? '',
        updatedAt: new Date().toISOString(),
      };
      await api.writeFeatureMeta(projectPath, nextFeatureId, nextMeta);
    }

    await refreshFeatures();
    await onRefreshTree();
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.delete(featureId);
      next.add(nextFeatureId);
      return next;
    });
    if (activeFeatureId === featureId) {
      await switchFeature(nextFeatureId);
    }
    addToast('success', `Renamed feature: ${nextFeatureId}`);
    return true;
  };

  const handleRenameFile = async (oldFilePath: string, newBaseName: string): Promise<boolean> => {
    if (!projectPath) return false;

    // .md 확장자 자동 붙이기
    const normalizedName = newBaseName.endsWith('.md') ? newBaseName : `${newBaseName}.md`;
    // featureId 추출: "my-feature/doc.md" -> "my-feature"
    const featureId = oldFilePath.split('/')[0];
    const newFilePath = `${featureId}/${normalizedName}`;

    // 동일 이름이면 아무 작업 안 함
    if (newFilePath === oldFilePath) return true;

    const result = await api.renameCanvasFile(projectPath, oldFilePath, newFilePath);
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return false;
    }

    await onRefreshTree();

    // 현재 feature의 파일 목록 새로고침
    const filesResult = await api.listFeatureCanvasFiles(projectPath, featureId);
    if (filesResult.success && filesResult.files) {
      setCanvasFiles(filesResult.files);
    }

    // 활성 파일이 rename된 파일이면 새 경로로 전환
    if (activeCanvasFile === oldFilePath) {
      onSelectFile(newFilePath);
    }

    addToast('success', `Renamed: ${normalizedName}`);
    return true;
  };

  const handleDeleteFile = async (filePath: string): Promise<boolean> => {
    if (!projectPath) return false;

    const result = await api.deleteCanvasFile(projectPath, filePath);
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return false;
    }

    const featureId = filePath.split('/')[0];
    await onRefreshTree();

    const filesResult = await api.listFeatureCanvasFiles(projectPath, featureId);
    if (filesResult.success && filesResult.files) {
      setCanvasFiles(filesResult.files);

      if (activeCanvasFile === filePath) {
        if (filesResult.files.length > 0) {
          onSelectFile(filesResult.files[0]);
        } else {
          setActiveCanvasFile(null);
          setCanvasContent('');
        }
      }
    }

    const deletedName = filePath.split('/').pop() ?? filePath;
    addToast('success', `Deleted: ${deletedName}`);
    return true;
  };

  const handleSetFeatureIcon = async (featureId: string, iconInput: string): Promise<boolean> => {
    if (!projectPath) return false;
    const icon = iconInput.trim();

    const metaResult = await api.readFeatureMeta(projectPath, featureId);
    if (!metaResult.success || !metaResult.meta || typeof metaResult.meta !== 'object') {
      addToast('error', `Failed: ${metaResult.error ?? 'read meta failed'}`);
      return false;
    }

    const nextMeta = {
      ...(metaResult.meta as Record<string, unknown>),
      name: featureId,
      icon,
      updatedAt: new Date().toISOString(),
    };
    const writeResult = await api.writeFeatureMeta(projectPath, featureId, nextMeta);
    if (!writeResult.success) {
      addToast('error', `Failed: ${writeResult.error ?? 'write meta failed'}`);
      return false;
    }

    setFeatures(features.map((item) => (item.id === featureId ? { ...item, icon } : item)));
    addToast('success', icon ? 'Feature icon updated.' : 'Feature icon cleared.');
    return true;
  };

  const openInputDialog = (dialog: InputDialogState) => {
    setInputDialog(dialog);
    setInputValue(dialog.initialValue);
  };

  const closeInputDialog = () => {
    setInputDialog(null);
    setInputValue('');
  };

  const openCreateFeatureDialog = () => {
    openInputDialog({
      mode: 'create-feature',
      title: 'New feature',
      placeholder: 'feature name',
      submitLabel: 'Create',
      initialValue: '',
    });
  };

  const openCreateFileDialog = (featureId: string) => {
    openInputDialog({
      mode: 'new-file',
      title: `New file in ${featureId}`,
      placeholder: 'file name',
      submitLabel: 'Create',
      featureId,
      initialValue: '',
    });
  };

  const openRenameFeatureDialog = (featureId: string) => {
    openInputDialog({
      mode: 'rename-feature',
      title: `Rename feature ${featureId}`,
      placeholder: 'feature name',
      submitLabel: 'Rename',
      featureId,
      initialValue: featureId,
    });
  };

  const openRenameFileDialog = (filePath: string, currentName: string) => {
    openInputDialog({
      mode: 'rename-file',
      title: 'Rename file',
      placeholder: 'file name',
      submitLabel: 'Rename',
      filePath,
      initialValue: currentName.replace(/\.md$/, ''),
    });
  };

  const openSetFeatureIconDialog = (featureId: string) => {
    emojiTargetFeatureIdRef.current = featureId;
    if (emojiInputRef.current) {
      emojiInputRef.current.value = '';
      emojiInputRef.current.focus();
    }
    api.showEmojiPanel();
  };

  const handleSubmitInputDialog = async () => {
    if (!inputDialog) return;

    // delete 모드는 입력값 불필요 — 즉시 실행
    if (inputDialog.mode === 'delete-feature' && inputDialog.featureId) {
      const success = await handleDeleteFeature(inputDialog.featureId);
      if (success) closeInputDialog();
      return;
    }
    if (inputDialog.mode === 'delete-file' && inputDialog.filePath) {
      const success = await handleDeleteFile(inputDialog.filePath);
      if (success) closeInputDialog();
      return;
    }

    const normalizedValue = inputValue.trim();
    if (!normalizedValue) {
      addToast('error', 'Input is required.');
      return;
    }

    let success = false;
    switch (inputDialog.mode) {
      case 'create-feature':
        success = await handleCreateFeature(normalizedValue);
        break;
      case 'new-file':
        if (inputDialog.featureId) {
          success = await handleCreateFileInFeature(inputDialog.featureId, normalizedValue);
        }
        break;
      case 'rename-feature':
        if (inputDialog.featureId) {
          success = await handleRenameFeature(inputDialog.featureId, normalizedValue);
        }
        break;
      case 'rename-file':
        if (inputDialog.filePath) {
          success = await handleRenameFile(inputDialog.filePath, normalizedValue);
        }
        break;
      default:
        success = false;
    }

    if (success) {
      closeInputDialog();
    }
  };

  const handleDeleteFeature = async (featureId: string): Promise<boolean> => {
    if (!projectPath) return false;

    const result = await api.deleteFeature(projectPath, featureId);
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return false;
    }

    const remainingFeatures = features.filter((item) => item.id !== featureId);
    setFeatures(remainingFeatures);
    await onRefreshTree();

    if (activeFeatureId === featureId) {
      const nextFeature = remainingFeatures[0] ?? null;
      setActiveFeatureId(nextFeature?.id ?? null);
      if (nextFeature) {
        await switchFeature(nextFeature.id);
      } else {
        setCanvasFiles([]);
        setActiveCanvasFile(null);
        setCanvasContent('');
        setConversations([]);
        setActiveConversationId(null);
        setMessages([]);
        setActiveWritingGoal(null);
      }
    }

    addToast('success', `Deleted feature: ${featureId}`);
    return true;
  };

  const featureNodes = getFeatureNodes(canvasTree);

  return (
    <div className="feature-explorer">
      {/* OS 이모지 패널에서 선택된 이모지를 캡처하기 위한 숨겨진 input */}
      <input
        ref={emojiInputRef}
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
        onInput={(e) => {
          const target = e.target as HTMLInputElement;
          const emoji = target.value;
          const featureId = emojiTargetFeatureIdRef.current;
          if (emoji && featureId) {
            handleSetFeatureIcon(featureId, emoji);
          }
          target.value = '';
          emojiTargetFeatureIdRef.current = null;
        }}
      />
      <div className="feature-explorer-header">
        <span className="feature-explorer-title">Features</span>
        <div className="feature-explorer-actions">
          <button
            type="button"
            className="feature-explorer-action-btn"
            onClick={openCreateFeatureDialog}
            title="New feature"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 4.5V12.5C2 13.05 2.45 13.5 3 13.5H13C13.55 13.5 14 13.05 14 12.5V5.5C14 4.95 13.55 4.5 13 4.5H8L6.5 3H3C2.45 3 2 3.45 2 4V4.5Z" />
            </svg>
            <span>+</span>
          </button>
          <button
            type="button"
            className="feature-explorer-action-btn"
            onClick={onRefreshTree}
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1.5 6.5C2.5 3.5 5 1.5 8 1.5C11.5 1.5 14.5 4.5 14.5 8C14.5 11.5 11.5 14.5 8 14.5C5 14.5 2.5 12.5 1.5 9.5" />
              <path d="M1.5 2.5V6.5H5.5" />
            </svg>
          </button>
        </div>
      </div>
      <div className="feature-explorer-tree">
        {featureNodes.length === 0 ? (
          <div className="feature-explorer-empty">
            No features yet.
          </div>
        ) : (
          featureNodes.map((entry) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              activeFile={activeCanvasFile}
              activeFeatureId={activeFeatureId}
              isActiveFeatureBusy={isActiveFeatureBusy}
              features={features}
              onSelect={onSelectFile}
              onSelectFeature={switchFeature}
              onStartFeatureDrag={handleStartFeatureDrag}
              onCancelFeatureDrag={handleCancelFeatureDrag}
              onDropFeature={handleDropFeature}
              expandedFolders={expandedFolders}
              onToggleFolder={handleToggleFolder}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {inputDialog && (
        <div className="feature-explorer-input-overlay">
          <button
            type="button"
            className="feature-explorer-input-backdrop"
            onClick={closeInputDialog}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeInputDialog();
            }}
            aria-label="Close dialog"
          />
          <div
            className="feature-explorer-input-modal"
            role="dialog"
            aria-modal="true"
          >
            <h4>{inputDialog.title}</h4>
            {inputDialog.mode !== 'delete-feature' && inputDialog.mode !== 'delete-file' && (
              <input
                ref={inputFieldRef}
                type="text"
                value={inputValue}
                placeholder={inputDialog.placeholder}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSubmitInputDialog();
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeInputDialog();
                  }
                }}
              />
            )}
            <div className="feature-explorer-input-actions">
              <button type="button" onClick={closeInputDialog}>Cancel</button>
              <button
                type="button"
                className={inputDialog.mode === 'delete-feature' || inputDialog.mode === 'delete-file' ? 'danger' : 'primary'}
                onClick={handleSubmitInputDialog}
              >
                {inputDialog.submitLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.entry.type === 'folder' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  openCreateFileDialog(contextMenu.entry.path);
                  setContextMenu(null);
                }}
              >
                New File
              </button>
              <button
                type="button"
                onClick={() => {
                  openRenameFeatureDialog(contextMenu.entry.path);
                  setContextMenu(null);
                }}
              >
                Rename Feature
              </button>
              <button
                type="button"
                onClick={() => {
                  openSetFeatureIconDialog(contextMenu.entry.path);
                  setContextMenu(null);
                }}
              >
                Set Icon
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  const featureId = contextMenu.entry.path;
                  const feature = findFeature(featureId, features);
                  openInputDialog({
                    mode: 'delete-feature',
                    title: `Delete "${feature?.name ?? featureId}" and all its files?`,
                    placeholder: '',
                    submitLabel: 'Delete',
                    featureId,
                    initialValue: '',
                  });
                  setContextMenu(null);
                }}
              >
                Delete Feature
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onSelectFile(contextMenu.entry.path);
                  setContextMenu(null);
                }}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => {
                  openRenameFileDialog(contextMenu.entry.path, contextMenu.entry.name);
                  setContextMenu(null);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  openInputDialog({
                    mode: 'delete-file',
                    title: `Delete "${contextMenu.entry.name}"?`,
                    placeholder: '',
                    submitLabel: 'Delete',
                    filePath: contextMenu.entry.path,
                    initialValue: '',
                  });
                  setContextMenu(null);
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
