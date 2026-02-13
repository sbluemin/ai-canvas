import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useShallow } from 'zustand/react/shallow';
import { useStore, Message } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import { api } from '../api';
import { AUTOSAVE_DELAY, generateId } from '../utils';
import { Logo } from './Logo';
import './ChatPanel.css';
import { PlusIcon, MicrophoneIcon, SendIcon, ChevronDownIcon } from './Icons';


const OPENCODE_INFO = {
  name: 'OpenCode',
  icon: <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>OC</span>,
};

function getProviderInfo(provider?: string) {
  if (provider === 'opencode') {
    return OPENCODE_INFO;
  }
  return { name: 'AI Canvas', icon: <Logo /> };
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationMenuRef = useRef<HTMLDivElement>(null);
  
  const {
    messages, isLoading, aiRun, projectPath, conversations, activeConversationId,
    setConversations, setActiveConversationId, setMessages
  } = useStore(useShallow((state) => ({
    messages: state.messages,
    isLoading: state.isLoading,
    aiRun: state.aiRun,
    projectPath: state.projectPath,
    conversations: state.conversations,
    activeConversationId: state.activeConversationId,
    setConversations: state.setConversations,
    setActiveConversationId: state.setActiveConversationId,
    setMessages: state.setMessages,
  })));
  const { sendMessage } = useChatRequest();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!projectPath) return;

    const timer = window.setTimeout(() => {
      const serialized = messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }));

      api.writeChatSession(projectPath, serialized).catch((error: unknown) => {
        console.error('Chat session save failed:', error);
      });
    }, AUTOSAVE_DELAY);

    return () => window.clearTimeout(timer);
  }, [messages, projectPath]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (conversationMenuRef.current && !conversationMenuRef.current.contains(target)) {
        setIsConversationMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeConversation = activeConversationId
    ? conversations.find((conv) => conv.id === activeConversationId) ?? null
    : null;

  const handleNewConversation = () => {
    const nextIndex = conversations.length;
    const newConversation = {
      id: generateId('conv'),
      title: `Chat ${nextIndex + 1}`,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations([...conversations, newConversation]);
    setActiveConversationId(newConversation.id);
    setMessages([]);
    setIsConversationMenuOpen(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    const conversation = conversations.find((conv) => conv.id === conversationId);
    if (!conversation) return;
    setActiveConversationId(conversationId);
    setMessages(conversation.messages);
    setIsConversationMenuOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const prompt = input.trim();
    setInput('');
    await sendMessage(prompt);
  };

  const isUpdatingCanvas = aiRun?.phase === 'updating';
  const hasFailed = aiRun?.phase === 'failed';
  const hasAssistantTailMessage = messages.length > 0 && messages[messages.length - 1].role === 'assistant';

  return (
    <div className="chat-panel">
      <div className="chat-topbar">
        <div className="conversation-selector" ref={conversationMenuRef}>
          <button
            type="button"
            className={`conversation-btn ${isConversationMenuOpen ? 'active' : ''}`}
            onClick={() => setIsConversationMenuOpen(!isConversationMenuOpen)}
          >
            <span>{activeConversation?.title ?? 'Select Chat'}</span>
            <ChevronDownIcon />
          </button>
          {isConversationMenuOpen && (
            <div className="conversation-menu">
              <button type="button" className="conversation-action" onClick={handleNewConversation}>
                New Chat
              </button>
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`conversation-item ${conversation.id === activeConversationId ? 'active' : ''}`}
                  onClick={() => handleSelectConversation(conversation.id)}
                >
                  <span className="conversation-title">{conversation.title}</span>
                  <span className="conversation-count">{conversation.messages.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Logo />
            </div>
            <h3>How can I help you?</h3>
            <p className="hint">Ask me about your project ideas</p>
          </div>
        ) : (
          messages.map((msg: Message, index: number) => {
            const isLastAssistantMessage = msg.role === 'assistant' && index === messages.length - 1;
            const showInlineProgress = isLastAssistantMessage && isUpdatingCanvas && isLoading;
            if (msg.role === 'assistant' && !msg.content && !showInlineProgress) {
              return null;
            }
            const providerInfo = msg.role === 'assistant' ? getProviderInfo(msg.provider) : null;
            
            return (
              <div key={msg.id} className={`message ${msg.role}`}>
                {msg.role === 'assistant' && providerInfo && (
                  <div className="message-header">
                    <div className="ai-avatar">
                      {providerInfo.icon}
                    </div>
                    <span className="ai-name">{providerInfo.name}</span>
                  </div>
                )}
                <div className="message-content">
                  {msg.content ? (
                    msg.role === 'assistant' ? (
                      <>
                        <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{msg.content}</Markdown>
                        {showInlineProgress && (
                          <div className="progress-indicator inline-progress">
                            <span className="typing-indicator">●●●</span>
                            <span className="progress-text">Updating canvas...</span>
                          </div>
                        )}
                      </>
                    ) : (
                      msg.content
                    )
                  ) : (
                    msg.role === 'assistant' &&
                    (showInlineProgress ? (
                      <div className="progress-indicator inline-progress">
                        <span className="typing-indicator">●●●</span>
                        <span className="progress-text">Updating canvas...</span>
                      </div>
                    ) : (
                      isLoading && <span className="typing-indicator">●●●</span>
                    ))
                  )}
                </div>

              </div>
            );
          })
        )}
        {isLoading && !isUpdatingCanvas && !hasFailed && !hasAssistantTailMessage && (
          <div className="message assistant">
            <div className="message-header">
              <div className="ai-avatar">
                {OPENCODE_INFO.icon}
              </div>
              <span className="ai-name">{OPENCODE_INFO.name}</span>
            </div>
            <div className="message-content">
              <div className="progress-indicator">
                <span className="typing-indicator">●●●</span>
                <span className="progress-text">Generating response...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <form className="input-form" onSubmit={handleSubmit}>
            <button type="button" className="input-action-btn" title="Attach file">
              <PlusIcon />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
            />
            <button type="button" className="input-action-btn mic-btn" title="Voice input">
              <MicrophoneIcon />
            </button>
            <button 
              type="submit" 
              className="send-btn"
              disabled={isLoading || !input.trim()}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
