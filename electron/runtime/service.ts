import fs from 'node:fs/promises';
import path from 'node:path';
import {
  type ServiceResult,
  ok,
  fail,
} from '../shared/utils';
import { getGlobalCanvasRoot } from '../project/path';
import {
  configureAiAgentRuntime,
  listAuthProviderStatuses,
  loginOAuthProvider,
  logoutProvider,
  setApiKeyForProvider,
  type RuntimeAuthProviderStatus,
  type SupportedAuthProvider,
} from '../ai/adapter';

const GLOBAL_RUNTIME_DIR = getGlobalCanvasRoot();
const RUNTIME_STATE_PATH = path.join(GLOBAL_RUNTIME_DIR, 'runtime-state.json');

type ActiveRuntime = 'global' | 'none';

interface RuntimeStateFile {
  onboardingDone?: boolean;
}

export interface RuntimeStatus {
  activeRuntime: ActiveRuntime;
  globalInstalled: boolean;
  onboardingDone: boolean;
}

export interface RuntimeAuthSnapshot {
  providers: RuntimeAuthProviderStatus[];
  status: RuntimeStatus;
}

export interface RuntimeOAuthAuthInfo {
  url: string;
  instructions?: string;
}

export interface RuntimeOAuthPrompt {
  message: string;
  placeholder?: string;
  allowEmpty?: boolean;
}

export interface RuntimeOAuthCallbacks {
  onAuth: (info: RuntimeOAuthAuthInfo) => void;
  onPrompt: (prompt: RuntimeOAuthPrompt) => Promise<string>;
  onProgress?: (message: string) => void;
  onManualCodeInput?: () => Promise<string>;
}

function normalizeOnboardingDone(onboardingDone: RuntimeStateFile['onboardingDone']): boolean {
  return onboardingDone === true;
}

async function ensureRuntimeStateDir(): Promise<void> {
  await fs.mkdir(GLOBAL_RUNTIME_DIR, { recursive: true });
}

async function readRuntimeState(): Promise<RuntimeStateFile> {
  try {
    const raw = await fs.readFile(RUNTIME_STATE_PATH, 'utf-8');
    return JSON.parse(raw) as RuntimeStateFile;
  } catch {
    return {};
  }
}

async function writeRuntimeState(patch: RuntimeStateFile): Promise<RuntimeStateFile> {
  const current = await readRuntimeState();
  const next = { ...current, ...patch };
  await ensureRuntimeStateDir();
  await fs.writeFile(RUNTIME_STATE_PATH, JSON.stringify(next), 'utf-8');
  return next;
}

async function buildRuntimeSnapshot(projectPath: string | null): Promise<RuntimeAuthSnapshot> {
  configureAiAgentRuntime(projectPath);

  const runtimeState = await readRuntimeState();
  const onboardingDone = normalizeOnboardingDone(runtimeState.onboardingDone);
  const providers = listAuthProviderStatuses();
  const hasConfiguredAuth = providers.some((provider) => provider.connected);

  return {
    providers,
    status: {
      activeRuntime: hasConfiguredAuth ? 'global' : 'none',
      globalInstalled: hasConfiguredAuth,
      onboardingDone,
    },
  };
}

export async function checkRuntimeStatus(projectPath: string | null): Promise<ServiceResult<RuntimeStatus>> {
  try {
    const snapshot = await buildRuntimeSnapshot(projectPath);
    return ok(snapshot.status);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function listRuntimeAuthProviders(projectPath: string | null): Promise<ServiceResult<RuntimeAuthSnapshot>> {
  try {
    return ok(await buildRuntimeSnapshot(projectPath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function setRuntimeApiKey(
  projectPath: string | null,
  providerId: SupportedAuthProvider,
  key: string,
): Promise<ServiceResult<RuntimeAuthSnapshot>> {
  try {
    await setApiKeyForProvider(providerId, key);
    return ok(await buildRuntimeSnapshot(projectPath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function loginRuntimeOAuth(
  projectPath: string | null,
  providerId: SupportedAuthProvider,
  callbacks: RuntimeOAuthCallbacks,
): Promise<ServiceResult<RuntimeAuthSnapshot>> {
  try {
    await loginOAuthProvider(providerId, {
      onAuth: callbacks.onAuth,
      onPrompt: callbacks.onPrompt,
      onProgress: callbacks.onProgress,
      onManualCodeInput: callbacks.onManualCodeInput,
    });

    return ok(await buildRuntimeSnapshot(projectPath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function logoutRuntimeProvider(
  projectPath: string | null,
  providerId: SupportedAuthProvider,
): Promise<ServiceResult<RuntimeAuthSnapshot>> {
  try {
    await logoutProvider(providerId);
    return ok(await buildRuntimeSnapshot(projectPath));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function completeRuntimeOnboarding(projectPath: string | null): Promise<ServiceResult<RuntimeStatus>> {
  try {
    await writeRuntimeState({ onboardingDone: true });
    const snapshot = await buildRuntimeSnapshot(projectPath);
    return ok(snapshot.status);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export function clearRuntimeContext(): void {
  configureAiAgentRuntime(null);
}
