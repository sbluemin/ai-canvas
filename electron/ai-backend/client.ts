/**
 * OpenCode API 클라이언트
 *
 * 런타임 인스턴스를 싱글톤으로 관리하고,
 * 외부에 깔끔한 함수 기반 API를 제공한다.
 * 이것이 ai-backend 모듈의 유일한 비즈니스 로직 진입점이다.
 */
import { OpenCodeRuntime } from './runtime';
import { configureRuntimeProjectPath } from './runtime';
import { configureBinaryResolverContext } from './binary-resolver';
import type { OpenCodeChatRequest, OpenCodeChatChunk, OpenCodeChatResult } from './types';

/** 싱글톤 런타임 인스턴스 */
const runtime = new OpenCodeRuntime();

/** OpenCode로 chat 메시지를 전송하고 스트리밍 응답을 받는다. */
export async function chatWithOpenCode(
  request: OpenCodeChatRequest,
  onChunk?: (chunk: OpenCodeChatChunk) => void
): Promise<OpenCodeChatResult> {
  return runtime.chat(request, onChunk);
}

/** 사용 가능한 모델 목록을 조회한다. */
export async function fetchOpenCodeModelsVerbose(): Promise<string> {
  return runtime.runModelsVerbose();
}

/** 앱 종료 시 런타임을 정리한다. */
export function shutdownOpenCodeRuntime(): void {
  runtime.shutdown();
}

export type RuntimeBinaryMode = 'auto' | 'local' | 'global';

export function configureOpenCodeRuntime(projectPath: string | null, binaryMode: RuntimeBinaryMode = 'auto'): void {
  configureRuntimeProjectPath(projectPath, binaryMode);
  configureBinaryResolverContext(projectPath, binaryMode);
}
