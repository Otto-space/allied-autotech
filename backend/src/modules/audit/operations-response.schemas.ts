import { z } from "zod";
import { operationalJobCursorSchema } from "./operational-job-cursor.js";
const date = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const jobFields = {
  id: z.uuid(),
  eventType: z.string(),
  status: z.enum(["FAILED", "DEAD_LETTER", "PROCESSING"]),
  lockedAt: date.nullable(),
  updatedAt: date,
};
export const operationalJobResponseSchema = z.discriminatedUnion("source", [
  z
    .object({
      ...jobFields,
      source: z.literal("OUTBOX"),
      eventId: z.uuid(),
      aggregateType: z.string(),
      aggregateId: z.string(),
      attempts: count,
      availableAt: date,
      lastError: z.string().nullable(),
      createdAt: date,
    })
    .strict(),
  z
    .object({
      ...jobFields,
      source: z.literal("PAYMENT_WEBHOOK"),
      processingAttempts: count,
      nextAttemptAt: date.nullable(),
      lastErrorCode: z.string().nullable(),
      lastErrorMessage: z.string().nullable(),
      receivedAt: date,
    })
    .strict(),
]);
export const operationalJobsResponseSchema = z
  .object({
    items: z.array(operationalJobResponseSchema).max(100),
    nextCursor: operationalJobCursorSchema.optional(),
  })
  .strict();
export const operationalRetryResponseSchema = z
  .object({
    id: z.uuid(),
    source: z.enum(["outbox", "webhook"]),
    status: z.literal("RETRY_REQUESTED"),
    attempts: count,
  })
  .strict();
const outboxStatuses = z.enum([
  "PENDING",
  "PROCESSING",
  "PUBLISHED",
  "FAILED",
  "DEAD_LETTER",
]);
const queue = z.discriminatedUnion("queue", [
  z.object({ queue: z.literal("outbox"), status: outboxStatuses, count }).strict(),
  z
    .object({ queue: z.literal("notification_delivery"), status: outboxStatuses, count })
    .strict(),
  z
    .object({
      queue: z.literal("payment_webhook"),
      status: z.enum(["RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "DEAD_LETTER"]),
      count,
    })
    .strict(),
]);
const workerBase = { name: z.string().min(1).max(100), staleAfterMs: count };
const worker = z.discriminatedUnion("missing", [
  z
    .object({ ...workerBase, missing: z.literal(true), overdue: z.literal(true) })
    .strict(),
  z
    .object({
      ...workerBase,
      missing: z.literal(false),
      overdue: z.boolean(),
      lastStartedAt: date,
      lastSucceededAt: date.nullable(),
      lastFailedAt: date.nullable(),
      errorCode: z.string().nullable(),
    })
    .strict(),
]);
export const operationsStatusResponseSchema = z
  .object({
    queues: z.array(queue).max(15),
    openPaymentAnomalies: count,
    lastReconciliation: z
      .object({
        id: z.uuid(),
        status: z.enum(["RUNNING", "MATCHED", "DIFFERENCES_FOUND", "FAILED"]),
        periodStart: date,
        periodEnd: date,
        differenceCount: count,
        completedAt: date.nullable(),
        startedAt: date,
      })
      .strict()
      .nullable(),
    workers: z.array(worker).max(9),
    operationalAlerts: z
      .array(
        z
          .object({
            id: z.uuid(),
            key: z.string(),
            category: z.string(),
            resourceId: z.uuid().nullable(),
            message: z.string(),
            createdAt: date,
            resolvedAt: z.null(),
            resolvedByUserId: z.uuid().nullable(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
