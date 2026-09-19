import { z } from "zod";
import { csrfResultSchema, recoveryCodesSchema } from "./security-schemas";
const encoded = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^[A-Za-z0-9_-]+$/);
const descriptor = z.object({
  id: encoded,
  type: z.literal("public-key"),
  transports: z
    .array(z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"]))
    .optional(),
});
export const mfaSessionSchema = z.object({
  id: z.uuid(),
  user: z.object({
    id: z.uuid(),
    email: z.email(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
  mfaRequired: z.boolean(),
  mfaVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
  expiresAt: z.iso.datetime({ offset: true }),
  idleExpiresAt: z.iso.datetime({ offset: true }),
});
export type MfaSession = z.infer<typeof mfaSessionSchema>;
export const totpOptionsSchema = z.object({
  method: z.literal("totp"),
  available: z.literal(true),
  factors: z.array(z.object({ id: z.uuid(), name: z.string().nullable() })).min(1),
});
export const recoveryOptionsSchema = z.object({
  method: z.literal("recovery-code"),
  available: z.literal(true),
});
export const authenticationOptionsSchema = z.object({
  challenge: encoded,
  rpId: z.string().min(1),
  timeout: z.number().positive().optional(),
  allowCredentials: z.array(descriptor).min(1),
  userVerification: z.literal("required"),
});
export const registrationOptionsSchema = z.object({
  challenge: encoded,
  rp: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  user: z.object({ id: encoded, name: z.string().min(1), displayName: z.string() }),
  pubKeyCredParams: z
    .array(z.object({ type: z.literal("public-key"), alg: z.number().int() }))
    .min(1),
  timeout: z.number().positive().optional(),
  excludeCredentials: z.array(descriptor).optional(),
  authenticatorSelection: z.object({
    residentKey: z.enum(["discouraged", "preferred", "required"]).optional(),
    requireResidentKey: z.boolean().optional(),
    userVerification: z.literal("required"),
  }),
  attestation: z.literal("none"),
  extensions: z.object({ credProps: z.boolean().optional() }).optional(),
});
export const totpEnrollmentSchema = z
  .object({
    factorId: z.uuid(),
    secret: z
      .string()
      .min(16)
      .max(256)
      .regex(/^[A-Z2-7]+=*$/),
    uri: z.string().max(4096),
  })
  .refine((value) => {
    try {
      const uri = new URL(value.uri);
      return (
        uri.protocol === "otpauth:" &&
        uri.hostname === "totp" &&
        uri.searchParams.get("secret") === value.secret
      );
    } catch {
      return false;
    }
  });
export const enrollmentResultSchema = csrfResultSchema.extend(recoveryCodesSchema.shape);
export type TotpEnrollment = z.infer<typeof totpEnrollmentSchema>;
