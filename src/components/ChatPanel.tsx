import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Gemini, OpenAI, Claude } from '@lobehub/icons';
import { useShallow } from 'zustand/react/shallow';
import { useStore, Message, AiProvider } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import { api } from '../api';
import './ChatPanel.css';

function AICanvasMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="AI Canvas">
      <defs>
        <linearGradient id="aic-grad" x1="5" y1="19" x2="20" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#D8B4FE" />
          <stop offset="0.5" stopColor="#818CF8" />
          <stop offset="1" stopColor="#93C5FD" />
        </linearGradient>
        <filter id="aic-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.55" result="blur"/>
          <feComposite in="SourceGraphic" in2="blur" operator="over"/>
        </filter>
        <filter id="aic-sparkle" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.28" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* 캔버스 프레임 */}
      <g transform="translate(12 12) rotate(-8) translate(-12 -12)">
        <rect x="5.9" y="7.1" width="12.2" height="9.8" rx="2.6" fill="white" fillOpacity="0.10" stroke="white" strokeOpacity="0.22" strokeWidth="0.9" />
        <rect x="7.4" y="8.6" width="9.2" height="6.8" rx="2.0" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="0.7" />
      </g>

      {/* 메인 스트로크 + 하이라이트 */}
      <g filter="url(#aic-glow)">
        <path d="M6.4 16.2C8.5 13.6 10.6 13.0 13.4 11.3C15.0 10.4 16.2 9.5 17.5 8.2" stroke="url(#aic-grad)" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.7 16.5C8.8 13.9 10.9 13.3 13.7 11.6C15.3 10.7 16.5 9.8 17.8 8.5" stroke="white" strokeOpacity="0.3" strokeWidth="0.4" strokeLinecap="round" fill="none" style={{ mixBlendMode: 'overlay' as const }} />
      </g>

      {/* 스파클 포인트 */}
      <g transform="translate(18.4 7.4)" filter="url(#aic-sparkle)">
        <path d="M0 -2.25 C0.19 -0.75, 0.75 -0.19, 2.25 0 C0.75 0.19, 0.19 0.75, 0 2.25 C-0.19 0.75, -0.75 0.19, -2.25 0 C-0.75 -0.19, -0.19 -0.75, 0 -2.25Z" fill="#FFFFFF" />
        <circle r="0.56" fill="#D8B4FE" opacity="0.4" />
        <circle cx="-1.9" cy="1.4" r="0.28" fill="#93C5FD" opacity="0.9" />
        <circle cx="1.4" cy="1.9" r="0.38" fill="#D8B4FE" opacity="0.7" />
        <circle cx="1.9" cy="-0.9" r="0.19" fill="#FFFFFF" opacity="0.6" />
      </g>
    </svg>
  );
}

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
  return { name: 'AI Canvas', icon: <AICanvasMark /> };
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const conversationMenuRef = useRef<HTMLDivElement>(null);
  
  const {
    messages, isLoading, aiRun, isAuthenticated, activeProvider, setActiveProvider,
    isCodexAuthenticated, isAnthropicAuthenticated, projectPath, conversations, activeConversationId,
    setConversations, setActiveConversationId, setMessages
  } = useStore(useShallow((state) => ({
    messages: state.messages,
    isLoading: state.isLoading,
    aiRun: state.aiRun,
    isAuthenticated: state.isAuthenticated,
    activeProvider: state.activeProvider,
    setActiveProvider: state.setActiveProvider,
    isCodexAuthenticated: state.isCodexAuthenticated,
    isAnthropicAuthenticated: state.isAnthropicAuthenticated,
    projectPath: state.projectPath,
    conversations: state.conversations,
    activeConversationId: state.activeConversationId,
    setConversations: state.setConversations,
    setActiveConversationId: state.setActiveConversationId,
    setMessages: state.setMessages,
  })));
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
              <AICanvasMark />
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
