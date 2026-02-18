import { handleIpc } from '../core';
import * as runtimeService from '../services/runtime.service';
import { fetchModelsFromApi } from '../ai/models';

export function registerRuntimeHandlers() {
  handleIpc('runtime:check-status', async (_event: unknown, projectPath: string | null) => {
    return runtimeService.checkRuntimeStatus(projectPath);
  });

  handleIpc('runtime:set-mode', async (_event: unknown, projectPath: string, mode: 'auto' | 'local' | 'global') => {
    return runtimeService.setRuntimeMode(projectPath, mode);
  });

  handleIpc('runtime:install-local', async (event, projectPath: string) => {
    return runtimeService.installLocalRuntime(projectPath, (progress) => {
      event.sender.send('runtime:install-progress', progress);
    });
  });

  handleIpc('runtime:open-auth-terminal', async (event, projectPath: string | null) => {
    return runtimeService.openAuthTerminal(projectPath, async (result) => {
      if (!result.success) {
        event.sender.send('runtime:models-refreshed', { success: false, error: result.error });
        return;
      }

      try {
        await runtimeService.checkRuntimeStatus(projectPath);
        const models = await fetchModelsFromApi();
        event.sender.send('runtime:models-refreshed', { success: true, models });
      } catch (error) {
        event.sender.send('runtime:models-refreshed', {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  });

  handleIpc('runtime:complete-onboarding', async (_event: unknown, projectPath: string) => {
    return runtimeService.completeRuntimeOnboarding(projectPath);
  });

  handleIpc('runtime:clear-context', async () => {
    runtimeService.clearRuntimeContext();
    return { success: true };
  });
}
