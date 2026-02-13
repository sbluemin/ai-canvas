import { useStore, type Message, type Conversation, type AutosaveStatus, type SelectedModels } from '../../../store/useStore';
import { api } from '../../../api';
import { generateId } from '../../../utils';
import './ProjectSelector.css';

function parseStoredMessages(rawMessages: unknown[] | undefined): Message[] {
  if (!Array.isArray(rawMessages)) return [];

  const parsed: Message[] = [];

  rawMessages.forEach((msg) => {
      if (!msg || typeof msg !== 'object') return null;
      const item = msg as Record<string, unknown>;
      const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
      if (!role || typeof item.content !== 'string') return null;

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
        provider: item.provider === 'gemini' || item.provider === 'openai' || item.provider === 'anthropic' ? item.provider : undefined,
      });
  });

  return parsed;
}

function createConversationId() {
  return generateId('conv');
}

function createConversationTitle(index: number) {
  return `Chat ${index + 1}`;
}

function parseSelectedModels(raw: unknown): Partial<SelectedModels> | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const parsed: Partial<SelectedModels> = {};

  const gemini = data.gemini;
  if (typeof gemini === 'string' || gemini === null) {
    parsed.gemini = gemini;
  }

  const openai = data.openai;
  if (typeof openai === 'string' || openai === null) {
    parsed.openai = openai;
  }

  const anthropic = data.anthropic;
  if (typeof anthropic === 'string' || anthropic === null) {
    parsed.anthropic = anthropic;
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}

function parseWorkspace(rawWorkspace: unknown) {
  if (!rawWorkspace || typeof rawWorkspace !== 'object') return null;
  const data = rawWorkspace as Record<string, unknown>;

  const rawConversations = Array.isArray(data.conversations) ? data.conversations : null;
  const conversations: Conversation[] = rawConversations
    ? rawConversations.map((item, index) => {
        if (!item || typeof item !== 'object') {
          return {
            id: createConversationId(),
            title: createConversationTitle(index),
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        }
        const conv = item as Record<string, unknown>;
        const id = typeof conv.id === 'string' ? conv.id : createConversationId();
        const title = typeof conv.title === 'string' ? conv.title : createConversationTitle(index);
        const messages = parseStoredMessages(Array.isArray(conv.messages) ? conv.messages : []);
        const createdAt = typeof conv.createdAt === 'number' ? conv.createdAt : Date.now();
        const updatedAt = typeof conv.updatedAt === 'number' ? conv.updatedAt : Date.now();
        return { id, title, messages, createdAt, updatedAt };
      })
    : [];

  const activeConversationId = typeof data.activeConversationId === 'string'
    ? data.activeConversationId
    : null;

  const canvasOrder = Array.isArray(data.canvasOrder)
    ? data.canvasOrder.filter((item) => typeof item === 'string')
    : null;

  const selectedModels = parseSelectedModels(data.selectedModels);

  return { conversations, activeConversationId, canvasOrder, selectedModels };
}

function orderCanvasFiles(files: string[], canvasOrder: string[] | null) {
  if (!canvasOrder || canvasOrder.length === 0) return files;
  const ordered = canvasOrder.filter((file) => files.includes(file));
  const remaining = files.filter((file) => !ordered.includes(file));
  return [...ordered, ...remaining];
}

export function ProjectSelector() {
  const { 
    projectPath, 
    setProjectPath, 
    setCanvasFiles, 
    setActiveCanvasFile, 
    setCanvasContent,
    clearMessages,
    setMessages,
    setConversations,
    setActiveConversationId,
    setAutosaveStatus,
    restoreSelectedModels,
  } = useStore();

  const handleOpenProject = async () => {
    const path = await api.openProjectDirectory();
    if (!path) return;

    await api.initCanvasDir(path);
    const listResult = await api.listCanvasFiles(path);

    if (!listResult.success || !listResult.files) {
      console.error('캔버스 파일 목록 조회 실패:', listResult.error);
      return;
    }

    let files = listResult.files;

    if (files.length === 0) {
      const createResult = await api.createDefaultCanvas(path);
      if (createResult.success && createResult.fileName) {
        files = [createResult.fileName];
      }
    }

    const workspaceResult = await api.readWorkspace(path);
    const workspace = workspaceResult.success ? parseWorkspace(workspaceResult.workspace) : null;

    const orderedFiles = orderCanvasFiles(files, workspace?.canvasOrder ?? null);

    setProjectPath(path);
    restoreSelectedModels(workspace?.selectedModels ?? null);
    setCanvasFiles(orderedFiles);
    clearMessages();

    const sessionResult = await api.readChatSession(path);
    const sessionMessages = sessionResult.success && sessionResult.messages
      ? parseStoredMessages(sessionResult.messages)
      : [];

    if (workspace && workspace.conversations.length > 0) {
      const activeId = workspace.activeConversationId && workspace.conversations.some((conv) => conv.id === workspace.activeConversationId)
        ? workspace.activeConversationId
        : workspace.conversations[0].id;
      setConversations(workspace.conversations);
      setActiveConversationId(activeId);
      const activeConversation = workspace.conversations.find((conv) => conv.id === activeId);
      setMessages(activeConversation ? activeConversation.messages : []);
    } else {
      const defaultConversation: Conversation = {
        id: createConversationId(),
        title: createConversationTitle(0),
        messages: sessionMessages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations([defaultConversation]);
      setActiveConversationId(defaultConversation.id);
      setMessages(sessionMessages);
    }

    const autosaveResult = await api.readAutosaveStatus(path);
    if (autosaveResult.success && autosaveResult.status && typeof autosaveResult.status === 'object') {
      const rawStatus = autosaveResult.status as Partial<AutosaveStatus>;
      setAutosaveStatus({
        state: rawStatus.state === 'saving' || rawStatus.state === 'saved' || rawStatus.state === 'error' ? rawStatus.state : 'idle',
        updatedAt: typeof rawStatus.updatedAt === 'number' ? rawStatus.updatedAt : Date.now(),
        message: typeof rawStatus.message === 'string' ? rawStatus.message : undefined,
      });
    }

    if (orderedFiles.length > 0) {
      const firstFile = orderedFiles[0];
      const readResult = await api.readCanvasFile(path, firstFile);
      if (readResult.success && readResult.content !== undefined) {
        setActiveCanvasFile(firstFile);
        setCanvasContent(readResult.content);
      }
    }
  };

  // Windows(\) / macOS-Linux(/) 경로 구분자 모두 처리
  const projectName = projectPath ? projectPath.split(/[\\/]/).pop() : null;

  const handleOpenInExplorer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (projectPath) {
      api.openInExplorer(projectPath);
    }
  };

  return (
    <div className="project-selector" onClick={handleOpenProject}>
      <div className="project-label">
        <span className="project-name">{projectName ?? 'AI Canvas'}</span>
        <span className="project-selector-arrow">▾</span>
      </div>
      {projectPath && (
        <button
          type="button"
          className="open-explorer-btn"
          onClick={handleOpenInExplorer}
          title="Open Folder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
