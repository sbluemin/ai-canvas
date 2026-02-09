import { handleIpc } from '../ipc';
import * as gemini from '../gemini';
import * as codex from '../codex';
import * as anthropic from '../anthropic';
import { executeAiChatWorkflow, type AiChatRequest } from '../ai';
import { fetchModelsFromApi } from '../api/models';

export function registerAiHandlers() {
  // Gemini Auth
  handleIpc('gemini:auth:start', async () => {
    await gemini.startAuth();
    return { success: true };
  });

  handleIpc('gemini:auth:status', async () => {
    return await gemini.getAuthStatus();
  });

  handleIpc('gemini:auth:logout', async () => {
    await gemini.logout();
    return { success: true };
  });

  // Codex Auth
  handleIpc('codex:auth:start', async () => {
    await codex.startAuth();
    return { success: true };
  });

  handleIpc('codex:auth:status', async () => {
    return await codex.getAuthStatus();
  });

  handleIpc('codex:auth:logout', async () => {
    await codex.logout();
    return { success: true };
  });

  // Anthropic Auth
  handleIpc('anthropic:auth:start', async () => {
    await anthropic.startAuth();
    return { success: true };
  });

  handleIpc('anthropic:auth:status', async () => {
    return await anthropic.getAuthStatus();
  });

  handleIpc('anthropic:auth:logout', async () => {
    await anthropic.logout();
    return { success: true };
  });

  // AI Chat & Models
  handleIpc('ai:chat', async (event: any, request: AiChatRequest) => {
    await executeAiChatWorkflow(event, request);
    return { success: true };
  });

  handleIpc('ai:fetch-models', async () => {
    const models = await fetchModelsFromApi();
    return { success: true, models };
  });
}
