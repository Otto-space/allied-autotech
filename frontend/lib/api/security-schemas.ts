import { z } from "zod";
const timestamp = z.iso.datetime({ offset: true });
export const securitySessionSchema = z.object({
  id: z.uuid(),
  current: z.boolean(),
  client: z.string(),
  network: z.string(),
  createdAt: timestamp,
  lastUsedAt: timestamp,
  expiresAt: timestamp,
  mfaVerified: z.boolean(),
});
export const factorSchema = z.object({
  id: z.uuid(),
  type: z.enum(["TOTP", "WEBAUTHN"]),
  status: z.enum(["PENDING", "ACTIVE", "REVOKED"]),
  name: z.string().nullable(),
  createdAt: timestamp,
  verifiedAt: timestamp.nullable(),
  lastUsedAt: timestamp.nullable(),
});
export type SecuritySession = z.infer<typeof securitySessionSchema>;
export type MfaFactor = z.infer<typeof factorSchema>;
export const parseSecuritySessions = (value: unknown) =>
  z.object({ sessions: z.array(securitySessionSchema) }).parse(value);
export const parseFactors = (value: unknown) =>
  z.object({ factors: z.array(factorSchema) }).parse(value);
export const csrfResultSchema = z.object({ csrfToken: z.string().min(32).max(256) });
export const recoveryCodesSchema = z.object({
  recoveryCodes: z
    .array(z.string().min(8).max(128))
    .min(1)
    .max(100)
    .refine((codes) => new Set(codes).size === codes.length),
});
