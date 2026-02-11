import { expect, test, describe, beforeEach } from 'bun:test';
import { useStore } from './useStore';
import type { Message, Conversation } from './useStore';
import type { AiProvider } from '../types/chat';

describe('useStore', () => {
  beforeEach(() => {
    useStore.setState({
      messages: [],
      conversations: [],
      activeConversationId: null,
    });
  });

  describe('addMessage', () => {
    test('adds a message to the store (no active conversation)', () => {
      const { addMessage } = useStore.getState();

      addMessage('user', 'Hello world');

      const { messages } = useStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello world');
      expect(messages[0].id).toBeDefined();
      expect(messages[0].timestamp).toBeInstanceOf(Date);
      expect(messages[0].provider).toBeUndefined();
    });

    test('adds a message with provider', () => {
      const { addMessage } = useStore.getState();
      const provider: AiProvider = 'gemini';

      addMessage('assistant', 'Response', provider);

      const { messages } = useStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toBe('Response');
      expect(messages[0].provider).toBe(provider);
    });

    test('updates active conversation when adding a message', () => {
      const conversationId = 'conv-1';
      const initialMessage: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Initial',
        timestamp: new Date(),
      };

      const conversation: Conversation = {
        id: conversationId,
        title: 'Test Chat',
        messages: [initialMessage],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useStore.setState({
        conversations: [conversation],
        activeConversationId: conversationId,
        messages: [initialMessage],
      });

      const { addMessage } = useStore.getState();

      // Wait a bit to ensure timestamp update is noticeable if precision is high
      // But for test purposes, just checking it changed is enough.
      const initialUpdatedAt = conversation.updatedAt;

      // Simulate slight delay to ensure updatedAt changes
      // In a real environment, Date.now() might return same value if executed too fast.
      // We can mock Date.now() but bun:test makes it easy to just run.
      // If needed, we can sleep for 1ms.

      addMessage('assistant', 'New response');

      const state = useStore.getState();

      // Check messages updated
      expect(state.messages).toHaveLength(2);
      expect(state.messages[1].content).toBe('New response');

      // Check conversation updated
      const updatedConv = state.conversations.find(c => c.id === conversationId);
      expect(updatedConv).toBeDefined();
      if (updatedConv) {
          expect(updatedConv.messages).toHaveLength(2);
          expect(updatedConv.messages[1].content).toBe('New response');
          // We can't strictly guarantee > if it runs instantly, but it should be >=
          expect(updatedConv.updatedAt).toBeGreaterThanOrEqual(initialUpdatedAt);
      }
    });

    test('does not affect other conversations', () => {
      const activeId = 'active-1';
      const otherId = 'other-1';

      const activeConv: Conversation = {
        id: activeId,
        title: 'Active',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const otherConv: Conversation = {
        id: otherId,
        title: 'Other',
        messages: [], // Should remain empty
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      useStore.setState({
        conversations: [activeConv, otherConv],
        activeConversationId: activeId,
        messages: [],
      });

      const { addMessage } = useStore.getState();
      addMessage('user', 'Message for active');

      const state = useStore.getState();

      // Check active conversation
      const updatedActive = state.conversations.find(c => c.id === activeId);
      expect(updatedActive?.messages).toHaveLength(1);

      // Check other conversation
      const updatedOther = state.conversations.find(c => c.id === otherId);
      expect(updatedOther?.messages).toHaveLength(0);
    });
  });
});
