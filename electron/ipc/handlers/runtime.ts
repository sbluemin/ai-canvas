import { shell } from 'electron';
import { handleIpc } from '../../shared/utils';
import { fetchModelsFromApi } from '../../ai/models';
import * as runtimeService from '../../runtime/service';
import { promptInRenderer, showOAuthInstructionDialog } from '../oauth-prompt';

async function emitRefreshedModels(event: Electron.IpcMainInvokeEvent): Promise<void> {
  const models = await fetchModelsFromApi();
  event.sender.send('runtime:models-refreshed', { success: true, models });
}

export function registerRuntimeHandlers(): void {
  handleIpc('runtime:check-status', async (_event: unknown, projectPath?: string | null) => {
    return runtimeService.checkRuntimeStatus(projectPath ?? null);
  });

  handleIpc('runtime:list-auth-providers', async (_event: unknown, projectPath?: string | null) => {
    return runtimeService.listRuntimeAuthProviders(projectPath ?? null);
  });

  handleIpc(
    'runtime:set-api-key',
    async (event, providerId: runtimeService.RuntimeAuthSnapshot['providers'][number]['id'], key: string, projectPath?: string | null) => {
      const result = await runtimeService.setRuntimeApiKey(projectPath ?? null, providerId, key);

      if (!result.success) {
        event.sender.send('runtime:models-refreshed', { success: false, error: result.error });
        return result;
      }

      await emitRefreshedModels(event);
      return result;
    },
  );

  handleIpc(
    'runtime:login-oauth',
    async (event, providerId: runtimeService.RuntimeAuthSnapshot['providers'][number]['id'], projectPath?: string | null) => {
      const result = await runtimeService.loginRuntimeOAuth(projectPath ?? null, providerId, {
        onAuth: (info) => {
          void shell.openExternal(info.url);
          showOAuthInstructionDialog(event.sender, info);
        },
        onPrompt: (prompt) => promptInRenderer(event.sender, prompt),
        onManualCodeInput: () =>
          promptInRenderer(event.sender, {
            message: '브라우저에서 받은 인증 코드를 입력해주세요',
            placeholder: 'Authorization code',
          }),
      });

      if (!result.success) {
        event.sender.send('runtime:models-refreshed', { success: false, error: result.error });
        return result;
      }

      await emitRefreshedModels(event);
      return result;
    },
  );

  handleIpc(
    'runtime:logout-provider',
    async (event, providerId: runtimeService.RuntimeAuthSnapshot['providers'][number]['id'], projectPath?: string | null) => {
      const result = await runtimeService.logoutRuntimeProvider(projectPath ?? null, providerId);

      if (!result.success) {
        event.sender.send('runtime:models-refreshed', { success: false, error: result.error });
        return result;
      }

      await emitRefreshedModels(event);
      return result;
    },
  );

  handleIpc('runtime:complete-onboarding', async (_event: unknown, projectPath?: string | null) => {
    return runtimeService.completeRuntimeOnboarding(projectPath ?? null);
  });

  handleIpc('runtime:clear-context', async () => {
    runtimeService.clearRuntimeContext();
    return { success: true };
  });
}
