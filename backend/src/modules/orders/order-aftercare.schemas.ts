import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
export const aftercareParams = z.object({ id: z.uuid() }).strict();
export const aftercareItemSchema = z
  .object({ orderItemId: z.uuid(), quantity: z.number().int().min(1).max(100000) })
  .strict();
export const aftercareReturnBody = z
  .object({ reason: z.string().trim().min(10).max(2000) })
  .strict();
export const aftercarePartialBody = aftercareReturnBody
  .extend({
    kind: z.enum(["RETURN", "CANCELLATION"]),
    items: z.array(aftercareItemSchema).min(1).max(100),
  })
  .strict();
export const fulfillmentEvidenceBody = z
  .object({ at: z.iso.datetime(), reference: z.string().trim().min(5).max(300) })
  .strict();
export const aftercareStatus = z.enum([
  "REQUESTED",
  "RECEIVED",
  "INSPECTED",
  "APPROVED",
  "REJECTED",
]);
export const aftercareReviewBody = z
  .object({
    stage: z.enum(["RECEIVED", "INSPECTED", "APPROVED", "REJECTED"]),
    note: z.string().trim().min(20).max(2000),
    goodCondition: z.boolean().optional(),
    approvedFeeKobo: z
      .string()
      .regex(/^\d{1,18}$/)
      .optional(),
    expectedStatus: aftercareStatus.optional(),
  })
  .strict();
const date = z.iso.datetime({ offset: true }).nullable();
export const customerAftercareResponse = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  kind: z.enum(["RETURN", "CANCELLATION"]),
  status: aftercareStatus,
  reason: z.string(),
  items: z.array(aftercareItemSchema),
  requestedAt: z.iso.datetime({ offset: true }),
  receivedAt: date,
  inspectedAt: date,
  goodCondition: z.boolean().nullable(),
  approvedFeeKobo: z.string().regex(/^\d+$/).nullable(),
  reviewedAt: date,
  reviewNote: z.string().nullable(),
  refundDueAt: date,
  refundClockStatus: z.string(),
});
export const staffAftercareResponse = customerAftercareResponse.extend({
  customerId: z.uuid(),
  reviewReason: z.string(),
  inspectedByUserId: z.uuid().nullable(),
  inspectionNote: z.string().nullable(),
  reviewedByUserId: z.uuid().nullable(),
  policySnapshot: z.unknown(),
});
export const customerAftercareSelect = {
  id: true,
  orderId: true,
  kind: true,
  status: true,
  reason: true,
  items: true,
  requestedAt: true,
  receivedAt: true,
  inspectedAt: true,
  goodCondition: true,
  approvedFeeKobo: true,
  reviewedAt: true,
  reviewNote: true,
  refundDueAt: true,
  refundClockStatus: true,
} satisfies Prisma.OrderAftercareRequestSelect;
type CustomerRecord = Prisma.OrderAftercareRequestGetPayload<{
  select: typeof customerAftercareSelect;
}>;
export function customerAftercareView(record: CustomerRecord): CustomerRecord {
  return {
    id: record.id,
    orderId: record.orderId,
    kind: record.kind,
    status: record.status,
    reason: record.reason,
    items: record.items,
    requestedAt: record.requestedAt,
    receivedAt: record.receivedAt,
    inspectedAt: record.inspectedAt,
    goodCondition: record.goodCondition,
    approvedFeeKobo: record.approvedFeeKobo,
    reviewedAt: record.reviewedAt,
    reviewNote: record.reviewNote,
    refundDueAt: record.refundDueAt,
    refundClockStatus: record.refundClockStatus,
  };
}
