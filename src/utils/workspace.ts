import { type Message, type Conversation, type AutosaveStatus } from '../store/useStore';

export function parseStoredMessages(rawMessages: unknown[] | undefined): Message[] {
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
        id: typeof item.id === 'string' ? item.id : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role,
        content: item.content,
        timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
        provider: item.provider === 'gemini' || item.provider === 'openai' || item.provider === 'anthropic' ? item.provider : undefined,
      });
  });

  return parsed;
}

export function createConversationId() {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createConversationTitle(index: number) {
  return `Chat ${index + 1}`;
}

export function parseWorkspace(rawWorkspace: unknown) {
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
    : Array.isArray(data.canvasFiles)
      ? data.canvasFiles.filter((item) => typeof item === 'string')
      : null;

  return { conversations, activeConversationId, canvasOrder };
}

export function parseShareBundle(rawBundle: unknown) {
  if (!rawBundle || typeof rawBundle !== 'object') return null;
  const data = rawBundle as Record<string, unknown>;

  const workspace = parseWorkspace(data);
  if (!workspace) return null;

  const canvasContent = typeof data.canvasContent === 'string' ? data.canvasContent : undefined;

  let autosaveStatus: AutosaveStatus | undefined;
  if (data.autosaveStatus && typeof data.autosaveStatus === 'object') {
     const rawStatus = data.autosaveStatus as Record<string, unknown>;
     autosaveStatus = {
        state: (rawStatus.state === 'idle' || rawStatus.state === 'saving' || rawStatus.state === 'saved' || rawStatus.state === 'error') ? rawStatus.state as AutosaveStatus['state'] : 'idle',
        updatedAt: typeof rawStatus.updatedAt === 'number' ? rawStatus.updatedAt : undefined,
        message: typeof rawStatus.message === 'string' ? rawStatus.message : undefined,
     };
  }

  return {
    ...workspace,
    canvasContent,
    autosaveStatus
  };
}
