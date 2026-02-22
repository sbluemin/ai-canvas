import { useStore, type Message, type Conversation, type AutosaveStatus, type SelectedModels, type FeatureSummary } from '../../../store/useStore';
import { api } from '../../../api';
import { generateId } from '../../../utils';
import './ProjectSelector.css';

interface WorkspaceData {
  featureOrder: string[] | null;
  activeFeatureId: string | null;
  selectedModels: Partial<SelectedModels> | null;
  selectedVariant: string | null;
  featureConversations: Record<string, Conversation[]>;
  featureActiveConversationIds: Record<string, string | null>;
}

function parseStoredMessages(rawMessages: unknown[] | undefined): Message[] {
  if (!Array.isArray(rawMessages)) return [];

  const parsed: Message[] = [];

  rawMessages.forEach((msg) => {
    if (!msg || typeof msg !== 'object') return;
    const item = msg as Record<string, unknown>;
    const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
    if (!role || typeof item.content !== 'string') return;

    const rawTimestamp = item.timestamp;
    const timestamp = rawTimestamp instanceof Date
      ? rawTimestamp
      : typeof rawTimestamp === 'string' || typeof rawTimestamp === 'number'
        ? new Date(rawTimestamp)
        : new Date();

    parsed.push({
      id: typeof item.id === 'string' ? item.id : generateId(),
      role,
      content: item.content,
      timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
      provider: item.provider === 'opencode' ? item.provider : undefined,
    });
  });

  return parsed;
}

function parseStoredConversations(rawConversations: unknown[] | undefined): Conversation[] {
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

    const conv = item as Record<string, unknown>;
    return {
      id: typeof conv.id === 'string' ? conv.id : generateId('conv'),
      title: typeof conv.title === 'string' ? conv.title : `Chat ${index + 1}`,
      messages: parseStoredMessages(Array.isArray(conv.messages) ? conv.messages : []),
      createdAt: typeof conv.createdAt === 'number' ? conv.createdAt : Date.now(),
      updatedAt: typeof conv.updatedAt === 'number' ? conv.updatedAt : Date.now(),
    };
  });
}

function parseSelectedModels(raw: unknown): Partial<SelectedModels> | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const parsed: Partial<SelectedModels> = {};
  const opencode = data.opencode;
  if (typeof opencode === 'string' || opencode === null) {
    parsed.opencode = opencode;
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}

function parseWorkspace(rawWorkspace: unknown): WorkspaceData {
  if (!rawWorkspace || typeof rawWorkspace !== 'object') {
    return {
      featureOrder: null,
      activeFeatureId: null,
      selectedModels: null,
      selectedVariant: null,
      featureConversations: {},
      featureActiveConversationIds: {},
    };
  }

  const data = rawWorkspace as Record<string, unknown>;
  const featureOrder = Array.isArray(data.featureOrder)
    ? data.featureOrder.filter((item): item is string => typeof item === 'string')
    : null;

  const featureConversationsRaw = data.featureConversations;
  const featureConversations: Record<string, Conversation[]> = {};
  if (featureConversationsRaw && typeof featureConversationsRaw === 'object') {
    Object.entries(featureConversationsRaw as Record<string, unknown>).forEach(([featureId, value]) => {
      featureConversations[featureId] = parseStoredConversations(Array.isArray(value) ? value : []);
    });
  }

  const activeIdsRaw = data.featureActiveConversationIds;
  const featureActiveConversationIds: Record<string, string | null> = {};
  if (activeIdsRaw && typeof activeIdsRaw === 'object') {
    Object.entries(activeIdsRaw as Record<string, unknown>).forEach(([featureId, value]) => {
      featureActiveConversationIds[featureId] = typeof value === 'string' ? value : null;
    });
  }

  return {
    featureOrder,
    activeFeatureId: typeof data.activeFeatureId === 'string' ? data.activeFeatureId : null,
    selectedModels: parseSelectedModels(data.selectedModels),
    selectedVariant: typeof data.selectedVariant === 'string' || data.selectedVariant === null
      ? data.selectedVariant
      : null,
    featureConversations,
    featureActiveConversationIds,
  };
}

