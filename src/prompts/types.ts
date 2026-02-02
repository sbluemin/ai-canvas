import { z } from 'zod';

/**
 * Phase 1: Ideation Planner Agent
 * - Evaluates user intent
 * - Determines if canvas update is needed
 * - Creates update plan if needed
 */
export type Phase1Response = {
  message: string;
  needsCanvasUpdate: boolean;
  updatePlan?: string;
};

export function validatePhase1Response(data: unknown): Phase1Response | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  
  const obj = data as Record<string, unknown>;
  
  if (typeof obj.message !== 'string' || typeof obj.needsCanvasUpdate !== 'boolean') {
    return null;
  }
  
  let updatePlan: string | undefined;
  if (obj.updatePlan !== undefined) {
    if (typeof obj.updatePlan === 'string') {
      updatePlan = obj.updatePlan;
    } else if (typeof obj.updatePlan === 'object' && obj.updatePlan !== null) {
      updatePlan = JSON.stringify(obj.updatePlan, null, 2);
    }
  }
  
  return {
    message: obj.message,
    needsCanvasUpdate: obj.needsCanvasUpdate,
    updatePlan,
  };
}

export const Phase1ResponseSchema = z.object({
  message: z.string(),
  needsCanvasUpdate: z.boolean(),
  updatePlan: z.string().optional(),
});

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
