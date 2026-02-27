import { fetchModelsViaSdk, type AppModelInfo } from './unified-agent-adapter';

export interface ModelInfo {
  id: string;
  name: string;
  providerId?: string;
  modelId?: string;
  family?: string;
  releaseDate?: string;
  variants?: string[];
  cost?: {
    input?: number;
    output?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
}

type AiProvider = 'opencode';

export type FetchModelsResult = Record<AiProvider, ModelInfo[]>;

/** SDK AppModelInfo → 앱 ModelInfo 변환 */
function toModelInfo(m: AppModelInfo): ModelInfo {
  return {
    id: m.id,
    name: m.name,
    providerId: m.providerId,
    modelId: m.modelId,
  };
}

export async function fetchModelsFromApi(): Promise<FetchModelsResult> {
  const sdkModels = await fetchModelsViaSdk().catch(() => []);
  return {
    opencode: sdkModels.map(toModelInfo),
  };
}
