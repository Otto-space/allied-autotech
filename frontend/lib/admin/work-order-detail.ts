import { z } from "zod";
import { workOrderSchema } from "./work-orders";

export const fulfilmentTransitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
} as const;
export const nextOrderStatus = z.enum([
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);
const date = z.iso.datetime({ offset: true }).nullable().optional();
export const staffOrderDetailSchema = workOrderSchema
  .extend({
    branch: workOrderSchema.shape.branch.nullable(),
    customerName: z.string().min(1),
    customerEmail: z.email(),
    customerPhone: z.string().nullable(),
    cancellationReason: z.string().nullable(),
    updatedAt: date,
    confirmedAt: date,
    processingAt: date,
    readyAt: date,
    completedAt: date,
    cancelledAt: date,
    paymentDueAt: date,
    fulfillmentEvidenceAt: date,
    fulfillmentEvidenceReference: z.string().nullable().optional(),
    invoice: z
      .object({ id: z.uuid(), invoiceNumber: z.string().min(1), status: z.string() })
      .nullable()
      .optional(),
    items: z.array(
      workOrderSchema.shape.items.element.extend({
        quantity: z.number().int().positive(),
      }),
    ),
    allowedTransitions: z.array(nextOrderStatus).max(2),
  })
  .superRefine((order, context) => {
    if (new Set(order.items.map((item) => item.id)).size !== order.items.length)
      context.addIssue({ code: "custom", message: "Duplicate order items" });
    if (
      new Set(order.allowedTransitions).size !== order.allowedTransitions.length ||
      order.allowedTransitions.some(
        (status) =>
          !(fulfilmentTransitions[order.status] as readonly string[]).includes(status) ||
          (status !== "CANCELLED" && !order.paidAt),
      )
    )
      context.addIssue({ code: "custom", message: "Unavailable fulfilment transition" });
  });
export type StaffOrderRecord = z.infer<typeof staffOrderDetailSchema>;
export const parseStaffOrderDetail = (value: unknown) =>
  staffOrderDetailSchema.parse(value);
export function orderChangeSnapshot(order: StaffOrderRecord) {
  const { invoice: _invoice, ...operational } = order;
  void _invoice;
  return JSON.stringify(operational);
}
export const fulfilmentReason = z
  .string()
  .trim()
  .max(500, "Use at most 500 characters.")
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/.test(value),
    "Use one paragraph without control characters.",
  );
export function orderActivity(order: StaffOrderRecord) {
  return [
    { label: "Created", at: order.createdAt },
    { label: "Payment recorded", at: order.paidAt },
    { label: "Confirmed", at: order.confirmedAt },
    { label: "Processing", at: order.processingAt },
    { label: "Ready", at: order.readyAt },
    { label: "Completed", at: order.completedAt },
    { label: "Cancelled", at: order.cancelledAt },
    {
      label: "Collection or delivery evidence recorded",
      at: order.fulfillmentEvidenceAt,
    },
  ]
    .filter((entry): entry is { label: string; at: string } => !!entry.at)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
export const pendingOrderKey = (owner: string, orderId: string) =>
  `work-order-pending:${owner}:${orderId}`;
export function pendingOrderChange(key: string) {
  try {
    return !!sessionStorage.getItem(key);
  } catch {
    return false;
  }
}
export function markOrderPending(key: string) {
  try {
    sessionStorage.setItem(key, "pending");
  } catch {
    /* In-memory locking remains active. */
  }
}
export function clearOrderPending(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Keep server version protection. */
  }
}
