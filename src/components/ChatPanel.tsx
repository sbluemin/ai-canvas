import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useShallow } from 'zustand/react/shallow';
import { useStore, Message, FileMention, AgentActivity } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import { api } from '../api';
import { AUTOSAVE_DELAY, generateId } from '../utils';
import { Logo } from './Logo';
import './ChatPanel.css';
import { PlusIcon, SendIcon, StopIcon, ChevronDownIcon } from './Icons';
import { ChatModelSelector } from './ChatModelSelector';


const FILE_MENTION_REGEX = /(^|\s)@([^\s@]+)/g;
const ACTIVE_MENTION_REGEX = /(^|\s)@([^\s@]*)$/;
const MAX_MENTION_SUGGESTIONS = 8;
const CHAT_INPUT_MAX_HEIGHT = 160;

interface MentionContext {
  mentionStart: number;
  cursor: number;
  query: string;
}

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

function normalizeMentionPath(rawPath: string): string {
  const trimmed = rawPath
    .trim()
    .replace(/^[\[\{\("'`]+/, '')
    .replace(/[\]\}\)"'`,.!?;:]+$/, '')
    .replace(/\\+/g, '/')
    .replace(/\/+/g, '/');

  if (trimmed.startsWith('./') || trimmed.startsWith('.\\')) {
    return trimmed.slice(2);
  }

  return trimmed;
}

function normalizePathForMatch(filePath: string): string {
  return filePath
    .replace(/\\+/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\.\//, '')
    .toLowerCase();
}

function resolveMentionPath(mentionPath: string, projectFiles: string[]): string | null {
  const normalizedMention = normalizePathForMatch(mentionPath);
  if (!normalizedMention) {
    return null;
  }

  const normalizedProjectFiles = projectFiles.map((filePath) => ({
    filePath,
    normalized: normalizePathForMatch(filePath),
    baseName: getFileName(filePath).toLowerCase(),
  }));

  const exactMatches = normalizedProjectFiles.filter((item) => item.normalized === normalizedMention);
  if (exactMatches.length === 1) {
    return exactMatches[0].filePath;
  }

  const mentionBaseName = getFileName(normalizedMention).toLowerCase();
  const byBasename = normalizedProjectFiles.filter((item) => item.baseName === mentionBaseName);
  if (byBasename.length === 1) {
    return byBasename[0].filePath;
  }

  const suffixMatches = normalizedProjectFiles.filter((item) =>
    normalizedMention === item.normalized || normalizedMention.endsWith(`/${item.normalized}`)
  );
  if (suffixMatches.length === 1) {
    return suffixMatches[0].filePath;
  }

  return null;
}

function extractFileMentions(input: string, projectFiles: string[]): FileMention[] {
  const mentions: FileMention[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null = FILE_MENTION_REGEX.exec(input);

  while (match) {
    const rawPath = match[2];
    const normalizedPath = normalizeMentionPath(rawPath);

    if (normalizedPath) {
      const resolvedPath = resolveMentionPath(normalizedPath, projectFiles);
      if (resolvedPath && !seen.has(resolvedPath)) {
        mentions.push({
          id: generateId('mention'),
          fileName: getFileName(resolvedPath),
          filePath: resolvedPath,
        });
        seen.add(resolvedPath);
      }
    }

    match = FILE_MENTION_REGEX.exec(input);
  }

  FILE_MENTION_REGEX.lastIndex = 0;
  return mentions;
}

function getMentionContext(text: string, cursor: number): MentionContext | null {
  const beforeCursor = text.slice(0, cursor);
  const match = ACTIVE_MENTION_REGEX.exec(beforeCursor);
  if (!match) {
    return null;
  }

  const query = normalizeMentionPath(match[2]);
  const mentionStart = match.index + match[1].length;
  return { mentionStart, cursor, query };
}

function buildMentionSuggestions(query: string, projectFiles: string[]): string[] {
  const normalizedQuery = query.toLowerCase();

  const scored = projectFiles
    .map((filePath) => {
      if (!normalizedQuery) {
        return { filePath, score: 0 };
      }

      const lowerPath = filePath.toLowerCase();
      const lowerName = getFileName(filePath).toLowerCase();

      if (lowerPath.startsWith(normalizedQuery)) {
        return { filePath, score: 0 };
      }

      if (lowerName.startsWith(normalizedQuery)) {
        return { filePath, score: 1 };
      }

      if (lowerPath.includes(normalizedQuery)) {
        return { filePath, score: 2 };
      }

      return null;
    })
    .filter((item): item is { filePath: string; score: number } => item !== null)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      if (a.filePath.length !== b.filePath.length) {
        return a.filePath.length - b.filePath.length;
      }
      return a.filePath.localeCompare(b.filePath);
    });

  return scored.slice(0, MAX_MENTION_SUGGESTIONS).map((item) => item.filePath);
}

const AI_CANVAS_INFO = {
  name: 'AI Canvas',
  icon: <Logo />,
};

function getProviderInfo(_provider?: string) {
  return AI_CANVAS_INFO;
}

/** Gemini 스타일 — Logo 회전 + "생각하는 과정 표시" 텍스트 */
function ThinkingIndicator({ text }: { text?: string }) {
  return (
    <span className="thinking-indicator">
      <span className="thinking-icon">
        <Logo />
      </span>
      {text && <span className="thinking-label">{text}</span>}
    </span>
  );
}


export function ChatPanel() {
  const [input, setInput] = useState('');
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([]);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [isMentionLoading, setIsMentionLoading] = useState(false);
  const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    messages, isLoading, aiRun, projectPath, activeFeatureId, conversations, activeConversationId,
    runtimeStatus, onboardingDismissed, openOnboarding,
    setConversations, setActiveConversationId, setMessages, setMessageActivityCollapsed
  } = useStore(useShallow((state) => ({
    messages: state.messages,
    isLoading: state.isLoading,
    aiRun: state.aiRun,
    projectPath: state.projectPath,
    activeFeatureId: state.activeFeatureId,
    conversations: state.conversations,
    activeConversationId: state.activeConversationId,
    runtimeStatus: state.runtimeStatus,
    onboardingDismissed: state.onboardingDismissed,
    openOnboarding: state.openOnboarding,
    setConversations: state.setConversations,
    setActiveConversationId: state.setActiveConversationId,
    setMessages: state.setMessages,
    setMessageActivityCollapsed: state.setMessageActivityCollapsed,
  }))); 
  const { sendMessage } = useChatRequest();

  const closeMentionMenu = () => {
    setMentionContext(null);
    setMentionSuggestions([]);
    setActiveMentionIndex(0);
  };

  const refreshMentionSuggestions = (text: string, cursor: number) => {
    const context = getMentionContext(text, cursor);
    if (!context) {
      closeMentionMenu();
      return;
    }

    const suggestions = buildMentionSuggestions(context.query, projectFiles);
    setMentionContext(context);
    setMentionSuggestions(suggestions);
    setActiveMentionIndex(0);
  };

  const applyMentionSuggestion = (suggestedPath: string) => {
    if (!mentionContext) {
      return;
    }

    const beforeMention = input.slice(0, mentionContext.mentionStart);
    const afterMention = input.slice(mentionContext.cursor);
    const mentionText = `@${suggestedPath}`;
    const nextInput = `${beforeMention}${mentionText} ${afterMention}`;
    const nextCursor = beforeMention.length + mentionText.length + 1;

    setInput(nextInput);
    closeMentionMenu();

    window.requestAnimationFrame(() => {
      syncInputHeight();
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const syncInputHeight = (element?: HTMLTextAreaElement | null) => {
    const target = element ?? inputRef.current;
    if (!target) {
      return;
    }

    target.style.height = 'auto';
    const nextHeight = Math.min(target.scrollHeight, CHAT_INPUT_MAX_HEIGHT);
    target.style.height = `${nextHeight}px`;
    target.style.overflowY = target.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  };

  useEffect(() => {
    if (!projectPath) {
      setProjectFiles([]);
      setIsMentionLoading(false);
      return;
    }

    let cancelled = false;
    setIsMentionLoading(true);

    api
      .listProjectFiles(projectPath)
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.success && Array.isArray(result.files)) {
          setProjectFiles(result.files);
          return;
        }

        setProjectFiles([]);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        console.error('Project file index load failed:', error);
        setProjectFiles([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsMentionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  useEffect(() => {
    const target = inputRef.current;
    if (!target) {
      return;
    }

    target.style.height = 'auto';
    const nextHeight = Math.min(target.scrollHeight, CHAT_INPUT_MAX_HEIGHT);
    target.style.height = `${nextHeight}px`;
    target.style.overflowY = target.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  });

  useEffect(() => {
    if (!projectPath || !activeFeatureId) return;

    const timer = window.setTimeout(() => {
      const serialized = messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }));

      api.writeChatSession(projectPath, activeFeatureId, serialized).catch((error: unknown) => {
        console.error('Chat session save failed:', error);
      });
    }, AUTOSAVE_DELAY);

    return () => window.clearTimeout(timer);
  }, [messages, projectPath, activeFeatureId]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextInput = e.target.value;
    const cursor = e.target.selectionStart ?? nextInput.length;
    setInput(nextInput);
    refreshMentionSuggestions(nextInput, cursor);
    syncInputHeight(e.target);
  };

  const handleInputSelect = () => {
    const element = inputRef.current;
    if (!element) {
      return;
    }
    const cursor = element.selectionStart ?? element.value.length;
    refreshMentionSuggestions(element.value, cursor);
  };

  const submitInput = async () => {
    if (!input.trim() || isLoading || isChatLocked) return;

    const prompt = input.trim();
    const fileMentions = extractFileMentions(prompt, projectFiles);
    closeMentionMenu();
    setInput('');
    await sendMessage(prompt, { fileMentions: fileMentions.length > 0 ? fileMentions : undefined });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSuggestions.length === 0) {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void submitInput();
        return;
      }

      if (e.key === 'Escape') {
        closeMentionMenu();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveMentionIndex((prev) =>
        prev === 0 ? mentionSuggestions.length - 1 : prev - 1
      );
      return;
    }

    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
      e.preventDefault();
      const selected = mentionSuggestions[activeMentionIndex] ?? mentionSuggestions[0];
      if (selected) {
        applyMentionSuggestion(selected);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      closeMentionMenu();
    }
  };

  const isRuntimeReady = !projectPath || !!(runtimeStatus && runtimeStatus.activeRuntime !== 'none');
  const isChatLocked = projectPath !== null && !isRuntimeReady;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitInput();
  };

  const isUpdatingCanvas = aiRun?.phase === 'updating';
  const hasFailed = aiRun?.phase === 'failed';
  const hasAssistantTailMessage = messages.length > 0 && messages[messages.length - 1].role === 'assistant';
  const showMentionMenu = mentionContext !== null && (isMentionLoading || mentionSuggestions.length > 0);

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
              <div className="conversation-menu-label">History</div>
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
        <button type="button" className="new-chat-btn" title="New Chat" onClick={handleNewConversation}>
          <PlusIcon width={18} height={18} />
        </button>
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
            const agentActivities = msg.agentActivities ?? [];
            const hasActivities = agentActivities.length > 0;
            const isActivityComplete = Boolean(msg.activityCompletedAt);
            const isActivityCollapsed = Boolean(msg.activityCollapsed && isActivityComplete);
            const activitiesId = `agent-activities-${msg.id}`;

            // Thought와 Steps 분리
            const thought = agentActivities.find((a): a is Extract<AgentActivity, { kind: 'thought' }> => a.kind === 'thought');
            const steps = agentActivities.filter((a): a is Extract<AgentActivity, { kind: 'step' }> => a.kind === 'step');

            if (msg.role === 'assistant' && !msg.content && !showInlineProgress && !hasActivities) {
              return null;
            }
            const providerInfo = msg.role === 'assistant' ? getProviderInfo(msg.provider) : null;
            
            return (
              <div key={msg.id} className={`message ${msg.role}`}>
                {msg.role === 'assistant' && hasActivities ? (
                  /* ─── Gemini-style: 메시지 헤더 = "생각하는 과정 표시" 토글 ─── */
                  <>
                    {isActivityComplete ? (
                      <button
                        type="button"
                        className="thinking-toggle"
                        onClick={() => setMessageActivityCollapsed(msg.id, !isActivityCollapsed)}
                        aria-expanded={!isActivityCollapsed}
                        aria-controls={activitiesId}
                      >
                        <div className="thinking-toggle-icon">
                          <Logo />
                        </div>
                        <span className="thinking-toggle-label">생각하는 과정 표시</span>
                        <ChevronDownIcon className={`thinking-toggle-chevron ${isActivityCollapsed ? '' : 'expanded'}`} />
                      </button>
                    ) : (
                      <div className="thinking-toggle is-thinking" aria-live="polite">
                        <div className="thinking-toggle-icon spinning">
                          <Logo />
                        </div>
                        <span className="thinking-toggle-label">생각하는 과정 표시</span>
                        <ChevronDownIcon className="thinking-toggle-chevron expanded" />
                      </div>
                    )}

                    {/* 드롭다운 내용 — 진행 중이면 항상 열림, 완료 후 접기 가능 */}
                    {(!isActivityComplete || !isActivityCollapsed) && (
                      <div id={activitiesId} className="thinking-dropdown">
                        {thought && (
                          <div className="thinking-dropdown-section">
                            <div className="thinking-dropdown-title">{thought.text.split('\n')[0]}</div>
                            <div className="thinking-dropdown-body">
                              <span className="thinking-dropdown-text">{thought.text}</span>
                            </div>
                          </div>
                        )}
                        {steps.length > 0 && steps.map((step, stepIdx) => (
                          <div
                            key={step.id}
                            className={`thinking-dropdown-step ${step.status === 'running' ? 'running' : 'done'}`}
                            style={{ animationDelay: `${Math.min(stepIdx * 45, 220)}ms` }}
                          >
                            <span className="thinking-dropdown-step-label">{step.label}</span>
                            {step.tool && (
                              <span className="thinking-dropdown-step-detail">
                                {step.tool}{step.target ? `: ${step.target}` : ''}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  msg.role === 'assistant' && providerInfo && (
                    <div className="message-header">
                      <div className="ai-avatar">
                        {providerInfo.icon}
                      </div>
                      <span className="ai-name">{providerInfo.name}</span>
                    </div>
                  )
                )}
                <div className="message-content">
                  {msg.role === 'user' && msg.fileMentions && msg.fileMentions.length > 0 && (
                    <div className="message-file-mentions">
                      {msg.fileMentions.map((mention) => (
                        <div key={mention.id} className="message-file-mention-item">
                          <span className="file-mention-path">@{mention.filePath}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.content ? (
                    msg.role === 'assistant' ? (
                      <>
                        <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>{msg.content}</Markdown>
                        {showInlineProgress && (
                          <div className="progress-indicator inline-progress">
                            <ThinkingIndicator text="캔버스 업데이트 중..." />
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
                        <ThinkingIndicator text="캔버스 업데이트 중..." />
                      </div>
                    ) : (
                      isLoading && !hasActivities && <ThinkingIndicator />
                    ))
                  )}
                </div>

              </div>
            );
          })
        )}
        {isLoading && !isUpdatingCanvas && !hasFailed && !hasAssistantTailMessage && (
          <div className="message assistant">
            <div className="thinking-toggle is-thinking" aria-live="polite">
              <div className="thinking-toggle-icon spinning">
                <Logo />
              </div>
              <span className="thinking-toggle-label">생각하는 과정 표시</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        {isChatLocked && onboardingDismissed && (
          <div className="chat-lock-banner">
            <span>AI 채팅을 사용하려면 엔진 설정이 필요합니다.</span>
            <button type="button" onClick={openOnboarding}>설정 열기</button>
          </div>
        )}
        <div className="input-wrapper">
          <form className="input-form" onSubmit={handleSubmit}>
            <div className="input-header">
              <ChatModelSelector />
            </div>

            <div className="input-body">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onSelect={handleInputSelect}
                onKeyDown={handleInputKeyDown}
                placeholder="Type a message... (use @path/to/file)"
                disabled={isLoading || isChatLocked}
                rows={1}
              />
              {isLoading ? (
                <button
                  type="button"
                  className="send-btn stop-btn"
                  onClick={() => { /* 현재 요청 중지 — 향후 구현 */ }}
                  title="응답 중지"
                >
                  <StopIcon />
                </button>
              ) : (
                <button
                  type="submit"
                  className="send-btn"
                  disabled={isChatLocked || !input.trim()}
                >
                  <SendIcon />
                </button>
              )}
            </div>
          </form>
          {showMentionMenu && (
            <div className="mention-autocomplete" role="listbox" aria-label="File mention suggestions">
              {isMentionLoading ? (
                <div className="mention-autocomplete-item mention-autocomplete-info">
                  Indexing project files...
                </div>
              ) : (
                mentionSuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={`mention-autocomplete-item ${index === activeMentionIndex ? 'active' : ''}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applyMentionSuggestion(suggestion);
                    }}
                  >
                    <span className="mention-autocomplete-path">@{suggestion}</span>
                    <span className="mention-autocomplete-name">{getFileName(suggestion)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
