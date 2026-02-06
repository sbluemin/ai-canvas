import { z } from 'zod';

export type Phase1Response = {
  message: string;
  needsCanvasUpdate: boolean;
  updatePlan?: string;
};

export type Phase2Response = {
  message: string;
  canvasContent: string;
};

export const AIResponseSchema = z.object({
  message: z.string(),
  canvasContent: z.string().optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export function validateAIResponse(data: unknown): AIResponse | null {
  const result = AIResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}
