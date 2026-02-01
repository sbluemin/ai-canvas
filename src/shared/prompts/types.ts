import { z } from 'zod';

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

export const AIResponseSchema = z.object({
  message: z.string(),
  canvasContent: z.string().optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export function validateAIResponse(data: unknown): AIResponse | null {
  const result = AIResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}
