import path from 'node:path';
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type AgentSessionEvent,
  type AuthCredential,
} from '@mariozechner/pi-coding-agent';
import { getGlobalCanvasRoot } from '../project/path';
import type {
  AiAgentChatChunk,
  AiAgentChatRequest,
  AiAgentChatResult,
  AiAgentJsonEvent,
} from './types';

const RUNTIME_ROOT = path.join(getGlobalCanvasRoot(), 'pi-runtime');
const AUTH_PATH = path.join(RUNTIME_ROOT, 'auth.json');
const MODELS_PATH = path.join(RUNTIME_ROOT, 'models.json');

export interface OAuthLoginCallbacks {
  onAuth: (info: { url: string; instructions?: string }) => void;
  onPrompt: (prompt: { message: string; placeholder?: string; allowEmpty?: boolean }) => Promise<string>;
  onProgress?: (message: string) => void;
  onManualCodeInput?: () => Promise<string>;
  signal?: AbortSignal;
}

const SUPPORTED_AUTH_PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    apiKeySupported: true,
    oauthSupported: true,
  },

  {
    id: 'openai-codex',
    label: 'OpenAI (OAuth: ChatGPT Plus/Pro)',
    apiKeySupported: false,
    oauthSupported: true,
  },
  {
    id: 'github-copilot',
    label: 'GitHub Copilot',
    apiKeySupported: false,
    oauthSupported: true,
  },
] as const;

export type SupportedAuthProvider = (typeof SUPPORTED_AUTH_PROVIDERS)[number]['id'];

export interface RuntimeAuthProviderStatus {
  id: SupportedAuthProvider;
  label: string;
  apiKeySupported: boolean;
  oauthSupported: boolean;
  connected: boolean;
  credentialType: AuthCredential['type'] | null;
}

export interface AppModelInfo {
  id: string;
  name: string;
  providerId?: string;
  modelId?: string;
}

let runtimeProjectPath: string | null = null;
let authStorageSingleton: AuthStorage | null = null;
let modelRegistrySingleton: ModelRegistry | null = null;
const activeSessions = new Set<AgentSession>();

function getAuthStorage(): AuthStorage {
  if (!authStorageSingleton) {
    authStorageSingleton = AuthStorage.create(AUTH_PATH);
  }
  return authStorageSingleton;
}

function getModelRegistry(): ModelRegistry {
  if (!modelRegistrySingleton) {
    modelRegistrySingleton = new ModelRegistry(getAuthStorage(), MODELS_PATH);
  }
  return modelRegistrySingleton;
}

function resolveWorkingDirectory(): string {
  return runtimeProjectPath ?? process.cwd();
}

function resolveModelFromId(modelId: string | undefined) {
  if (!modelId) return undefined;

  const slashIndex = modelId.indexOf('/');
  if (slashIndex <= 0 || slashIndex >= modelId.length - 1) {
    return undefined;
  }

  const provider = modelId.slice(0, slashIndex);
  const providerModelId = modelId.slice(slashIndex + 1);
  return getModelRegistry().find(provider, providerModelId);
}

function createThinkingEvent(text: string): AiAgentJsonEvent {
  return { type: 'thinking', text };
}

function createToolUseEvent(toolName: string): AiAgentJsonEvent {
  return {
    type: 'tool_use',
    tool: { name: toolName },
    name: toolName,
  };
}

function createToolFinishEvent(): AiAgentJsonEvent {
  return { type: 'step_finish' };
}

function extractLastAssistantText(session: AgentSession): string {
  const messages = session.messages;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;

    const content = message.content;
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      const chunks: string[] = [];
      for (const part of content) {
        if (
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          part.type === 'text' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          chunks.push(part.text);
        }
      }
      return chunks.join('');
    }

    return '';
  }

  return '';
}

function handleSessionEvent(event: AgentSessionEvent, onChunk?: (chunk: AiAgentChatChunk) => void): string | null {
  if (event.type === 'message_update') {
    const assistantEvent = event.assistantMessageEvent;
    if (assistantEvent.type === 'text_delta') {
      onChunk?.({ text: assistantEvent.delta });
      return assistantEvent.delta;
    }

    if (assistantEvent.type === 'thinking_delta') {
      const thinking = assistantEvent.delta.trim();
      if (thinking.length > 0) {
        onChunk?.({ event: createThinkingEvent(thinking) });
      }
    }
  }

  if (event.type === 'tool_execution_start') {
    onChunk?.({ event: createToolUseEvent(event.toolName) });
  }

  if (event.type === 'tool_execution_end') {
    onChunk?.({ event: createToolFinishEvent() });
  }

  return null;
}

