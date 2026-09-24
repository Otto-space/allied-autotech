import { z } from "zod";
import { operationalOrderSchema, money } from "./commerce-schemas";
const date = z.iso.datetime({ offset: true }).nullable();
export const aftercareOrderSchema = operationalOrderSchema.extend({
  confirmedAt: date,
  fulfillmentEvidenceAt: date,
  fulfillmentEvidenceReference: z.string().nullable(),
});
export const aftercareItemSchema = z.object({
  orderItemId: z.uuid(),
  quantity: z.number().int().min(1).max(100000),
});
export const aftercareSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  kind: z.enum(["RETURN", "CANCELLATION"]),
  status: z.enum(["REQUESTED", "RECEIVED", "INSPECTED", "APPROVED", "REJECTED"]),
  reason: z.string(),
  items: z.array(aftercareItemSchema).min(1).max(100),
  requestedAt: z.iso.datetime({ offset: true }),
  receivedAt: date,
  inspectedAt: date,
  goodCondition: z.boolean().nullable(),
  approvedFeeKobo: money.nullable(),
  reviewedAt: date,
  reviewNote: z.string().nullable(),
  refundDueAt: date,
  refundClockStatus: z.string(),
});
export const staffAftercareSchema = aftercareSchema.extend({
  inspectionNote: z.string().nullable(),
});
export const aftercareRequestSchema = z.object({
  kind: z.enum(["RETURN", "CANCELLATION"]),
  reason: z.string().trim().min(10).max(2000),
  items: z.array(aftercareItemSchema).min(1).max(100),
});
export type Aftercare = z.infer<typeof aftercareSchema>;
export type AftercareOrder = z.infer<typeof aftercareOrderSchema>;
export const aftercareLabels = {
  REQUESTED: "Requested for review",
  RECEIVED: "Returned goods received",
  INSPECTED: "Condition inspected",
  APPROVED: "Approved for the next steps",
  REJECTED: "Not approved",
} as const;
export const aftercareKinds = {
  RETURN: "Return request",
  CANCELLATION: "Cancellation request",
} as const;
export const parseAftercareOrder = (value: unknown) => aftercareOrderSchema.parse(value);
export const parseAftercareList = (value: unknown) =>
  z.array(aftercareSchema).max(100).parse(value);
export const parseStaffAftercareList = (value: unknown) =>
  z.array(staffAftercareSchema).max(100).parse(value);
export function matchesAftercareOrder(record: Aftercare, order: AftercareOrder) {
  return (
    record.orderId === order.id &&
    new Set(record.items.map((i) => i.orderItemId)).size === record.items.length &&
    record.items.every((i) =>
      order.items.some(
        (original) => original.id === i.orderItemId && i.quantity <= original.quantity,
      ),
    )
  );
}
