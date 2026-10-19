import { z } from "zod";
import { AuditAction, AuditEntityType } from "../../generated/prisma/enums.js";
import { operationalJobCursorSchema } from "./operational-job-cursor.js";

export const auditActionSchema = z.enum(AuditAction);
export const auditEntityTypeSchema = z.enum(AuditEntityType);

const page = {
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};
const isoDate = z.iso.datetime({ offset: true });

export const auditListQuerySchema = z
  .object({
    ...page,
    userId: z.uuid().optional(),
    action: auditActionSchema.optional(),
    entityType: auditEntityTypeSchema.optional(),
    entityId: z.string().trim().min(1).max(120).optional(),
    requestId: z.string().trim().min(1).max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .strict();

export const operationalJobsQuerySchema = z
  .object({
    ...page,
    cursor: operationalJobCursorSchema.optional(),
    source: z.enum(["OUTBOX", "PAYMENT_WEBHOOK"]).optional(),
    status: z.enum(["FAILED", "DEAD_LETTER", "PROCESSING"]).optional(),
  })
  .strict();
export const operationalJobParamsSchema = z
  .object({ source: z.enum(["outbox", "webhook"]), jobId: z.uuid() })
  .strict();
export const operationalRetryBodySchema = z
  .object({
    expectedAttempts: z.number().int().min(0).max(1_000),
    expectedUpdatedAt: isoDate.optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export const anomalyListQuerySchema = z
  .object({
    ...page,
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "IGNORED"]).optional(),
    type: z
      .enum([
        "UNKNOWN_REFERENCE",
        "AMOUNT_MISMATCH",
        "CURRENCY_MISMATCH",
        "DUPLICATE_SUCCESS",
        "LATE_SUCCESS",
        "REFUND_MISMATCH",
        "WEBHOOK_REPLAY",
        "OTHER",
      ])
      .optional(),
  })
  .strict();
export const anomalyParamsSchema = z.object({ anomalyId: z.uuid() }).strict();
export const anomalyUpdateBodySchema = z
  .object({
    expectedStatus: z.enum(["OPEN", "INVESTIGATING"]),
    status: z.enum(["INVESTIGATING", "RESOLVED", "IGNORED"]),
    resolutionNote: z.string().trim().min(3).max(2_000),
  })
  .strict();
export const disputeListQuerySchema = z
  .object({
    ...page,
    status: z
      .enum(["AWAITING_RESPONSE", "UNDER_REVIEW", "WON", "LOST", "ACCEPTED", "EXPIRED"])
      .optional(),
    category: z
      .enum([
        "NOT_RECOGNIZED",
        "FRAUD",
        "NOT_RECEIVED",
        "NOT_AS_DESCRIBED",
        "DUPLICATE_CHARGE",
        "REFUND_NOT_RECEIVED",
        "OTHER",
      ])
      .optional(),
  })
  .strict();
export const refundListQuerySchema = z
  .object({
    ...page,
    status: z
      .enum([
        "REQUESTED",
        "APPROVED",
        "PENDING",
        "PROCESSING",
        "NEEDS_ATTENTION",
        "SUCCEEDED",
        "FAILED",
        "CANCELLED",
      ])
      .optional(),
  })
  .strict();
export const operationsEmptyQuerySchema = z.object({}).strict().default({});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
export type OperationalJobsQuery = z.infer<typeof operationalJobsQuerySchema>;
export type OperationalRetryInput = z.infer<typeof operationalRetryBodySchema>;
export type AnomalyListQuery = z.infer<typeof anomalyListQuerySchema>;
export type AnomalyUpdateInput = z.infer<typeof anomalyUpdateBodySchema>;
export type DisputeListQuery = z.infer<typeof disputeListQuerySchema>;
export type RefundListQuery = z.infer<typeof refundListQuerySchema>;
