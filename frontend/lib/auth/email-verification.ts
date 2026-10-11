import { z } from "zod";
export const verificationFields = z
  .object({ token: z.string().min(32).max(512) })
  .strict();
export const resendFields = z
  .object({ email: z.string().trim().pipe(z.email().max(254)) })
  .strict();
