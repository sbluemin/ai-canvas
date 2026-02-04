import { useState, useEffect, useRef, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Gemini, OpenAI } from '@lobehub/icons';
import { useStore, Message, CanvasProvider } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import './ChatPopup.css';

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

interface ProviderMessagesProps {
  provider: CanvasProvider;
  messages: Message[];
  isLoading: boolean;
  isUpdatingCanvas: boolean;
}

function ProviderMessages({ provider, messages, isLoading, isUpdatingCanvas }: ProviderMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const providerMessages = useMemo(() => 
    messages.filter(msg => {
      if (msg.role === 'user') {
        return !msg.provider || msg.provider === provider;
      }
      return msg.provider === provider;
    }),
    [messages, provider]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [providerMessages]);

  const providerIcon = provider === 'gemini' ? <Gemini.Color size={18} /> : <OpenAI size={18} />;
  const providerName = provider === 'gemini' ? 'Gemini' : 'Codex';
  const providerClass = `provider-${provider}`;

  return (
    <div className={`provider-messages-panel ${providerClass}`}>
      <div className="provider-panel-header">
        {providerIcon}
        <span>{providerName}</span>
      </div>
      <div className="provider-messages-list">
        {providerMessages.length === 0 ? (
          <div className="empty-provider-state">
            <span>메시지가 없습니다</span>
          </div>
        ) : (
          providerMessages.map((msg: Message, index: number) => {
            const isLastAssistantMessage = msg.role === 'assistant' && index === providerMessages.length - 1;
            const showInlineProgress = isLastAssistantMessage && isUpdatingCanvas && msg.content;
            
            return (
              <div key={msg.id} className={`message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="message-header">
                    <div className="ai-avatar">
                      {providerIcon}
                    </div>
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
        {isLoading && !providerMessages.some(m => m.role === 'assistant' && !m.content) && (
          <div className="message assistant">
            <div className="message-header">
              <div className="ai-avatar">
                {providerIcon}
              </div>
            </div>
            <div className="message-content">
              <span className="typing-indicator">●●●</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export function ChatPopup() {
  const [input, setInput] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const { 
    messages, 
    isLoading, 
    providerAiRun,
    isChatPopupOpen, 
    isClosingChatPopup,
    requestCloseChatPopup,
    finishCloseChatPopup,
    isAuthenticated, 
    isCodexAuthenticated 
  } = useStore();
  const { sendMessage } = useChatRequest();

  useEffect(() => {
    if (isChatPopupOpen && !isClosingChatPopup) {
      setIsOpening(true);
      setIsClosing(false);
      const timer = setTimeout(() => setIsOpening(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isChatPopupOpen, isClosingChatPopup]);

  useEffect(() => {
    if (isClosingChatPopup && !isClosing) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        finishCloseChatPopup();
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isClosingChatPopup, isClosing, finishCloseChatPopup]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      requestCloseChatPopup();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const prompt = input.trim();
    setInput('');
    await sendMessage(prompt);
  };

  const hasAnyProvider = isAuthenticated || isCodexAuthenticated;

  if (!isChatPopupOpen) return null;

  const modalClasses = [
    'chat-modal',
    isOpening ? 'opening' : '',
    isClosing ? 'closing' : '',
  ].filter(Boolean).join(' ');

  const overlayClasses = [
    'chat-modal-overlay',
    isOpening ? 'opening' : '',
    isClosing ? 'closing' : '',
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={overlayClasses}
      onClick={handleOverlayClick}
    >
      <div 
        ref={modalRef}
        className={modalClasses}
      >
        <div className="chat-modal-content">
          {!hasAnyProvider ? (
            <div className="no-provider-state">
              <p>AI 프로바이더에 로그인해주세요</p>
              <span className="hint">우측 상단의 Gemini 또는 Codex 버튼을 클릭하세요</span>
            </div>
          ) : (
            <div className="split-messages-container">
              {isAuthenticated && (
                <ProviderMessages 
                  provider="gemini" 
                  messages={messages} 
                  isLoading={providerAiRun.gemini !== null}
                  isUpdatingCanvas={providerAiRun.gemini?.phase === 'updating'}
                />
              )}
              {isCodexAuthenticated && (
                <ProviderMessages 
                  provider="codex" 
                  messages={messages} 
                  isLoading={providerAiRun.codex !== null}
                  isUpdatingCanvas={providerAiRun.codex?.phase === 'updating'}
                />
              )}
            </div>
          )}

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
                  disabled={isLoading || !hasAnyProvider}
                />
                <button type="button" className="input-action-btn mic-btn" title="음성 입력">
                  <MicrophoneIcon />
                </button>
                <button 
                  type="submit" 
                  className="send-btn"
                  disabled={isLoading || !input.trim() || !hasAnyProvider}
                >
                  <SendIcon />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
