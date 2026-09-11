import { createHmac, randomBytes } from "node:crypto";

import { env } from "../../config/env.js";

export type TokenPurpose =
  | "session"
  | "csrf"
  | "email-verification"
  | "password-reset"
  | "privileged-invitation"
  | "recovery-code"
  | "webauthn-challenge"
  | "inventory-idempotency"
  | "order-checkout-idempotency"
  | "order-reservation"
  | "order-inventory"
  | "vehicle-reservation-idempotency"
  | "booking-idempotency"
  | "payment-intent-idempotency"
  | "payment-attempt-idempotency"
  | "refund-idempotency"
  | "throttle-email-ip"
  | "throttle-ip";

const tokenHashKey = Buffer.from(env.TOKEN_HASH_KEY, "base64");

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(purpose: TokenPurpose, rawValue: string): string {
  return createHmac("sha256", tokenHashKey)
    .update("allied-autotech:identity:v1\0", "utf8")
    .update(env.TOKEN_HASH_KEY_ID, "utf8")
    .update("\0", "utf8")
    .update(purpose, "utf8")
    .update("\0", "utf8")
    .update(rawValue, "utf8")
    .digest("hex");
}
