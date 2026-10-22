import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { anomalyListQuerySchema } from "./audit.schemas.js";

/** Shared safe projection: never return provider payloads or internal details. */
export const anomalySelect = {
  id: true,
  paymentId: true,
  paymentAttemptId: true,
  refundId: true,
  disputeId: true,
  type: true,
  status: true,
  summary: true,
  detectedAt: true,
  resolvedAt: true,
  resolutionNote: true,
  resolvedByUserId: true,
  updatedAt: true,
} satisfies Prisma.PaymentAnomalySelect;
export const anomalyRecordSchema = z
  .object({
    id: z.uuid(),
    paymentId: z.uuid().nullable(),
    paymentAttemptId: z.uuid().nullable(),
    refundId: z.uuid().nullable(),
    disputeId: z.uuid().nullable(),
    type: anomalyListQuerySchema.shape.type.unwrap(),
    status: anomalyListQuerySchema.shape.status.unwrap(),
    summary: z.string(),
    detectedAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    resolvedAt: z.iso.datetime({ offset: true }).nullable(),
    resolutionNote: z.string().nullable(),
    resolvedByUserId: z.uuid().nullable(),
  })
  .strict();