function orderFeatures(features: FeatureSummary[], featureOrder: string[] | null): FeatureSummary[] {
  if (!featureOrder || featureOrder.length === 0) {
    return features;
  }

  const byId = new Map(features.map((feature) => [feature.id, feature]));
  const ordered = featureOrder
    .map((featureId) => byId.get(featureId))
    .filter((feature): feature is FeatureSummary => Boolean(feature));
  const remaining = features.filter((feature) => !featureOrder.includes(feature.id));
  return [...ordered, ...remaining];
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

export function ProjectSelector() {
  const {
    projectPath,
    setProjectPath,
    setFeatures,
    setActiveFeatureId,
    setCanvasFiles,
    setActiveCanvasFile,
    setCanvasContent,
    setCanvasTree,
    clearMessages,
    setMessages,
    setConversations,
    setActiveConversationId,
    setAutosaveStatus,
    restoreSelectedModels,
    setSelectedVariant,
    setActiveWritingGoal,
    setRuntimeStatus,
    setRuntimeError,
    openOnboarding,
    closeOnboarding,
    setOnboardingDismissed,
  } = useStore();

  const loadFeatureContext = async (nextProjectPath: string, featureId: string, workspace: WorkspaceData) => {
    const filesResult = await api.listFeatureCanvasFiles(nextProjectPath, featureId);
    const files = filesResult.success && filesResult.files ? filesResult.files : [];
    setCanvasFiles(files);

    const sessionResult = await api.readChatSession(nextProjectPath, featureId);
    const sessionMessages = sessionResult.success && sessionResult.messages
      ? parseStoredMessages(sessionResult.messages)
      : [];

    const storedConversations = workspace.featureConversations[featureId] ?? [];
    if (storedConversations.length > 0) {
      const preferredActiveConversationId = workspace.featureActiveConversationIds[featureId] ?? null;
      const activeConversationId = preferredActiveConversationId
        && storedConversations.some((conv) => conv.id === preferredActiveConversationId)
        ? preferredActiveConversationId
        : storedConversations[0].id;

      setConversations(storedConversations);
      setActiveConversationId(activeConversationId);
      const activeConversation = storedConversations.find((conv) => conv.id === activeConversationId);
      setMessages(activeConversation ? activeConversation.messages : []);
    } else {
      const fallbackConversation = createDefaultConversation(sessionMessages);
      setConversations([fallbackConversation]);
      setActiveConversationId(fallbackConversation.id);
      setMessages(sessionMessages);
    }

    setActiveWritingGoal(null);

    if (files.length > 0) {
      const firstFile = files[0];
      const readResult = await api.readCanvasFile(nextProjectPath, firstFile);
      if (readResult.success && readResult.content !== undefined) {
        setActiveCanvasFile(firstFile);
        setCanvasContent(readResult.content);
      }
    } else {
      setActiveCanvasFile(null);
      setCanvasContent('');
    }
  };

  const handleOpenProject = async () => {
    const path = await api.openProjectDirectory();
    if (!path) return;

    await api.initCanvasDir(path);
    let featuresResult = await api.listFeatures(path);
    let features = featuresResult.success && featuresResult.features ? featuresResult.features : [];

    if (features.length === 0) {
      await api.createDefaultCanvas(path);
      featuresResult = await api.listFeatures(path);
      features = featuresResult.success && featuresResult.features ? featuresResult.features : [];
    }

    const workspaceResult = await api.readWorkspace(path);
    const workspace = workspaceResult.success ? parseWorkspace(workspaceResult.workspace) : {
      featureOrder: null,
      activeFeatureId: null,
      selectedModels: null,
      selectedVariant: null,
      featureConversations: {},
      featureActiveConversationIds: {},
    };

    const orderedFeatures = orderFeatures(features, workspace.featureOrder);

    setProjectPath(path);
    restoreSelectedModels(workspace.selectedModels);
    setSelectedVariant(workspace.selectedVariant);
    setFeatures(orderedFeatures);
    clearMessages();

    const autosaveResult = await api.readAutosaveStatus(path);
    if (autosaveResult.success && autosaveResult.status && typeof autosaveResult.status === 'object') {
      const rawStatus = autosaveResult.status as Partial<AutosaveStatus>;
      setAutosaveStatus({
        state: rawStatus.state === 'saving' || rawStatus.state === 'saved' || rawStatus.state === 'error' ? rawStatus.state : 'idle',
        updatedAt: typeof rawStatus.updatedAt === 'number' ? rawStatus.updatedAt : Date.now(),
        message: typeof rawStatus.message === 'string' ? rawStatus.message : undefined,
      });
    }

    const activeFeature = workspace.activeFeatureId
      ? orderedFeatures.find((feature) => feature.id === workspace.activeFeatureId) ?? orderedFeatures[0] ?? null
      : orderedFeatures[0] ?? null;
    setActiveFeatureId(activeFeature?.id ?? null);

    if (activeFeature) {
      await loadFeatureContext(path, activeFeature.id, workspace);
    }

    const treeResult = await api.listCanvasTree(path);
    if (treeResult.success && treeResult.tree) {
      setCanvasTree(treeResult.tree as any);
    }

    const runtimeResult = await api.runtimeCheckStatus(path);
    if (runtimeResult.success && runtimeResult.data) {
      const status = runtimeResult.data;
      setRuntimeStatus(status);
      setRuntimeError(null);
      setOnboardingDismissed(status.onboardingDone);

      if (!status.onboardingDone) {
        openOnboarding();
      } else {
        closeOnboarding();
      }
    } else {
      setRuntimeError(runtimeResult.error ?? '런타임 상태를 확인하지 못했습니다');
      openOnboarding();
    }
  };

  const projectName = projectPath ? projectPath.split(/[\\/]/).pop() : null;

  const handleOpenInExplorer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (projectPath) {
      api.openInExplorer(projectPath);
    }
  };

  return (
    <div className="project-selector">
      <button type="button" className="project-open-btn" onClick={handleOpenProject}>
        <div className="project-label">
          <span className="project-name">{projectName ?? 'AI Canvas'}</span>
          <span className="project-selector-arrow">▾</span>
        </div>
      </button>
      {projectPath && (
        <button
          type="button"
          className="open-explorer-btn"
          onClick={handleOpenInExplorer}
          title="Open Folder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
