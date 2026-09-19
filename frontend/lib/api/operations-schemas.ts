import { z } from "zod";
const uuid = z.string().uuid();
const nullableDate = z.string().nullable();
export const anomalyStatuses = ["OPEN", "INVESTIGATING", "RESOLVED", "IGNORED"] as const;
export const anomalyTypes = [
  "UNKNOWN_REFERENCE",
  "AMOUNT_MISMATCH",
  "CURRENCY_MISMATCH",
  "DUPLICATE_SUCCESS",
  "LATE_SUCCESS",
  "REFUND_MISMATCH",
  "WEBHOOK_REPLAY",
  "OTHER",
] as const;
export const anomalySchema = z.object({
  id: uuid,
  paymentId: uuid.nullable(),
  paymentAttemptId: uuid.nullable(),
  refundId: uuid.nullable(),
  disputeId: uuid.nullable(),
  type: z.enum(anomalyTypes),
  status: z.enum(anomalyStatuses),
  summary: z.string(),
  detectedAt: z.string(),
  resolvedAt: nullableDate,
  resolutionNote: z.string().nullable(),
  resolvedByUserId: uuid.nullable(),
  updatedAt: z.string(),
});
export type PaymentAnomaly = z.infer<typeof anomalySchema>;
const jobFields = {
  id: uuid,
  eventType: z.string(),
  status: z.enum(["FAILED", "DEAD_LETTER", "PROCESSING"]),
  lockedAt: nullableDate,
  updatedAt: z.string(),
};
export const jobSchema = z.discriminatedUnion("source", [
  z.object({
    ...jobFields,
    source: z.literal("OUTBOX"),
    eventId: uuid,
    aggregateType: z.string(),
    aggregateId: z.string(),
    attempts: z.number().int().nonnegative(),
    availableAt: z.string(),
    createdAt: z.string(),
  }),
  z.object({
    ...jobFields,
    source: z.literal("PAYMENT_WEBHOOK"),
    processingAttempts: z.number().int().nonnegative(),
    nextAttemptAt: nullableDate,
    receivedAt: z.string(),
  }),
]);
export type OperationalJob = z.infer<typeof jobSchema>;
export const parseJobRetry = (value: unknown) =>
  z
    .object({
      id: uuid,
      source: z.enum(["outbox", "webhook"]),
      status: z.literal("RETRY_REQUESTED"),
      attempts: z.number().int(),
    })
    .parse(value);
export const parseAnomalyChange = (value: unknown) =>
  anomalySchema
    .pick({
      id: true,
      type: true,
      status: true,
      summary: true,
      resolutionNote: true,
      resolvedAt: true,
      resolvedByUserId: true,
    })
    .parse(value);
export const disputeStatuses = [
  "AWAITING_RESPONSE",
  "UNDER_REVIEW",
  "WON",
  "LOST",
  "ACCEPTED",
  "EXPIRED",
] as const;
export const disputeCategories = [
  "NOT_RECOGNIZED",
  "FRAUD",
  "NOT_RECEIVED",
  "NOT_AS_DESCRIBED",
  "DUPLICATE_CHARGE",
  "REFUND_NOT_RECEIVED",
  "OTHER",
] as const;
export const disputeSchema = z.object({
  id: uuid,
  paymentAttemptId: uuid,
  provider: z.enum(["PAYSTACK", "MONNIFY", "MANUAL"]),
  providerDisputeId: z.string(),
  status: z.enum(disputeStatuses),
  category: z.enum(disputeCategories),
  amountKobo: z.string().regex(/^\d+$/),
  currency: z.literal("NGN"),
  responseDueAt: nullableDate,
  openedAt: z.string(),
  respondedAt: nullableDate,
  resolvedAt: nullableDate,
  hasEvidence: z.boolean(),
  updatedAt: z.string(),
});
export type PaymentDispute = z.infer<typeof disputeSchema>;
export const parseAnomalies = (value: unknown) =>
  z.object({ items: z.array(anomalySchema), nextCursor: uuid.optional() }).parse(value);
export const parseJobs = (value: unknown) =>
  z.object({ items: z.array(jobSchema), nextCursor: uuid.optional() }).parse(value);
export const parseDisputes = (value: unknown) =>
  z.object({ items: z.array(disputeSchema), nextCursor: uuid.optional() }).parse(value);
