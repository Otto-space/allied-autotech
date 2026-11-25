import { z } from "zod";
export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.object({
    success: z.literal(true),
    message: z.string(),
    data,
    meta: z.object({ requestId: z.string() }),
  });
}
