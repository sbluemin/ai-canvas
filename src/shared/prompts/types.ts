import { z } from 'zod';

export const AIResponseSchema = z.object({
  message: z.string(),
  canvasContent: z.string().optional(),
});

export type AIResponse = z.infer<typeof AIResponseSchema>;

export function validateAIResponse(data: unknown): AIResponse | null {
  const result = AIResponseSchema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return null;
}
