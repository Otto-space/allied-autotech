import { z } from "zod";
import { paymentSchema } from "./payment-schemas";
export const paymentAttemptSchema = paymentSchema.shape.attempts.element.extend({
  attemptNumber: z.number().int(),
  method: z.string().nullable(),
  amountKobo: z.string().regex(/^\d+$/),
  currency: z.literal("NGN"),
  verifiedAt: z.string().nullable(),
  manualReview: z
    .object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
      bankReference: z.string().nullable(),
      payerName: z.string().nullable(),
      transferredAt: z.string().nullable(),
      evidenceSha256: z.string().nullable(),
      submittedAt: z.string(),
      reviewedAt: z.string().nullable(),
    })
    .nullable(),
});
export const staffPaymentSchema = paymentSchema.extend({
  attempts: z.array(paymentAttemptSchema),
  createdAt: z.string(),
  succeededAt: z.string().nullable(),
});
export type StaffPayment = z.infer<typeof staffPaymentSchema>;
export type PaymentAttempt = z.infer<typeof paymentAttemptSchema>;
export const parseStaffPayments = (value: unknown) =>
  z
    .object({ items: z.array(staffPaymentSchema), nextCursor: z.string().optional() })
    .parse(value);
export const refundStatuses = [
  "REQUESTED",
  "APPROVED",
  "PENDING",
  "PROCESSING",
  "NEEDS_ATTENTION",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;
export const refundSchema = z.object({
  id: z.string().uuid(),
  refundNumber: z.string(),
  paymentAttemptId: z.string().uuid(),
  requestedByUserId: z.string().uuid(),
  approvedByUserId: z.string().uuid().nullable(),
  amountKobo: z.string().regex(/^\d+$/),
  currency: z.literal("NGN"),
  status: z.enum(refundStatuses),
  reason: z.string(),
  providerStatus: z.string().nullable(),
  failureCode: z.string().nullable(),
  requestedAt: z.string(),
  approvedAt: z.string().nullable(),
  processedAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type RefundRecord = z.infer<typeof refundSchema>;
export const parseRefunds = (value: unknown) =>
  z
    .object({ items: z.array(refundSchema), nextCursor: z.string().optional() })
    .parse(value);
export const refundMessages: Record<RefundRecord["status"], string> = {
  REQUESTED:
    "Requested. A different administrator must review this refund before it can proceed.",
  APPROVED: "Approved. This does not confirm that the customer has received a refund.",
  PENDING:
    "Submitted for provider processing. Do not submit a replacement refund while its outcome is pending.",
  PROCESSING: "The refund is processing. Completion has not been confirmed.",
  NEEDS_ATTENTION:
    "This refund needs operational follow-up. It may require offline processing or confirmation of a provider submission. Do not assume funds were returned or submit a replacement without reconciliation.",
  SUCCEEDED:
    "The refund is recorded as succeeded. Refer to this record when reviewing the returned amount.",
  FAILED:
    "This refund is recorded as failed. Reconcile any provider activity before requesting another refund.",
  CANCELLED:
    "This refund request was cancelled. Cancellation does not send money to the customer.",
};
