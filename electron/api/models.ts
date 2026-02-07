// models.dev API에서 모델 목록을 가져오는 모듈

const MODELS_API_URL = 'https://models.dev/api.json';

// Provider slug → AiProvider 매핑
const PROVIDER_SLUG_MAP: Record<string, string> = {
  google: 'gemini',
  openai: 'openai',
  anthropic: 'anthropic',
};

interface RawModelData {
  id: string;
  name: string;
  family?: string;
  release_date?: string;
  knowledge?: string;
  cost?: {
    input?: number;
    output?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  family?: string;
  releaseDate?: string;
  knowledge?: string;
  cost?: {
    input?: number;
    output?: number;
  };
  limit?: {
    context?: number;
    output?: number;
  };
}

type AiProvider = 'gemini' | 'openai' | 'anthropic';

export type FetchModelsResult = Record<AiProvider, ModelInfo[]>;

export async function fetchModelsFromApi(): Promise<FetchModelsResult> {
  const response = await fetch(MODELS_API_URL);
  
  if (!response.ok) {
    throw new Error(`models.dev API error (${response.status})`);
  }
  
  const data = await response.json();
  
  const result: FetchModelsResult = {
    gemini: [],
    openai: [],
    anthropic: [],
  };
  
  for (const [slug, providerKey] of Object.entries(PROVIDER_SLUG_MAP)) {
    const providerData = data[slug];
    if (!providerData?.models) continue;
    
    const models: ModelInfo[] = Object.values(providerData.models as Record<string, RawModelData>)
      .filter((m): m is RawModelData => !!m.id && !!m.name)
      .map((m) => ({
        id: m.id,
        name: m.name,
        family: m.family,
        releaseDate: m.release_date,
        knowledge: m.knowledge,
        cost: m.cost ? { input: m.cost.input, output: m.cost.output } : undefined,
        limit: m.limit ? { context: m.limit.context, output: m.limit.output } : undefined,
      }))
      .sort((a, b) => {
        // 출시일 역순 정렬 (최신 모델이 위로)
        if (a.releaseDate && b.releaseDate) {
          return b.releaseDate.localeCompare(a.releaseDate);
        }
        if (a.releaseDate) return -1;
        if (b.releaseDate) return 1;
        return a.name.localeCompare(b.name);
      });
    
    result[providerKey as AiProvider] = models;
  }
  
  return result;
}
