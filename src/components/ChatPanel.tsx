import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { useStore, Message } from '../store/useStore';
import { api } from '../shared/api';
import { parseAIResponse } from '../shared/ai/parser';
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

      {/* 캔버스 프레임 */}
      <g transform="translate(12 12) rotate(-8) translate(-12 -12)">
        <rect x="5.9" y="7.1" width="12.2" height="9.8" rx="2.6" fill="white" fillOpacity="0.10" stroke="white" strokeOpacity="0.22" strokeWidth="0.9" />
        <rect x="7.4" y="8.6" width="9.2" height="6.8" rx="2.0" fill="none" stroke="white" strokeOpacity="0.14" strokeWidth="0.7" />
      </g>

      {/* AI 스트로크 */}
      <path d="M6.4 16.2C8.5 13.6 10.6 13.0 13.4 11.3C15.0 10.4 16.2 9.5 17.5 8.2" stroke="url(#aic-accent)" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.7 16.5C8.8 13.9 10.9 13.3 13.7 11.6C15.3 10.7 16.5 9.8 17.8 8.5" stroke="url(#aic-accent2)" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />

      {/* 스파클 */}
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

function ThumbUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    isLoading,
    canvasContent,
    addMessage,
    updateLastMessage,
    setLastMessageContent,
    setCanvasContent,
    setIsLoading,
    applyToCanvas,
  } = useStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const prompt = input.trim();
    setInput('');
    addMessage('user', prompt);
    addMessage('assistant', '');
    setIsLoading(true);

    const history = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    let fullResponse = '';

    await api.chat(
      prompt,
      {
        onText: (text) => {
          fullResponse += text;
          updateLastMessage(text);
        },
        onError: (error) => updateLastMessage(`\n[오류: ${error}]`),
        onDone: () => {
          const parsed = parseAIResponse(fullResponse);
          if (parsed.success && parsed.data) {
            setLastMessageContent(parsed.data.message);
            if (parsed.data.canvasContent) {
              setCanvasContent(parsed.data.canvasContent);
            }
          } else if (parsed.fallback && parsed.data) {
            setLastMessageContent(parsed.data.message);
          }
          setIsLoading(false);
        },
      },
      history,
      { canvasContent }
    );
  };

  const handleApplyToCanvas = (content: string) => {
    applyToCanvas(content);
  };

  const toggleThinking = (messageId: string) => {
    setExpandedThinking((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

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
          </div>
        ) : (
          messages.map((msg: Message) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="message-header">
                  <div className="ai-avatar">
                    <AICanvasMark />
                  </div>
                  <span className="ai-name">AI Canvas</span>
                </div>
              )}
              <div className="message-content">
                {msg.content ? (
                  msg.role === 'assistant' ? (
                    <Markdown>{msg.content}</Markdown>
                  ) : (
                    msg.content
                  )
                ) : (
                  isLoading && msg.role === 'assistant' && <span className="typing-indicator">●●●</span>
                )}
              </div>
              {msg.role === 'assistant' && msg.content && (
                <div className="message-footer">
                  <button
                    className="thinking-toggle"
                    onClick={() => toggleThinking(msg.id)}
                  >
                    <ChevronRightIcon />
                    <span>생각하는 과정 {expandedThinking.has(msg.id) ? '숨기기' : '표시'}</span>
                  </button>
                  <div className="feedback-buttons">
                    <button className="feedback-btn" title="좋아요">
                      <ThumbUpIcon />
                    </button>
                    <button className="feedback-btn" title="싫어요">
                      <ThumbDownIcon />
                    </button>
                  </div>
                  <button
                    className="apply-button"
                    onClick={() => handleApplyToCanvas(msg.content)}
                    title="캔버스에 적용"
                  >
                    + Canvas
                  </button>
                </div>
              )}
              {expandedThinking.has(msg.id) && (
                <div className="thinking-process">
                  <p>사용자의 요청을 분석하고 있습니다...</p>
                  <p>관련 정보를 검색 중...</p>
                  <p>응답을 생성하고 있습니다...</p>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <div className="canvas-badge">Canvas</div>
          <form className="input-form" onSubmit={handleSubmit}>
            <button type="button" className="input-action-btn" title="파일 첨부">
              <PlusIcon />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..."
              disabled={isLoading}
            />
            <button type="button" className="input-action-btn mic-btn" title="음성 입력">
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
