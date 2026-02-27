import { StateCreator } from 'zustand';
import { AppState, ChatSlice, Message } from '../types';
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

  appendAgentThought: (text) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex < 0 || messages[lastIndex].role !== 'assistant') {
        return {};
      }

      const lastMessage = messages[lastIndex];
      const activities = [...(lastMessage.agentActivities ?? [])];

      // 기존 thought를 찾아 텍스트 이어붙이기 (없으면 생성)
      const thoughtIdx = activities.findIndex((a) => a.kind === 'thought');
      if (thoughtIdx >= 0) {
        const existing = activities[thoughtIdx];
        if (existing.kind === 'thought') {
          activities[thoughtIdx] = { ...existing, text: existing.text + text };
        }
      } else {
        activities.unshift({ kind: 'thought', text }); // thought는 항상 맨 앞
      }

      messages[lastIndex] = {
        ...lastMessage,
        agentActivities: activities,
        activityCollapsed: false,
        activityStartedAt: lastMessage.activityStartedAt ?? Date.now(),
        ...(lastMessage.activityCompletedAt ? { activityCompletedAt: undefined } : {}),
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

  appendAgentStep: (step) =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex < 0 || messages[lastIndex].role !== 'assistant') {
        return {};
      }

      const lastMessage = messages[lastIndex];
      // 이전 running step을 done으로 변경
      const activities = [...(lastMessage.agentActivities ?? [])].map((a) =>
        a.kind === 'step' && a.status === 'running'
          ? { ...a, status: 'done' as const }
          : a
      );

      activities.push({
        kind: 'step' as const,
        id: generateId('step'),
        label: step.label,
        ...(step.tool ? { tool: step.tool } : {}),
        ...(step.target ? { target: step.target } : {}),
        status: 'running' as const,
        timestamp: Date.now(),
      });

      messages[lastIndex] = {
        ...lastMessage,
        agentActivities: activities,
        activityCollapsed: false,
        activityStartedAt: lastMessage.activityStartedAt ?? Date.now(),
        ...(lastMessage.activityCompletedAt ? { activityCompletedAt: undefined } : {}),
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

  completeAgentActivity: () =>
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex < 0 || messages[lastIndex].role !== 'assistant') {
        return {};
      }

      const lastMessage = messages[lastIndex];
      const activities = [...(lastMessage.agentActivities ?? [])];
      if (activities.length === 0) {
        return {};
      }

      // 모든 running step을 done으로
      const normalized = activities.map((a) =>
        a.kind === 'step' && a.status === 'running'
          ? { ...a, status: 'done' as const }
          : a
      );

      // activityStartedAt 결정
      const firstStep = normalized.find((a) => a.kind === 'step');
      const startAt = lastMessage.activityStartedAt
        ?? (firstStep && firstStep.kind === 'step' ? firstStep.timestamp : Date.now());

      messages[lastIndex] = {
        ...lastMessage,
        agentActivities: normalized,
        activityCollapsed: true,
        activityStartedAt: startAt,
        activityCompletedAt: Date.now(),
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

  setMessageActivityCollapsed: (messageId, collapsed) =>
    set((state) => {
      const messageIndex = state.messages.findIndex((message) => message.id === messageId);
      if (messageIndex < 0) {
        return {};
      }

      const targetMessage = state.messages[messageIndex];
      if (!targetMessage.agentActivities || targetMessage.agentActivities.length === 0) {
        return {};
      }

      const messages = [...state.messages];
      messages[messageIndex] = {
        ...targetMessage,
        activityCollapsed: collapsed,
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
