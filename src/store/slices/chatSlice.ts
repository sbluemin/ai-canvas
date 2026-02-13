import { StateCreator } from 'zustand';
import { AppState, ChatSlice, Message } from '../types';
import { generateId } from '../utils';

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set) => ({
  messages: [],
  conversations: [],
  activeConversationId: null,
  isLoading: false,
  aiRun: null,

  addMessage: (role, content, provider?) =>
    set((state) => {
      const nextMessage: Message = {
        id: generateId(),
        role,
        content,
        timestamp: new Date(),
        ...(provider ? { provider } : {}),
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
