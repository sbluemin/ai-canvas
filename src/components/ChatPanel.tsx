import { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useShallow } from 'zustand/react/shallow';
import { useStore, Message, Attachment } from '../store/useStore';
import { useChatRequest } from '../hooks/useChatRequest';
import { api } from '../api';
import { AUTOSAVE_DELAY, generateId } from '../utils';
import { Logo } from './Logo';
import './ChatPanel.css';
import { PlusIcon, MicrophoneIcon, SendIcon, ChevronDownIcon, CloseIcon, PaperclipIcon } from './Icons';


const SUPPORTED_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

const SUPPORTED_EXTENSIONS = Object.keys(SUPPORTED_MIME_TYPES);

function getMimeType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return SUPPORTED_MIME_TYPES[ext] || 'application/octet-stream';
}

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

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
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationMenuRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);
  
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

  const handleAttachFiles = useCallback(async () => {
    if (!api.isElectron) return;
    const filePaths = await api.showOpenDialogForAttachments();
    if (filePaths.length === 0) return;

    const newAttachments: Attachment[] = [];
    for (const filePath of filePaths) {
      const mimeType = getMimeType(filePath);
      const fileName = getFileName(filePath);
      try {
        const base64 = await api.readFileAsBase64(filePath);
        const thumbnailUrl = mimeType.startsWith('image/')
          ? `data:${mimeType};base64,${base64}`
          : undefined;
        newAttachments.push({
          id: generateId('attach'),
          fileName,
          mimeType,
          filePath,
          base64,
          thumbnailUrl,
        });
      } catch (error) {
        console.error(`Failed to read file: ${filePath}`, error);
      }
    }
    setPendingAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const removeAttachment = useCallback((attachmentId: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!api.isElectron) return;

    const files = Array.from(e.dataTransfer.files || []);
    const validFiles = files.filter((file) => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext);
    });

    if (validFiles.length === 0) return;

    const newAttachments: Attachment[] = [];
    for (const file of validFiles) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1] ?? '');
          };
          reader.onerror = () => reject(new Error('File read failed'));
          reader.readAsDataURL(file);
        });
        const mimeType = file.type || getMimeType(file.name);
        const thumbnailUrl = mimeType.startsWith('image/')
          ? `data:${mimeType};base64,${base64}`
          : undefined;
        newAttachments.push({
          id: generateId('attach'),
          fileName: file.name,
          mimeType,
          filePath: file.name,
          base64,
          thumbnailUrl,
        });
      } catch (error) {
        console.error(`Failed to read dropped file: ${file.name}`, error);
      }
    }
    setPendingAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!projectPath) return;

    const timer = window.setTimeout(() => {
      const serialized = messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
        // Strip base64 and thumbnailUrl from attachments to avoid bloating session file
        ...(msg.attachments ? {
          attachments: msg.attachments.map(({ base64: _b, thumbnailUrl: _t, ...rest }) => rest),
        } : {}),
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
    if ((!input.trim() && pendingAttachments.length === 0) || isLoading) return;

    const prompt = input.trim();
    const attachments = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    setInput('');
    setPendingAttachments([]);
    await sendMessage(prompt || 'Please analyze the attached file(s).', { attachments });
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
                  {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                    <div className="message-attachments">
                      {msg.attachments.map((att) => (
                        <div key={att.id} className="message-attachment-item">
                          {att.thumbnailUrl ? (
                            <img src={att.thumbnailUrl} alt={att.fileName} className="attachment-thumbnail-msg" />
                          ) : (
                            <div className="attachment-file-icon">
                              <PaperclipIcon />
                            </div>
                          )}
                          <span className="attachment-name-msg">{att.fileName}</span>
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

      <div className="input-area" ref={inputAreaRef} onDragOver={handleDragOver} onDrop={handleDrop}>
        <div className="input-wrapper">
          {pendingAttachments.length > 0 && (
            <div className="attachment-preview-bar">
              {pendingAttachments.map((att) => (
                <div key={att.id} className="attachment-preview-item">
                  {att.thumbnailUrl ? (
                    <img src={att.thumbnailUrl} alt={att.fileName} className="attachment-thumbnail" />
                  ) : (
                    <div className="attachment-file-badge">
                      <PaperclipIcon />
                    </div>
                  )}
                  <span className="attachment-filename">{att.fileName}</span>
                  <button
                    type="button"
                    className="attachment-remove-btn"
                    onClick={() => removeAttachment(att.id)}
                    title="Remove attachment"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form className="input-form" onSubmit={handleSubmit}>
            <button type="button" className="input-action-btn" title="Attach file" onClick={handleAttachFiles} disabled={isLoading}>
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
              disabled={isLoading || (!input.trim() && pendingAttachments.length === 0)}
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
