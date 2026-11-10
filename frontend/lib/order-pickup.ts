import { z } from "zod";
const lines = z
  .array(z.object({ orderItemId: z.uuid(), quantity: z.number().int().positive() }))
  .max(200);
const time = z.iso.datetime({ offset: true });
export const pickupSummarySchema = z.object({
  collectionHoldCapabilityVersion: z.literal(1).optional(),
  holding: z
    .object({
      state: z.enum(["PENDING", "HOLDING", "OVERDUE", "COLLECTED"]),
      notifiedAt: time.nullable(),
      originalCollectByDate: z.iso.date().nullable(),
      collectByDate: z.iso.date().nullable(),
      extendedAt: time.nullable(),
      pendingReason: z.enum(["READINESS_REQUIRED", "NOTIFICATION_REQUIRED"]).nullable(),
      latestNotificationAttempt: z
        .object({ kind: z.enum(["NOTIFIED", "NOTIFICATION_FAILED"]), createdAt: time })
        .nullable(),
    })
    .optional(),
  orderId: z.uuid(),
  version: z.number().int().nonnegative(),
  status: z.string(),
  legacyCompleted: z.boolean(),
  remaining: lines,
  handoverReview: z.object({ id: z.uuid(), claimedAt: time }).nullable(),
  authorisation: z
    .object({ id: z.uuid(), issuedAt: time, expiresAt: time, lines })
    .nullable(),
  handovers: z
    .array(z.object({ id: z.uuid(), createdAt: time, collectorName: z.string(), lines }))
    .max(25),
  hasMoreHistory: z.boolean(),
});
export const pickupIssueResultSchema = z.object({
  orderId: z.uuid(),
  authorisationId: z.uuid(),
  pickupCode: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .nullable(),
  expiresAt: time,
  replayed: z.boolean(),
});
export const pickupReviewSchema = z.object({
  orderId: z.uuid(),
  version: z.number().int().nonnegative(),
  claimId: z.uuid(),
  authorisationId: z.uuid(),
  expiresAt: time,
  financialReviewHash: z.string().regex(/^[0-9a-f]{64}$/),
  lines: lines.element.extend({ productName: z.string() }).array().min(1).max(200),
  completesOrder: z.boolean(),
});
export const pickupReceiptSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  claimId: z.uuid(),
  collectedAt: time,
  lines,
  complete: z.boolean(),
  replayed: z.boolean(),
});
export type PickupSummary = z.infer<typeof pickupSummarySchema>;
export type PickupReview = z.infer<typeof pickupReviewSchema>;
export function selectedPickupLines(
  form: FormData,
  remaining: PickupSummary["remaining"],
) {
  const selected = remaining
    .map((line) => ({
      orderItemId: line.orderItemId,
      quantity: z.coerce
        .number()
        .int()
        .min(0)
        .max(line.quantity)
        .parse(form.get(line.orderItemId)),
    }))
    .filter((line) => line.quantity > 0);
  return lines.min(1).parse(selected);
}
export function samePickupLines(
  a: PickupSummary["remaining"],
  b: PickupSummary["remaining"],
) {
  const key = (value: typeof a) =>
    JSON.stringify(
      value
        .map(({ orderItemId, quantity }) => ({ orderItemId, quantity }))
        .sort((x, y) => x.orderItemId.localeCompare(y.orderItemId)),
    );
  return key(a) === key(b);
}
