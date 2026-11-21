import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { parsePaystackJson, paystackIdentifier } from "./paystack-json.js";

const eventSchema = z.object({ event: z.string().min(1).max(120), data: z.unknown() });
const chargeSchema = z.object({
  domain: z.enum(["test", "live"]),
  id: paystackIdentifier,
  reference: z.string().min(1).max(160),
  status: z.literal("success"),
  amount: z.number().int().safe().positive(),
  currency: z.string().length(3),
  paid_at: z.string().nullable().optional(),
  fees: z.number().int().safe().nonnegative().nullable().optional(),
  channel: z.string().max(80).nullable().optional(),
});
const refundSchema = z.object({
  id: paystackIdentifier.optional(),
  transaction_reference: z.string().min(1).max(160).optional(),
  refund_reference: z.string().nullable().optional(),
  status: z.string().min(1).max(80),
  amount: z.union([z.number().int().safe().positive(), z.string().regex(/^[1-9]\d*$/)]),
  currency: z.string().length(3),
});
const disputeSchema = z.object({
  id: paystackIdentifier,
  status: z.string().min(1).max(80).nullable().optional(),
  amount: z.number().int().safe().positive().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  transaction: z.object({ reference: z.string().min(1).max(160).optional() }).optional(),
});

export type PaystackWebhookEvent = {
  domain?: "test" | "live";
  disputeLookupRequired?: boolean;
  eventType: string;
  providerEventId: string | null;
  resourceId: string | null;
  reference: string | null;
  gatewayTransactionId: string | null;
  status: string | null;
  amountKobo: bigint | null;
  currency: string | null;
  paidAt: Date | null;
  providerFeeKobo: bigint | null;
  method: string | null;
  category: string | null;
  responseDueAt: Date | null;
};

export function verifyPaystackSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/** Paystack's timestamped Paystack-Signature format uses an independent whsec_
 * signing secret. Never fall back to the legacy API-key signature when this mode
 * is configured: a missing or invalid timestamp must fail closed. */
export function verifyPaystackTimestampedSignature(
  rawBody: Buffer,
  header: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): boolean {
  if (!secret.startsWith("whsec_") || header.length > 4_096) return false;
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const field of header.split(",")) {
    const separator = field.indexOf("=");
    if (separator < 0) continue;
    const name = field.slice(0, separator).trim();
    const value = field.slice(separator + 1).trim();
    if (name === "t") {
      if (timestamp !== undefined || !/^[1-9]\d*$/u.test(value)) return false;
      timestamp = value;
    } else if (name === "v1") {
      const keySeparator = value.indexOf(":");
      if (
        keySeparator > 0 &&
        /^whk_[A-Za-z0-9_-]+$/u.test(value.slice(0, keySeparator)) &&
        /^[0-9a-f]{128}$/u.test(value.slice(keySeparator + 1))
      )
        signatures.push(value.slice(keySeparator + 1));
    }
  }
  if (timestamp === undefined || signatures.length === 0 || signatures.length > 8)
    return false;
  const signedSeconds = Number(timestamp);
  if (
    !Number.isSafeInteger(signedSeconds) ||
    !Number.isSafeInteger(nowSeconds) ||
    Math.abs(nowSeconds - signedSeconds) > 300
  )
    return false;
  const expected = createHmac("sha512", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest();
  return signatures.some((signature) =>
    timingSafeEqual(Buffer.from(signature, "hex"), expected),
  );
}

export function paystackPayloadSha256(rawBody: Buffer): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function parsePaystackWebhook(rawBody: Buffer): PaystackWebhookEvent {
  const envelope = eventSchema.parse(parsePaystackJson(rawBody.toString("utf8")));
  if (envelope.event === "charge.success") {
    const data = chargeSchema.parse(envelope.data);
    return {
      eventType: envelope.event,
      domain: data.domain,
      providerEventId: `${envelope.event}:${String(data.id)}`,
      resourceId: String(data.id),
      reference: data.reference,
      gatewayTransactionId: String(data.id),
      status: data.status,
      amountKobo: BigInt(data.amount),
      currency: data.currency.toUpperCase(),
      paidAt: data.paid_at ? new Date(data.paid_at) : null,
      providerFeeKobo: data.fees == null ? null : BigInt(data.fees),
      method: data.channel ?? null,
      category: null,
      responseDueAt: null,
    };
  }
  if (envelope.event.startsWith("refund.")) {
    const data = refundSchema.parse(envelope.data);
    return {
      eventType: envelope.event,
      providerEventId:
        data.id === undefined ? null : `${envelope.event}:${String(data.id)}`,
      resourceId: data.id === undefined ? null : String(data.id),
      reference: data.transaction_reference ?? null,
      gatewayTransactionId: null,
      status: data.status,
      amountKobo: BigInt(data.amount),
      currency: data.currency.toUpperCase(),
      paidAt: null,
      providerFeeKobo: null,
      method: null,
      category: null,
      responseDueAt: null,
    };
  }
  if (envelope.event.startsWith("charge.dispute.")) {
    const data = disputeSchema.parse(envelope.data);
    return {
      eventType: envelope.event,
      providerEventId: `dispute:${paystackPayloadSha256(rawBody)}`,
      disputeLookupRequired: true,
      resourceId: String(data.id),
      reference: data.transaction?.reference ?? null,
      gatewayTransactionId: null,
      status: data.status ?? null,
      amountKobo: data.amount == null ? null : BigInt(data.amount),
      currency: data.currency?.toUpperCase() ?? null,
      paidAt: null,
      providerFeeKobo: null,
      method: null,
      category: data.category ?? null,
      responseDueAt: data.dueAt ? new Date(data.dueAt) : null,
    };
  }
  return {
    eventType: envelope.event,
    providerEventId: null,
    resourceId: null,
    reference: null,
    gatewayTransactionId: null,
    status: null,
    amountKobo: null,
    currency: null,
    paidAt: null,
    providerFeeKobo: null,
    method: null,
    category: null,
    responseDueAt: null,
  };
}
