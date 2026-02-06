import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Gemini, OpenAI, Claude, GithubCopilot } from '@lobehub/icons';
import { useStore, Message, AiProvider } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import './ChatPanel.css';

function AICanvasMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="AI Canvas">
      <defs>
        <linearGradient id="aic-accent" x1="5" y1="19" x2="20" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="0.5" stopColor="#818CF8" />
          <stop offset="1" stopColor="#C084FC" />
        </linearGradient>
        <linearGradient id="aic-accent2" x1="6" y1="20" x2="20" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="0.45" stopColor="#60A5FA" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>

      <g transform="translate(12 12) rotate(-8) translate(-12 -12)">
        <rect x="5.9" y="7.1" width="12.2" height="9.8" rx="2.6" fill="white" fillOpacity="0.10" stroke="white" strokeOpacity="0.22" strokeWidth="0.9" />
        <rect x="7.4" y="8.6" width="9.2" height="6.8" rx="2.0" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="0.7" />
      </g>

      <path d="M6.4 16.2C8.5 13.6 10.6 13.0 13.4 11.3C15.0 10.4 16.2 9.5 17.5 8.2" stroke="url(#aic-accent)" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.7 16.5C8.8 13.9 10.9 13.3 13.7 11.6C15.3 10.7 16.5 9.8 17.8 8.5" stroke="url(#aic-accent2)" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />

      <path d="M18.4 4.7L19.2 6.6L21.1 7.4L19.2 8.2L18.4 10.1L17.6 8.2L15.7 7.4L17.6 6.6Z" fill="white" fillOpacity="0.95" />
      <circle cx="17.7" cy="8.8" r="0.9" fill="url(#aic-accent)" />
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

// Provider별 아이콘과 표시 이름 매핑
const PROVIDER_INFO: Record<AiProvider, { name: string; icon: React.ReactNode }> = {
  gemini: {
    name: 'Gemini',
    icon: <Gemini.Color size={20} />,
  },
  openai: {
    name: 'OpenAI',
    icon: <OpenAI size={20} />,
  },
  anthropic: {
    name: 'Claude',
    icon: <Claude.Avatar size={20} />,
  },
  copilot: {
    name: 'GitHub Copilot',
    icon: <GithubCopilot size={20} />,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, aiRun, isAuthenticated, activeProvider } = useStore();
  const { sendMessage } = useChatRequest();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const prompt = input.trim();
    setInput('');
    await sendMessage(prompt);
  };

  const isUpdatingCanvas = aiRun?.phase === 'updating';
  const hasFailed = aiRun?.phase === 'failed';

  return (
    <div className="chat-panel">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <AICanvasMark />
            </div>
            <h3>무엇을 도와드릴까요?</h3>
            <p className="hint">프로젝트 아이디어에 대해 물어보세요</p>
            {!isAuthenticated && (
              <p className="auth-hint">우측 상단의 {activeProvider === 'openai' ? 'OpenAI' : activeProvider === 'anthropic' ? 'Anthropic' : 'Gemini'} 버튼으로 로그인하세요</p>
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
                            <span className="progress-text">캔버스 업데이트 중...</span>
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
        {isLoading && !isUpdatingCanvas && !hasFailed && (
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
                <span className="progress-text">응답 생성 중...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <form className="input-form" onSubmit={handleSubmit}>
            <button type="button" className="input-action-btn" title="파일 첨부">
              <PlusIcon />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              disabled={isLoading || !isAuthenticated}
            />
            <button type="button" className="input-action-btn mic-btn" title="음성 입력">
              <MicrophoneIcon />
            </button>
            <button 
              type="submit" 
              className="send-btn"
              disabled={isLoading || !input.trim() || !isAuthenticated}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
