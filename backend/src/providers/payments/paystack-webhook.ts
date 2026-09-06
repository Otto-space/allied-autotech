import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const eventSchema = z.object({ event: z.string().min(1).max(120), data: z.unknown() });
const chargeSchema = z.object({
  id: z.union([z.string(), z.number()]),
  reference: z.string().min(1).max(160),
  status: z.string().min(1).max(80),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  paid_at: z.string().nullable().optional(),
  fees: z.number().int().nonnegative().nullable().optional(),
  channel: z.string().max(80).nullable().optional(),
});
const refundSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string().min(1).max(80),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
});
const disputeSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.string().min(1).max(80),
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  category: z.string().max(80).nullable().optional(),
  dueAt: z.string().nullable().optional(),
  transaction: z.object({ reference: z.string().min(1).max(160) }),
});

export type PaystackWebhookEvent = {
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

export function paystackPayloadSha256(rawBody: Buffer): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function parsePaystackWebhook(rawBody: Buffer): PaystackWebhookEvent {
  const envelope = eventSchema.parse(JSON.parse(rawBody.toString("utf8")) as unknown);
  if (envelope.event === "charge.success") {
    const data = chargeSchema.parse(envelope.data);
    return {
      eventType: envelope.event,
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
      providerEventId: `${envelope.event}:${String(data.id)}`,
      resourceId: String(data.id),
      reference: String(data.id),
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
      providerEventId: `${envelope.event}:${String(data.id)}`,
      resourceId: String(data.id),
      reference: data.transaction.reference,
      gatewayTransactionId: null,
      status: data.status,
      amountKobo: BigInt(data.amount),
      currency: data.currency.toUpperCase(),
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
