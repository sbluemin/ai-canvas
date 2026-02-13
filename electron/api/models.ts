import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

function tryParseModelHeader(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return /^[a-z0-9-]+\/[a-z0-9._-]+$/i.test(trimmed) ? trimmed : null;
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

    const rawBlock = blockLines.join('\n');
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
  const { stdout } = await execFileAsync('opencode', ['models', '--verbose'], {
    timeout: 60_000,
    maxBuffer: 20 * 1024 * 1024,
  });

  return parseOpenCodeVerboseOutput(stdout ?? '');
}

export async function fetchModelsFromApi(): Promise<FetchModelsResult> {
  return {
    opencode: await fetchOpenCodeModelsFromCli().catch(() => []),
  };
}
