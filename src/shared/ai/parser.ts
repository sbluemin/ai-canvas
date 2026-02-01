import type { AIResponse } from '../prompts/types';
import { AIResponseSchema, validateAIResponse } from '../prompts/types';

export interface ParseResult {
  success: boolean;
  data?: AIResponse;
  fallback?: boolean;
  error?: string;
}

function buildFallback(rawText: string, error?: string): ParseResult {
  const result: ParseResult = {
    success: true,
    fallback: true,
    data: {
      message: rawText,
    },
  };

  if (error) {
    result.error = error;
  }

  return result;
}

function extractJSONObject(text: string): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  let startIndex = -1;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = i;
      }
      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth === 0) {
        continue;
      }
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

export function extractJSON(text: string): string | null {
  if (!text) {
    return null;
  }

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    const codeContent = codeBlockMatch[1].trim();
    const extracted = extractJSONObject(codeContent);
    if (extracted) {
      return extracted;
    }
    if (codeContent.startsWith('{') && codeContent.endsWith('}')) {
      return codeContent;
    }
  }

  return extractJSONObject(text);
}

export function isStructuredResponse(text: string): boolean {
  return extractJSON(text) !== null;
}

export function parseAIResponse(rawText: string): ParseResult {
  const jsonText = extractJSON(rawText);
  if (!jsonText) {
    return buildFallback(rawText, 'No JSON found in response');
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const validated = validateAIResponse(parsed);
    if (validated) {
      return { success: true, data: validated };
    }

    const zodResult = AIResponseSchema.safeParse(parsed);
    const errorMessage = zodResult.success
      ? 'AI response validation failed'
      : zodResult.error.message;
    return buildFallback(rawText, errorMessage);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return buildFallback(rawText, errorMessage);
  }
}
