import { validatePhase1Response, validatePhase2Response } from './ai-prompts';
import type { Phase1Response, Phase2Response } from './ai-types';

function extractJSON(text: string): unknown | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export function parsePhase1Response(rawText: string): Phase1Response {
  const extracted = extractJSON(rawText);
  
  if (extracted) {
    const validated = validatePhase1Response(extracted);
    if (validated) {
      return validated;
    }
  }
  
  return {
    message: rawText,
    needsCanvasUpdate: false,
  };
}

export function parsePhase2Response(rawText: string): Phase2Response | null {
  const extracted = extractJSON(rawText);
  
  if (!extracted) {
    return null;
  }
  
  return validatePhase2Response(extracted);
}
