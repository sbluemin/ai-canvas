import { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useShallow } from 'zustand/react/shallow';
import { useStore, Message, FileMention } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import { api } from '../api';
import { AUTOSAVE_DELAY, generateId } from '../utils';
import { Logo } from './Logo';
import './ChatPanel.css';
import { PlusIcon, MicrophoneIcon, SendIcon, ChevronDownIcon } from './Icons';


const FILE_MENTION_REGEX = /(^|\s)@([^\s@]+)/g;
const ACTIVE_MENTION_REGEX = /(^|\s)@([^\s@]*)$/;
const MAX_MENTION_SUGGESTIONS = 8;

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

function TypingDots() {
  return (
    <span className="typing-indicator">
      <span className="dot" />
      <span className="dot" />
      <span className="dot" />
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
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    messages, isLoading, aiRun, projectPath, activeFeatureId, conversations, activeConversationId,
    runtimeStatus, onboardingDismissed, openOnboarding,
    setConversations, setActiveConversationId, setMessages
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
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
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
  }, [messages]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextInput = e.target.value;
    const cursor = e.target.selectionStart ?? nextInput.length;
    setInput(nextInput);
    refreshMentionSuggestions(nextInput, cursor);
  };

  const handleInputSelect = () => {
    const element = inputRef.current;
    if (!element) {
      return;
    }
    const cursor = element.selectionStart ?? element.value.length;
    refreshMentionSuggestions(element.value, cursor);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionSuggestions.length === 0) {
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

    if (e.key === 'Enter' || e.key === 'Tab') {
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
    if (!input.trim() || isLoading || isChatLocked) return;

    const prompt = input.trim();
    const fileMentions = extractFileMentions(prompt, projectFiles);
    closeMentionMenu();
    setInput('');
    await sendMessage(prompt, { fileMentions: fileMentions.length > 0 ? fileMentions : undefined });
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
                            <TypingDots />
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
                        <TypingDots />
                        <span className="progress-text">Updating canvas...</span>
                      </div>
                    ) : (
                      isLoading && <TypingDots />
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
              {AI_CANVAS_INFO.icon}
              </div>
              <span className="ai-name">{AI_CANVAS_INFO.name}</span>
            </div>
            <div className="message-content">
              <div className="progress-indicator">
                <TypingDots />
                <span className="progress-text">Generating response...</span>
              </div>
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
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onSelect={handleInputSelect}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a message... (use @path/to/file)"
              disabled={isLoading || isChatLocked}
            />
            <button type="button" className="input-action-btn mic-btn" title="Voice input">
              <MicrophoneIcon />
            </button>
            <button 
              type="submit" 
              className="send-btn"
              disabled={isLoading || isChatLocked || !input.trim()}
            >
              <SendIcon />
            </button>
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
