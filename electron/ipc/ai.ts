import { handleIpc } from '../ipc';
import { executeAiChatWorkflow, type AiChatRequest } from '../ai';
import { fetchModelsFromApi } from '../ai/models';

export function registerAiHandlers() {
  handleIpc('ai:chat', async (event: any, request: AiChatRequest) => {
    await executeAiChatWorkflow(event, request);
    return { success: true };
  });

  handleIpc('ai:fetch-models', async () => {
    const models = await fetchModelsFromApi();
    return { success: true, models };
  });
}
