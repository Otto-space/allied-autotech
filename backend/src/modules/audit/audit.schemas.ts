import { z } from "zod";

const page = {
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};
const isoDate = z.iso.datetime({ offset: true });

export const auditListQuerySchema = z
  .object({
    ...page,
    userId: z.uuid().optional(),
    action: z
      .enum([
        "CREATE",
        "UPDATE",
        "DELETE",
        "READ",
        "LOGIN",
        "LOGOUT",
        "PASSWORD_RESET",
        "EMAIL_VERIFIED",
        "MFA_ENABLED",
        "MFA_DISABLED",
        "SESSION_REVOKED",
        "ROLE_CHANGE",
        "ACCOUNT_SUSPENDED",
        "ACCOUNT_DEACTIVATED",
        "STATUS_CHANGE",
        "INVENTORY_ADJUSTED",
        "PAYMENT_INITIALIZED",
        "PAYMENT_VERIFIED",
        "MANUAL_PAYMENT_APPROVED",
        "REFUND_REQUESTED",
        "REFUND_APPROVED",
        "PAYMENT_REFUNDED",
        "DISPUTE_UPDATED",
        "VEHICLE_RESERVED",
        "VEHICLE_RELEASED",
        "INVITATION_CREATED",
        "INVITATION_ACCEPTED",
        "BRANCH_ASSIGNED",
      ])
      .optional(),
    entityType: z
      .enum([
        "USER",
        "BRANCH",
        "PRIVILEGED_INVITATION",
        "SESSION",
        "MFA_FACTOR",
        "CUSTOMER_PROFILE",
        "STAFF_PROFILE",
        "CUSTOMER_VEHICLE",
        "SERVICE",
        "BOOKING",
        "QUOTE",
        "WORK_ORDER",
        "PRODUCT",
        "INVENTORY",
        "ORDER",
        "PAYMENT",
        "PAYMENT_ATTEMPT",
        "REFUND",
        "DISPUTE",
        "VEHICLE",
        "VEHICLE_LISTING",
        "VEHICLE_TRANSACTION",
        "INSPECTION",
        "REVIEW",
        "ENQUIRY",
        "COMPLAINT",
        "PROMOTION",
        "INVOICE",
      ])
      .optional(),
    entityId: z.string().trim().min(1).max(120).optional(),
    requestId: z.string().trim().min(1).max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .strict();

export const operationalJobsQuerySchema = z
  .object({
    ...page,
    source: z.enum(["OUTBOX", "PAYMENT_WEBHOOK"]).optional(),
    status: z.enum(["FAILED", "DEAD_LETTER", "PROCESSING"]).optional(),
  })
  .strict();
export const operationalJobParamsSchema = z
  .object({ source: z.enum(["outbox", "webhook"]), jobId: z.uuid() })
  .strict();
export const operationalRetryBodySchema = z
  .object({ expectedAttempts: z.number().int().min(1).max(1_000), reason: z.string().trim().min(3).max(500) })
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
export const operationsEmptyQuerySchema = z.object({}).strict().default({});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
export type OperationalJobsQuery = z.infer<typeof operationalJobsQuerySchema>;
export type OperationalRetryInput = z.infer<typeof operationalRetryBodySchema>;
export type AnomalyListQuery = z.infer<typeof anomalyListQuerySchema>;
export type AnomalyUpdateInput = z.infer<typeof anomalyUpdateBodySchema>;
