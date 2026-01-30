import { useState, useEffect, useRef } from 'react';
import { useStore, Message } from '../store/useStore';
import { api } from '../lib/api';
import './ChatPanel.css';

function GeminiLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 12l10 10 10-10L12 2z" fill="url(#gemini-gradient)" />
      <defs>
        <linearGradient id="gemini-gradient" x1="2" y1="2" x2="22" y2="22">
          <stop stopColor="#4285f4" />
          <stop offset="0.5" stopColor="#9b72cb" />
          <stop offset="1" stopColor="#d96570" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
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
  const [selectedProject, setSelectedProject] = useState('AI Canvas');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    isLoading,
    addMessage,
    updateLastMessage,
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

    await api.chat(prompt, {
      onText: (text) => updateLastMessage(text),
      onError: (error) => updateLastMessage(`\n[오류: ${error}]`),
      onDone: () => setIsLoading(false),
    });
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

  const projects = ['AI Canvas', 'New Project', 'My Documents'];

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="header-left">
          <div className="gemini-logo">
            <GeminiLogo />
          </div>
          <div className="project-dropdown" onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}>
            <span className="project-name">{selectedProject}</span>
            <ChevronDownIcon />
            {isProjectDropdownOpen && (
              <div className="project-menu">
                {projects.map((project) => (
                  <button
                    key={project}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProject(project);
                      setIsProjectDropdownOpen(false);
                    }}
                    className={project === selectedProject ? 'active' : ''}
                  >
                    {project}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <GeminiLogo />
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
                    <GeminiLogo />
                  </div>
                  <span className="ai-name">AI Canvas</span>
                </div>
              )}
              <div className="message-content">
                {msg.content || (isLoading && msg.role === 'assistant' ? <span className="typing-indicator">●●●</span> : '')}
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
