import {
  OpenCodeRuntime,
  type OpenCodeChatChunk,
  type OpenCodeChatRequest,
  type OpenCodeChatResult,
} from '../runtime/opencodeRuntime';

const runtime = new OpenCodeRuntime();

export async function chatWithOpenCode(
  request: OpenCodeChatRequest,
  onChunk?: (chunk: OpenCodeChatChunk) => void
): Promise<OpenCodeChatResult> {
  return runtime.chat(request, onChunk);
}

export async function fetchOpenCodeModelsVerbose(): Promise<string> {
  return runtime.runModelsVerbose();
}

export function shutdownOpenCodeRuntime(): void {
  runtime.shutdown();
}
