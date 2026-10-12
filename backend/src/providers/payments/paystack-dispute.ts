import { z } from "zod";
import { paystackIdentifier } from "./paystack-json.js";
import type { VerifiedDispute } from "./payment-provider.port.js";

const instant = z.iso.datetime({ offset: true }).nullable().optional();
const money = z.union([
  z.number().int().safe().nonnegative(),
  z.string().regex(/^\d{1,16}$/),
]);
export const paystackDisputeSchema = z
  .object({
    id: paystackIdentifier,
    domain: z.enum(["test", "live"]),
    status: z.string().trim().min(1).max(80),
    resolution: z.string().trim().max(80).nullable().optional(),
    refund_amount: money.nullable().optional(),
    currency: z.string().length(3).nullable().optional(),
    category: z.string().max(80).nullable().optional(),
    dueAt: instant,
    resolvedAt: instant,
    updatedAt: instant,
    transaction: z.object({
      id: paystackIdentifier,
      reference: z.string().min(1).max(160),
      amount: z.number().int().safe().positive(),
      currency: z.string().length(3),
      domain: z.enum(["test", "live"]).optional(),
    }),
  })
  .superRefine((value, ctx) => {
    if (
      value.currency &&
      value.currency.toUpperCase() !== value.transaction.currency.toUpperCase()
    )
      ctx.addIssue({ code: "custom", message: "Dispute currencies disagree" });
    if (value.transaction.domain && value.transaction.domain !== value.domain)
      ctx.addIssue({ code: "custom", message: "Dispute domains disagree" });
    if (
      value.refund_amount !== undefined &&
      value.refund_amount !== null &&
      BigInt(value.refund_amount) > BigInt(value.transaction.amount)
    )
      ctx.addIssue({
        code: "custom",
        message: "Dispute refund exceeds transaction amount",
      });
  });

export function verifiedDispute(
  value: z.infer<typeof paystackDisputeSchema>,
): VerifiedDispute {
  return {
    providerDisputeId: String(value.id),
    reference: value.transaction.reference,
    gatewayTransactionId: String(value.transaction.id),
    transactionAmountKobo: BigInt(value.transaction.amount),
    currency: value.transaction.currency.toUpperCase(),
    providerStatus: value.status,
    resolution: value.resolution ?? null,
    refundAmountKobo: value.refund_amount == null ? null : BigInt(value.refund_amount),
    category: value.category ?? null,
    responseDueAt: value.dueAt ? new Date(value.dueAt) : null,
    resolvedAt: value.resolvedAt ? new Date(value.resolvedAt) : null,
    updatedAt: value.updatedAt ? new Date(value.updatedAt) : null,
  };
}

export function disputeOutcome(value: VerifiedDispute): {
  status: "AWAITING_RESPONSE" | "UNDER_REVIEW" | "WON" | "LOST" | "ACCEPTED" | "EXPIRED";
  chargebackAmountKobo: bigint | null;
  reviewReason: string | null;
} {
  const status = value.providerStatus.toLowerCase().replaceAll("_", "-");
  const resolution = value.resolution?.toLowerCase();
  if (["awaiting-merchant-feedback", "awaiting-response"].includes(status))
    return {
      status: "AWAITING_RESPONSE",
      chargebackAmountKobo: null,
      reviewReason: null,
    };
  if (["awaiting-bank-feedback", "pending", "under-review"].includes(status))
    return { status: "UNDER_REVIEW", chargebackAmountKobo: null, reviewReason: null };
  const loss =
    status === "lost"
      ? "LOST"
      : status === "accepted" ||
          (status === "resolved" && resolution === "merchant-accepted")
        ? "ACCEPTED"
        : null;
  if (
    loss &&
    value.refundAmountKobo !== null &&
    value.refundAmountKobo > 0n &&
    value.refundAmountKobo <= value.transactionAmountKobo &&
    value.resolvedAt
  )
    return {
      status: loss,
      chargebackAmountKobo: value.refundAmountKobo,
      reviewReason: null,
    };
  if (
    status === "won" &&
    value.resolvedAt &&
    (value.refundAmountKobo === null || value.refundAmountKobo === 0n)
  )
    return { status: "WON", chargebackAmountKobo: null, reviewReason: null };
  if (status === "expired" && value.resolvedAt && value.refundAmountKobo === 0n)
    return { status: "EXPIRED", chargebackAmountKobo: null, reviewReason: null };
  return {
    status: "UNDER_REVIEW",
    chargebackAmountKobo: null,
    reviewReason: loss
      ? "UNCONFIRMED_CHARGEBACK_AMOUNT"
      : "UNCONFIRMED_PROVIDER_RESOLUTION",
  };
}
