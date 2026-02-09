import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Gemini, OpenAI, Claude } from '@lobehub/icons';
import { useStore, Message, AiProvider } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import { api } from '../api';
import { Logo } from './Logo';
import './ChatPanel.css';

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  );
}

// Provider별 아이콘과 표시 이름 매핑
const PROVIDER_INFO: Record<AiProvider, { name: string; icon: React.ReactNode }> = {
  gemini: {
    name: 'Gemini',
    icon: <Gemini.Color size={20} />,
  },
  openai: {
    name: 'Codex',
    icon: <OpenAI size={20} />,
  },
  anthropic: {
    name: 'Claude',
    icon: <Claude.Avatar size={20} />,
  },
};

function getProviderInfo(provider?: AiProvider) {
  if (provider && PROVIDER_INFO[provider]) {
    return PROVIDER_INFO[provider];
  }
  // provider 정보가 없는 기존 메시지 호환용 폴백
  return { name: 'AI Canvas', icon: <Logo /> };
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const conversationMenuRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, aiRun, isAuthenticated, activeProvider, setActiveProvider,
    isCodexAuthenticated, isAnthropicAuthenticated, projectPath, conversations, activeConversationId,
    setConversations, setActiveConversationId, setMessages } = useStore();
  const { sendMessage } = useChatRequest();

  // Provider별 인증 상태 매핑
  const authStatusMap: Record<AiProvider, boolean> = {
    gemini: isAuthenticated,
    openai: isCodexAuthenticated,
    anthropic: isAnthropicAuthenticated,
  };

  // 현재 활성 Provider가 미인증 상태면 인증된 Provider로 자동 전환
  useEffect(() => {
    if (!authStatusMap[activeProvider]) {
      const authenticatedProvider = (Object.keys(authStatusMap) as AiProvider[]).find(p => authStatusMap[p]);
      if (authenticatedProvider) {
        setActiveProvider(authenticatedProvider);
      }
    }
  }, [isAuthenticated, isCodexAuthenticated, isAnthropicAuthenticated]);

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
    }, 300);

    return () => window.clearTimeout(timer);
  }, [messages, projectPath]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (providerMenuRef.current && !providerMenuRef.current.contains(target)) {
        setIsProviderMenuOpen(false);
      }
      if (conversationMenuRef.current && !conversationMenuRef.current.contains(target)) {
        setIsConversationMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        setIsProviderMenuOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeConversation = activeConversationId
    ? conversations.find((conv) => conv.id === activeConversationId) ?? null
    : null;

  const handleNewConversation = () => {
    const nextIndex = conversations.length;
    const newConversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
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
            {!isAuthenticated && (
              <p className="auth-hint">Sign in with the {activeProvider === 'openai' ? 'Codex' : activeProvider === 'anthropic' ? 'Anthropic' : 'Gemini'} button in the top right</p>
            )}
          </div>
        ) : (
          messages.map((msg: Message, index: number) => {
            if (msg.role === 'assistant' && !msg.content) {
              return null;
            }
            const isLastAssistantMessage = msg.role === 'assistant' && index === messages.length - 1;
            const showInlineProgress = isLastAssistantMessage && isUpdatingCanvas && msg.content;
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
                    isLoading && msg.role === 'assistant' && <span className="typing-indicator">●●●</span>
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
                {getProviderInfo(activeProvider).icon}
              </div>
              <span className="ai-name">{getProviderInfo(activeProvider).name}</span>
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
            <div className="provider-selector" ref={providerMenuRef}>
              <button 
                type="button" 
                className="provider-btn"
                onClick={() => setIsProviderMenuOpen(!isProviderMenuOpen)}
                title="Select AI model (Ctrl+.)"
              >
                {PROVIDER_INFO[activeProvider].icon}
                <ChevronDownIcon />
              </button>
              
              {isProviderMenuOpen && (
                <div className="provider-menu">
                  {(Object.keys(PROVIDER_INFO) as AiProvider[]).map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      className={`provider-menu-item ${activeProvider === provider ? 'active' : ''}`}
                      onClick={() => {
                        setActiveProvider(provider);
                        setIsProviderMenuOpen(false);
                      }}
                    >
                      <span className="provider-icon">{PROVIDER_INFO[provider].icon}</span>
                      <span className="provider-name">{PROVIDER_INFO[provider].name}</span>
                      {activeProvider === provider && <div className="active-dot" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
