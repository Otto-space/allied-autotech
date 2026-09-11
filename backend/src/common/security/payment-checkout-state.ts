import { z } from "zod";

import type { Prisma } from "../../generated/prisma/client.js";
import {
  decryptPaymentCheckoutState,
  encryptPaymentCheckoutState,
  type EncryptedEnvelope,
} from "./mfa-encryption.js";

const envelopeSchema = z
  .object({
    version: z.literal(1),
    keyId: z.string().min(1).max(120),
    iv: z.string().min(16).max(64),
    ciphertext: z.string().min(1).max(16_384),
    tag: z.string().min(16).max(64),
  })
  .strict();
const checkoutStateSchema = z
  .object({
    provider: z.enum(["PAYSTACK", "MONNIFY"]),
    authorizationUrl: z.url(),
    accessCode: z.string().min(1).max(512),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type PaymentCheckoutState = z.infer<typeof checkoutStateSchema>;

export function sealPaymentCheckoutState(
  state: PaymentCheckoutState,
): Prisma.InputJsonValue {
  return encryptPaymentCheckoutState(
    checkoutStateSchema.parse(state),
  ) as unknown as Prisma.InputJsonValue;
}

export function openPaymentCheckoutState(value: unknown): PaymentCheckoutState {
  const envelope = envelopeSchema.parse(value) as EncryptedEnvelope;
  return checkoutStateSchema.parse(decryptPaymentCheckoutState<unknown>(envelope));
}
