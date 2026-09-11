import { z } from "zod";

const uuid = z.uuid();
const cleanText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) => [...value].every((character) => (character.codePointAt(0) ?? 0) > 31),
      "Contains invalid characters",
    );
const page = {
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};

export const paymentsEmptySchema = z.object({}).strict().default({});
export const paymentParamsSchema = z.object({ paymentId: uuid }).strict();
export const attemptParamsSchema = paymentParamsSchema
  .extend({ attemptId: uuid })
  .strict();
export const refundParamsSchema = z.object({ refundId: uuid }).strict();
export const paymentIdempotencyHeadersSchema = z.looseObject({
  "idempotency-key": z
    .string()
    .trim()
    .min(8)
    .max(120)
    .regex(/^[\x21-\x7E]+$/),
});
export const paymentCreateBodySchema = z.discriminatedUnion("targetType", [
  z
    .object({
      targetType: z.literal("ORDER"),
      targetId: uuid,
      purpose: z.literal("ORDER_PAYMENT"),
    })
    .strict(),
  z
    .object({
      targetType: z.literal("INVOICE"),
      targetId: uuid,
      purpose: z.literal("SERVICE_INVOICE"),
    })
    .strict(),
  z
    .object({
      targetType: z.literal("VEHICLE_TRANSACTION"),
      targetId: uuid,
      purpose: z.enum([
        "VEHICLE_RESERVATION",
        "VEHICLE_PARTIAL_PAYMENT",
        "VEHICLE_BALANCE_PAYMENT",
        "VEHICLE_FULL_PAYMENT",
      ]),
    })
    .strict(),
]);
export const paymentListQuerySchema = z
  .object({
    ...page,
    status: z
      .enum([
        "REQUIRES_PAYMENT",
        "PROCESSING",
        "REQUIRES_REVIEW",
        "SUCCEEDED",
        "CANCELLED",
        "EXPIRED",
      ])
      .optional(),
  })
  .strict();
export const staffPaymentListQuerySchema = paymentListQuerySchema
  .extend({
    customerId: uuid.optional(),
    provider: z.enum(["PAYSTACK", "MONNIFY", "MANUAL"]).optional(),
  })
  .strict();
export const manualPaymentBodySchema = z
  .object({
    method: z.enum(["BANK_TRANSFER", "POS", "CASH"]),
    bankReference: cleanText(160).optional(),
    payerName: cleanText(160),
    transferredAt: z.iso.datetime({ offset: true }),
    evidenceToken: z.string().min(80).max(4_096).optional(),
  })
  .strict();
export const paymentEvidenceUploadBodySchema = z
  .object({
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    sizeBytes: z
      .number()
      .int()
      .min(1)
      .max(10 * 1024 * 1024),
    checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export const manualReviewBodySchema = z
  .object({ decision: z.enum(["APPROVED", "REJECTED"]), reviewerNote: cleanText(1_000) })
  .strict();
export const refundCreateBodySchema = z
  .object({
    paymentAttemptId: uuid,
    amountKobo: z.coerce.bigint().positive(),
    reason: cleanText(1_000),
  })
  .strict();
export const refundDecisionBodySchema = z
  .object({
    decision: z.enum(["APPROVED", "CANCELLED"]),
    note: cleanText(1_000).optional(),
  })
  .strict();
export const webhookHeadersSchema = z.looseObject({
  "x-paystack-signature": z.string().regex(/^[0-9a-f]{128}$/i),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateBodySchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
export type StaffPaymentListQuery = z.infer<typeof staffPaymentListQuerySchema>;
export type ManualPaymentInput = z.infer<typeof manualPaymentBodySchema>;
export type PaymentEvidenceUploadInput = z.infer<typeof paymentEvidenceUploadBodySchema>;
export type ManualReviewInput = z.infer<typeof manualReviewBodySchema>;
export type RefundCreateInput = z.infer<typeof refundCreateBodySchema>;
export type RefundDecisionInput = z.infer<typeof refundDecisionBodySchema>;
