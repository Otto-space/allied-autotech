import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const money = z.union([z.number().nonnegative().finite(), z.string().min(1).max(40)]);
const envelopeSchema = z.object({
  eventType: z.string().min(1).max(120),
  eventData: z.unknown(),
});
const transactionSchema = z.object({
  transactionReference: z.string().min(1).max(160),
  paymentReference: z.string().min(1).max(120),
  paymentStatus: z.string().max(80).optional(),
  amountPaid: money,
  currency: z.string().length(3),
  paidOn: z.string().nullable().optional(),
  paymentMethod: z.string().max(80).nullable().optional(),
  fee: money.nullable().optional(),
});
const refundSchema = z.object({
  transactionReference: z.string().min(1).max(160),
  refundReference: z.string().min(1).max(160),
  refundStatus: z.string().min(1).max(80),
  refundAmount: money,
  currency: z.string().length(3).optional(),
});

export type MonnifyWebhookEvent =
  | {
      kind: "transaction";
      eventType: string;
      providerEventId: string;
      reference: string;
      gatewayTransactionId: string;
      status: string;
      amountKobo: bigint;
      currency: string;
      paidAt: Date | null;
      providerFeeKobo: bigint | null;
      method: string | null;
    }
  | {
      kind: "refund";
      eventType: "SUCCESSFUL_REFUND" | "FAILED_REFUND";
      providerEventId: string;
      refundReference: string;
      gatewayTransactionId: string;
      status: string;
      amountKobo: bigint;
      currency: string | null;
    }
  | {
      kind: "ignored";
      eventType: string;
      providerEventId: null;
    };

function nairaToKobo(value: string | number): bigint {
  const normalized = typeof value === "number" ? String(value) : value.trim();
  const match = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new Error("Invalid webhook amount");
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function optionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function eventIdentifier(eventType: string, reference: string): string {
  const value = `${eventType}:${reference}`;
  return value.length <= 180
    ? value
    : `${eventType}:${createHash("sha256").update(reference).digest("hex")}`;
}

export function verifyMonnifySignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function monnifyPayloadSha256(rawBody: Buffer): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function parseMonnifyWebhook(rawBody: Buffer): MonnifyWebhookEvent {
  const envelope = envelopeSchema.parse(JSON.parse(rawBody.toString("utf8")) as unknown);
  if (envelope.eventType === "SUCCESSFUL_TRANSACTION") {
    const data = transactionSchema.parse(envelope.eventData);
    return {
      kind: "transaction",
      eventType: envelope.eventType,
      providerEventId: eventIdentifier(envelope.eventType, data.transactionReference),
      reference: data.paymentReference,
      gatewayTransactionId: data.transactionReference,
      status: data.paymentStatus ?? "PAID",
      amountKobo: nairaToKobo(data.amountPaid),
      currency: data.currency.toUpperCase(),
      paidAt: optionalDate(data.paidOn),
      providerFeeKobo: data.fee == null ? null : nairaToKobo(data.fee),
      method: data.paymentMethod?.toLowerCase() ?? null,
    };
  }
  if (
    envelope.eventType === "SUCCESSFUL_REFUND" ||
    envelope.eventType === "FAILED_REFUND"
  ) {
    const data = refundSchema.parse(envelope.eventData);
    return {
      kind: "refund",
      eventType: envelope.eventType,
      providerEventId: eventIdentifier(envelope.eventType, data.refundReference),
      refundReference: data.refundReference,
      gatewayTransactionId: data.transactionReference,
      status: data.refundStatus,
      amountKobo: nairaToKobo(data.refundAmount),
      currency: data.currency?.toUpperCase() ?? null,
    };
  }
  return { kind: "ignored", eventType: envelope.eventType, providerEventId: null };
}
