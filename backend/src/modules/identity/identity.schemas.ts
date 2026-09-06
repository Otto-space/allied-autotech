import { z } from "zod";

import { isCommonPassword } from "../../common/security/passwords.js";
import { normalizeEmail } from "../../common/security/email.js";

const email = z.email().max(254).transform(normalizeEmail);
const password = z
  .string()
  .min(12)
  .max(128)
  .refine((value) => !isCommonPassword(value), "Choose a less common password");
const name = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u, "Contains unsupported characters");
const phone = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^\+?[0-9][0-9 ()-]*$/, "Enter a valid phone number");

export const emptyObjectSchema = z.object({}).strict().default({});

export const registerBodySchema = z
  .object({ email, password, firstName: name, lastName: name, phone })
  .strict();
export const tokenBodySchema = z.object({ token: z.string().min(32).max(512) }).strict();
export const emailBodySchema = z.object({ email }).strict();
export const loginBodySchema = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
export const resetPasswordBodySchema = tokenBodySchema.extend({ password }).strict();
export const changePasswordBodySchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
  .strict();
export const sessionParamsSchema = z.object({ sessionId: z.uuid() }).strict();
export const factorParamsSchema = z.object({ factorId: z.uuid() }).strict();
export const totpVerifyBodySchema = z
  .object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) })
  .strict();
export const factorDeleteBodySchema = z
  .object({ password: z.string().min(1).max(128) })
  .strict();
export const webauthnOptionsBodySchema = z
  .object({ name: z.string().trim().min(1).max(100).optional() })
  .strict();

const webauthnResponse = z.object({
  id: z.string().min(1).max(2_048),
  rawId: z.string().min(1).max(2_048),
  type: z.literal("public-key"),
  response: z.record(z.string(), z.unknown()),
  clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
  authenticatorAttachment: z.enum(["cross-platform", "platform"]).optional(),
});

export const webauthnVerifyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    response: webauthnResponse,
  })
  .strict();
export const mfaChallengeOptionsBodySchema = z
  .object({ method: z.enum(["totp", "webauthn", "recovery-code"]) })
  .strict();
export const mfaChallengeVerifyBodySchema = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("totp"),
      factorId: z.uuid(),
      code: z.string().regex(/^\d{6}$/),
    })
    .strict(),
  z
    .object({
      method: z.literal("recovery-code"),
      code: z.string().min(8).max(128),
    })
    .strict(),
  z.object({ method: z.literal("webauthn"), response: webauthnResponse }).strict(),
]);

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordBodySchema>;
export type MfaChallengeVerifyInput = z.infer<typeof mfaChallengeVerifyBodySchema>;
