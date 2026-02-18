import { fetchOpenCodeModelsVerbose } from './backend';

interface OpenCodeVerboseModelData {
  name?: string;
  id?: string;
  providerID?: string;
  family?: string;
  release_date?: string;
  variants?: Record<string, Record<string, unknown>>;
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

function sortModels(models: ModelInfo[]): ModelInfo[] {
  return models.sort((a, b) => {
    if (a.releaseDate && b.releaseDate) {
      return b.releaseDate.localeCompare(a.releaseDate);
    }
    if (a.releaseDate) return -1;
    if (b.releaseDate) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** ANSI 이스케이프 코드를 제거한다 (모델 헤더/JSON 파싱 전처리용) */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * 라인에서 "provider/model" 토큰을 추출한다.
 * - ANSI 제거 후 검사
 * - strict full-line 대신 "라인 시작의 provider/model 토큰 추출" 방식으로 완화
 *   (단, 토큰 이후에 공백·괄호·콜론 등 부가 텍스트가 있어도 파싱 성공)
 * - provider/model 모두 alphanumeric + 하이픈/점/밑줄 허용
 */
function tryParseModelHeader(line: string): string | null {
  const clean = stripAnsi(line).trim();
  if (!clean) return null;
  const match = /^([a-z0-9-]+\/[a-z0-9._-]+)/i.exec(clean);
  return match ? match[1] : null;
}

function parseOpenCodeVerboseOutput(stdout: string): ModelInfo[] {
  const lines = stdout.split(/\r?\n/);
  const models: ModelInfo[] = [];

  let cursor = 0;
  while (cursor < lines.length) {
    const modelKey = tryParseModelHeader(lines[cursor]);
    if (!modelKey) {
      cursor += 1;
      continue;
    }

    cursor += 1;
    while (cursor < lines.length && !lines[cursor].trim()) {
      cursor += 1;
    }

    if (cursor >= lines.length || !lines[cursor].trim().startsWith('{')) {
      continue;
    }

    const blockLines: string[] = [];
    let braceDepth = 0;

    while (cursor < lines.length) {
      const line = lines[cursor];
      blockLines.push(line);

      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      braceDepth += opens - closes;

      cursor += 1;

      if (braceDepth === 0) {
        break;
      }
    }

    const rawBlock = stripAnsi(blockLines.join('\n'));
    try {
      const parsed = JSON.parse(rawBlock) as OpenCodeVerboseModelData;
      const [providerId, ...modelParts] = modelKey.split('/');
      models.push({
        id: modelKey,
        name: parsed.name ?? modelKey,
        providerId: parsed.providerID ?? providerId,
        modelId: parsed.id ?? modelParts.join('/'),
        family: parsed.family,
        releaseDate: parsed.release_date,
        variants: parsed.variants ? Object.keys(parsed.variants) : [],
        cost: parsed.cost ? { input: parsed.cost.input, output: parsed.cost.output } : undefined,
        limit: parsed.limit ? { context: parsed.limit.context, output: parsed.limit.output } : undefined,
      });
    } catch {
      // Skip malformed model block.
    }
  }

  return sortModels(models);
}

async function fetchOpenCodeModelsFromCli(): Promise<ModelInfo[]> {
  const stdout = await fetchOpenCodeModelsVerbose();
  return parseOpenCodeVerboseOutput(String(stdout ?? ''));
}

export async function fetchModelsFromApi(): Promise<FetchModelsResult> {
  return {
    opencode: await fetchOpenCodeModelsFromCli().catch(() => []),
  };
}
