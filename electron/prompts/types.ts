import { z } from 'zod';

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

export const Phase2ResponseSchema = z.object({
  message: z.string(),
  canvasContent: z.string(),
});

export type Phase2Response = z.infer<typeof Phase2ResponseSchema>;

export function validatePhase2Response(data: unknown): Phase2Response | null {
  const result = Phase2ResponseSchema.safeParse(data);
  return result.success ? result.data : null;
}
