import { handleIpc } from '../../shared/utils';
import { executeAiChatWorkflow } from '../../ai/workflow';
import type { AiChatRequest } from '../../ai/types';
import { fetchModelsFromApi } from '../../ai/models';

export function registerAiHandlers(): void {
  handleIpc('ai:chat', async (event: any, request: AiChatRequest) => {
    await executeAiChatWorkflow(event, request);
    return { success: true };
  });

  handleIpc('ai:fetch-models', async () => {
    const models = await fetchModelsFromApi();
    return { success: true, models };
  });
}
