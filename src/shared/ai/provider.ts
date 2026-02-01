import { createGeminiProvider } from 'ai-sdk-provider-gemini-cli';

export const DEFAULT_MODEL = 'gemini-3-flash-preview';

export const geminiProvider = createGeminiProvider({
  authType: 'oauth-personal',
});

export const geminiModel = geminiProvider(DEFAULT_MODEL);

export function createModel(modelId?: string) {
  return geminiProvider(modelId ?? DEFAULT_MODEL);
}
