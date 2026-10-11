import { z } from "zod";
export const resetFields = z
  .object({
    token: z.string().min(32).max(512),
    password: z.string().min(12).max(128),
  })
  .strict();

export { tokenFromFragment as recoveryTokenFromFragment } from "./fragment-token";
