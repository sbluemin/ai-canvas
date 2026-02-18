import { useState, useEffect, useCallback, useRef } from 'react';
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
  mode: 'create-feature' | 'rename-feature' | 'new-file' | 'set-icon';
  title: string;
  placeholder: string;
  submitLabel: string;
  featureId?: string;
  initialValue: string;
  allowEmpty?: boolean;
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
  return canvasTree.filter((entry) => entry.type === 'folder');
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
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M3 2l4 3-4 3V2z" />
            </svg>
          </span>
          <svg className="tree-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 1h5l1 1H14.5a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-12A.5.5 0 0 1 1.5 1z"/>
          </svg>
          <span className="tree-label">{`${feature?.icon ? `${feature.icon} ` : ''}${feature?.name ?? entry.name}`}</span>
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
      <svg className="tree-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0H4zM9 1v3.5A1.5 1.5 0 0 0 10.5 6H13v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5z"/>
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

  useEffect(() => {
    onRefreshTree();
  }, [onRefreshTree]);

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

  const openSetFeatureIconDialog = (featureId: string) => {
    const feature = findFeature(featureId, features);
    openInputDialog({
      mode: 'set-icon',
      title: `Set icon for ${featureId}`,
      placeholder: 'emoji or text (empty to clear)',
      submitLabel: 'Apply',
      featureId,
      initialValue: feature?.icon ?? '',
      allowEmpty: true,
    });
  };

  const handleSubmitInputDialog = async () => {
    if (!inputDialog) return;

    const normalizedValue = inputValue.trim();
    if (!inputDialog.allowEmpty && !normalizedValue) {
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
      case 'set-icon':
        if (inputDialog.featureId) {
          success = await handleSetFeatureIcon(inputDialog.featureId, inputValue);
        }
        break;
      default:
        success = false;
    }

    if (success) {
      closeInputDialog();
    }
  };

  const handleDeleteFeature = async (featureId: string) => {
    if (!projectPath) return;
    const feature = findFeature(featureId, features);
    const confirmed = confirm(`Delete feature "${feature?.name ?? featureId}" and all its files?`);
    if (!confirmed) return;

    const result = await api.deleteFeature(projectPath, featureId);
    if (!result.success) {
      addToast('error', `Failed: ${result.error}`);
      return;
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

    addToast('success', `Deleted feature: ${feature?.name ?? featureId}`);
  };

  const featureNodes = getFeatureNodes(canvasTree);

  return (
    <div className="feature-explorer">
      <div className="feature-explorer-header">
        <span className="feature-explorer-title">Features</span>
        <div className="feature-explorer-actions">
          <button
            type="button"
            className="feature-explorer-action-btn"
            onClick={openCreateFeatureDialog}
            title="New feature"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1h5l1 1H14.5a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-12A.5.5 0 0 1 1.5 1z"/>
            </svg>
            <span>+</span>
          </button>
          <button
            type="button"
            className="feature-explorer-action-btn"
            onClick={onRefreshTree}
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
              <path d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A5.501 5.501 0 0 1 13.5 8a.5.5 0 0 1-1 0 4.5 4.5 0 0 0-4.5-4.5zM2.5 8a.5.5 0 0 1 1 0 4.5 4.5 0 0 0 8.357 2.318.5.5 0 1 1 .771.636A5.501 5.501 0 0 1 2.5 8z"/>
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
        <div className="feature-explorer-input-overlay" onClick={closeInputDialog}>
          <div className="feature-explorer-input-modal" onClick={(event) => event.stopPropagation()}>
            <h4>{inputDialog.title}</h4>
            <input
              autoFocus
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
            <div className="feature-explorer-input-actions">
              <button type="button" onClick={closeInputDialog}>Cancel</button>
              <button type="button" className="primary" onClick={handleSubmitInputDialog}>{inputDialog.submitLabel}</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
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
                  handleDeleteFeature(contextMenu.entry.path);
                  setContextMenu(null);
                }}
              >
                Delete Feature
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                onSelectFile(contextMenu.entry.path);
                setContextMenu(null);
              }}
            >
              Open
            </button>
          )}
        </div>
      )}
    </div>
  );
}