async function createRuntimeSession(
  modelId: string | undefined,
  systemInstruction?: string,
): Promise<AgentSession> {
  const modelRegistry = getModelRegistry();
  modelRegistry.refresh();

  const model = resolveModelFromId(modelId);
  const result = await createAgentSession({
    cwd: resolveWorkingDirectory(),
    authStorage: getAuthStorage(),
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory(),
    ...(model ? { model } : {}),
  });

  const instruction = systemInstruction?.trim();
  if (instruction) {
    result.session.agent.setSystemPrompt(instruction);
  }

  return result.session;
}

export async function chatWithAiAgent(
  request: AiAgentChatRequest,
  onChunk?: (chunk: AiAgentChatChunk) => void,
): Promise<AiAgentChatResult> {
  const session = await createRuntimeSession(request.model, request.systemInstruction);
  activeSessions.add(session);

  let accumulatedText = '';
  const unsubscribe = session.subscribe((event) => {
    const delta = handleSessionEvent(event, onChunk);
    if (delta) {
      accumulatedText += delta;
    }
  });

  try {
    await session.prompt(request.prompt);

    if (accumulatedText.trim().length === 0) {
      accumulatedText = extractLastAssistantText(session);
    }

    if (accumulatedText.trim().length === 0) {
      return { success: false, error: 'pi SDK가 빈 응답을 반환했습니다' };
    }

    onChunk?.({ done: true });
    return { success: true, text: accumulatedText };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onChunk?.({ error: message });
    return { success: false, error: message };
  } finally {
    unsubscribe();
    session.dispose();
    activeSessions.delete(session);
  }
}

export function listAuthProviderStatuses(): RuntimeAuthProviderStatus[] {
  const authStorage = getAuthStorage();

  return SUPPORTED_AUTH_PROVIDERS.map((provider) => {
    const credential = authStorage.get(provider.id);
    return {
      ...provider,
      connected: authStorage.hasAuth(provider.id),
      credentialType: credential?.type ?? null,
    };
  });
}

export async function setApiKeyForProvider(providerId: SupportedAuthProvider, key: string): Promise<void> {
  const provider = SUPPORTED_AUTH_PROVIDERS.find((item) => item.id === providerId);
  if (!provider || !provider.apiKeySupported) {
    throw new Error('API Key를 지원하지 않는 provider입니다');
  }

  const authStorage = getAuthStorage();
  const trimmed = key.trim();

  if (trimmed.length === 0) {
    const current = authStorage.get(providerId);
    if (current?.type === 'api_key') {
      authStorage.remove(providerId);
    }
  } else {
    authStorage.set(providerId, { type: 'api_key', key: trimmed });
  }

  getModelRegistry().refresh();
}

export async function loginOAuthProvider(providerId: SupportedAuthProvider, callbacks: OAuthLoginCallbacks): Promise<void> {
  const provider = SUPPORTED_AUTH_PROVIDERS.find((item) => item.id === providerId);
  if (!provider || !provider.oauthSupported) {
    throw new Error('OAuth를 지원하지 않는 provider입니다');
  }

  const authStorage = getAuthStorage();
  await authStorage.login(providerId, callbacks);
  getModelRegistry().refresh();
}

export async function logoutProvider(providerId: SupportedAuthProvider): Promise<void> {
  const authStorage = getAuthStorage();
  authStorage.logout(providerId);
  getModelRegistry().refresh();
}

export async function fetchModelsViaSdk(): Promise<AppModelInfo[]> {
  const modelRegistry = getModelRegistry();
  modelRegistry.refresh();

  return modelRegistry.getAvailable().map((model) => ({
    id: `${model.provider}/${model.id}`,
    name: model.name,
    providerId: model.provider,
    modelId: model.id,
  }));
}

export function configureAiAgentRuntime(projectPath: string | null): void {
  runtimeProjectPath = projectPath;
}

export function getAiAgentProjectPath(): string | null {
  return runtimeProjectPath;
}

export function shutdownAiAgentRuntime(): void {
  for (const session of activeSessions) {
    session.dispose();
  }
  activeSessions.clear();
}
