import { z } from 'zod';

export const CompactResponseSchema = z.object({
  summary: z.string(),
  keyDecisions: z.array(z.string()),
  canvasState: z.string(),
  pendingItems: z.array(z.string()),
});

export type CompactResponse = z.infer<typeof CompactResponseSchema>;

export function validateCompactResponse(data: unknown): CompactResponse | null {
  const result = CompactResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Phase 1: Ideation Planner Agent
 * - Evaluates user intent
 * - Determines if canvas update is needed
 * - Creates update plan if needed
 */
export const Phase1ResponseSchema = z.object({
  message: z.string(),
  needsCanvasUpdate: z.boolean(),
  updatePlan: z.string().optional(),
});

export type Phase1Response = z.infer<typeof Phase1ResponseSchema>;

export function validatePhase1Response(data: unknown): Phase1Response | null {
  const result = Phase1ResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Phase 2: Concretization Agent
 * - Executes the update plan
 * - Provides message explaining what was changed and why
 * - Returns complete updated canvas content
 */
export const Phase2ResponseSchema = z.object({
  message: z.string(),
  canvasContent: z.string(),
});

export type Phase2Response = z.infer<typeof Phase2ResponseSchema>;

export function validatePhase2Response(data: unknown): Phase2Response | null {
  const result = Phase2ResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}

// Legacy schema for backward compatibility
export const AIResponseSchema = z.object({
  message: z.string(),
  canvasContent: z.string().optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export function validateAIResponse(data: unknown): AIResponse | null {
  const result = AIResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}
