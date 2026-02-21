import { StateCreator } from 'zustand';
import { AppState, ChatSlice, Message, ThinkingActivity } from '../types';
import { generateId } from '../utils';

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set) => ({
  messages: [],
  conversations: [],
  activeConversationId: null,
  isLoading: false,
  aiRun: null,

  addMessage: (role, content, provider?, fileMentions?) =>
    set((state) => {
      const nextMessage: Message = {
        id: generateId(),
        role,
        content,
        timestamp: new Date(),
        ...(provider ? { provider } : {}),
        ...(fileMentions && fileMentions.length > 0 ? { fileMentions } : {}),
      };
      const nextMessages = [...state.messages, nextMessage];
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages: nextMessages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages: nextMessages, conversations: nextConversations };
    }),

  removeLastUserMessage: () =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
        messages.pop();
      }
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  removeLastAssistantMessage: () =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages.pop();
      }
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  updateLastMessage: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content: messages[messages.length - 1].content + content,
        };
      }
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  setLastMessageContent: (content) =>
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content,
        };
      }
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  setConversations: (conversations) => set({ conversations }),

  setActiveConversationId: (activeConversationId) => set({ activeConversationId }),

  setIsLoading: (isLoading) => set({ isLoading }),

  clearMessages: () => set({ messages: [] }),

  setMessages: (messages) =>
    set((state) => {
      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;
      return { messages, conversations: nextConversations };
    }),

  appendLastAssistantThinkingActivity: (activity) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex < 0 || messages[lastIndex].role !== 'assistant') {
        return {};
      }

      const lastMessage = messages[lastIndex];
      const existingActivities = [...(lastMessage.thinkingActivities ?? [])].map((item) =>
        item.status === 'pending'
          ? { ...item, status: 'completed' as const }
          : item
      );
      const nextActivity: ThinkingActivity = {
        id: generateId('thinking'),
        kind: activity.kind,
        label: activity.label,
        status: 'pending',
        timestamp: Date.now(),
        ...(activity.detail ? { detail: activity.detail } : {}),
      };

      messages[lastIndex] = {
        ...lastMessage,
        thinkingActivities: [...existingActivities, nextActivity],
        thinkingCollapsed: false,
        thinkingStartedAt: lastMessage.thinkingStartedAt ?? Date.now(),
        ...(lastMessage.thinkingCompletedAt ? { thinkingCompletedAt: undefined } : {}),
      };

      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;

      return { messages, conversations: nextConversations };
    }),

  completeLastAssistantThinkingActivity: () =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex < 0 || messages[lastIndex].role !== 'assistant') {
        return {};
      }

      const lastMessage = messages[lastIndex];
      const existingActivities = [...(lastMessage.thinkingActivities ?? [])];
      let pendingIndex = -1;
      for (let i = existingActivities.length - 1; i >= 0; i -= 1) {
        if (existingActivities[i].status === 'pending') {
          pendingIndex = i;
          break;
        }
      }
      if (pendingIndex < 0) {
        return {};
      }

      existingActivities[pendingIndex] = {
        ...existingActivities[pendingIndex],
        status: 'completed',
      };

      messages[lastIndex] = {
        ...lastMessage,
        thinkingActivities: existingActivities,
      };

      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;

      return { messages, conversations: nextConversations };
    }),

  completeLastAssistantThinking: () =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex < 0 || messages[lastIndex].role !== 'assistant') {
        return {};
      }

      const lastMessage = messages[lastIndex];
      const existingActivities = [...(lastMessage.thinkingActivities ?? [])];
      if (existingActivities.length === 0) {
        return {};
      }

      const normalizedActivities = existingActivities.map((item) =>
        item.status === 'pending'
          ? { ...item, status: 'completed' as const }
          : item
      );

      messages[lastIndex] = {
        ...lastMessage,
        thinkingActivities: normalizedActivities,
        thinkingCollapsed: true,
        thinkingStartedAt: lastMessage.thinkingStartedAt ?? normalizedActivities[0].timestamp,
        thinkingCompletedAt: Date.now(),
      };

      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;

      return { messages, conversations: nextConversations };
    }),

  setMessageThinkingCollapsed: (messageId, collapsed) =>
    set((state) => {
      const messageIndex = state.messages.findIndex((message) => message.id === messageId);
      if (messageIndex < 0) {
        return {};
      }

      const targetMessage = state.messages[messageIndex];
      if (!targetMessage.thinkingActivities || targetMessage.thinkingActivities.length === 0) {
        return {};
      }

      const messages = [...state.messages];
      messages[messageIndex] = {
        ...targetMessage,
        thinkingCollapsed: collapsed,
      };

      const nextConversations = state.activeConversationId
        ? state.conversations.map((conv) =>
            conv.id === state.activeConversationId
              ? { ...conv, messages, updatedAt: Date.now() }
              : conv
          )
        : state.conversations;

      return { messages, conversations: nextConversations };
    }),

  startAiRun: () => {
    const runId = generateId();
    set({
      aiRun: {
        runId,
        phase: 'evaluating',
      },
    });
    return runId;
  },

  setAiPhase: (phase) =>
    set((state) => ({
      aiRun: state.aiRun ? { ...state.aiRun, phase } : null,
    })),

  setAiRunResult: (result) =>
    set((state) => ({
      aiRun: state.aiRun ? { ...state.aiRun, ...result } : null,
    })),

  clearAiRun: () => set({ aiRun: null }),

  saveCanvasSnapshot: () =>
    set((state) => ({
      aiRun: state.aiRun
        ? { ...state.aiRun, canvasSnapshot: state.canvasContent }
        : null,
    })),
});
