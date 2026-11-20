import { z } from "zod";
import { bookingStatuses } from "../customer-booking-query";
const uuid = z.uuid(),
  version = z.number().int().nonnegative(),
  date = z.iso.datetime({ offset: true });
export const bookingWorkEstimateSchema = z
  .object({
    reviewedAt: date,
    remainingMinutes: z.number().int().min(1).max(1440),
    estimatedWorkEndsAt: date,
  })
  .strict();
export type BookingWorkEstimate = z.infer<typeof bookingWorkEstimateSchema>;
const reviewSchema = z
  .object({
    id: uuid,
    bookingVersion: version,
    resourcePolicyVersionId: uuid,
    reviewedAt: date,
    remainingMinutes: z.number().int().min(1).max(1440),
    cleanupMinutes: z.number().int().min(0).max(1440),
    expectedWorkEndsAt: date,
    resourceIds: z.array(uuid).max(40),
    resourceNames: z.array(z.string()).max(40).optional(),
    reason: z.string().max(1000),
    performedByUserId: uuid,
  })
  .strict();
export const workReviewOptionsSchema = z
  .object({
    bookingId: uuid,
    version,
    scheduleVersion: version,
    status: z.enum(bookingStatuses),
    branchId: uuid.nullable(),
    serviceId: uuid.nullable(),
    staffId: uuid.nullable(),
    startedAt: date.nullable(),
    canReview: z.boolean(),
    resourcePolicyVersionId: uuid.nullable(),
    cleanupMinutes: z.number().int().min(0).max(1440).nullable(),
    requirements: z.array(
      z.object({ pool: z.string(), quantity: z.number().int().positive() }),
    ),
    resources: z.array(
      z.object({
        id: uuid,
        name: z.string(),
        kind: z.enum(["EQUIPMENT", "SPACE"]),
        status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
        pools: z.array(z.string()),
      }),
    ),
    current: reviewSchema.nullable(),
  })
  .strict();
export type WorkReviewOptions = z.infer<typeof workReviewOptionsSchema>;
export const workReviewInputSchema = z
  .object({
    expectedVersion: version,
    resourcePolicyVersionId: uuid,
    remainingMinutes: z.number().int().min(1).max(1440),
    cleanupMinutes: z.number().int().min(0).max(1440),
    resourceIds: z
      .array(uuid)
      .max(40)
      .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length),
    reason: z
      .string()
      .trim()
      .min(10)
      .max(1000)
      .refine((s) => !/[\u0000-\u001f\u007f]/.test(s)),
  })
  .strict();
export type WorkReviewInput = z.infer<typeof workReviewInputSchema>;
export type WorkReviewBooking = {
  id: string;
  version: number;
  scheduleVersion?: number;
  status: string;
  branchId: string | null;
  scheduledAt: string | null;
  startedAt?: string | null;
  assignedStaff?: { id: string } | null;
  service?: { name?: string } | null;
};
export function parseWorkReviewReceipt(
  value: unknown,
  before: WorkReviewOptions,
  booking: WorkReviewBooking,
  owner: string,
  input: WorkReviewInput,
) {
  const data = z
    .object({
      id: uuid,
      branchId: uuid,
      serviceId: uuid,
      staffId: uuid,
      version,
      scheduleVersion: version,
      status: z.enum(bookingStatuses),
      scheduledAt: date,
      startedAt: date,
      performedByUserId: uuid,
      review: reviewSchema,
    })
    .strict()
    .parse(value);
  const row = data.review,
    units = new Set(input.resourceIds.map((id) => id.toLowerCase()));
  if (
    data.id !== before.bookingId ||
    data.id !== booking.id ||
    data.branchId !== before.branchId ||
    data.serviceId !== before.serviceId ||
    data.staffId !== before.staffId ||
    data.version !== input.expectedVersion + 1 ||
    before.version !== input.expectedVersion ||
    data.scheduleVersion !== before.scheduleVersion ||
    data.status !== before.status ||
    data.scheduledAt !== booking.scheduledAt ||
    data.startedAt !== before.startedAt ||
    data.performedByUserId !== owner ||
    row.performedByUserId !== owner ||
    row.bookingVersion !== data.version ||
    row.resourcePolicyVersionId !== input.resourcePolicyVersionId ||
    row.remainingMinutes !== input.remainingMinutes ||
    row.cleanupMinutes !== input.cleanupMinutes ||
    row.reason !== input.reason ||
    row.resourceIds.length !== units.size ||
    row.resourceIds.some((id) => !units.has(id.toLowerCase())) ||
    Date.parse(row.reviewedAt) < Date.parse(data.startedAt) ||
    Date.parse(row.expectedWorkEndsAt) - Date.parse(row.reviewedAt) !==
      input.remainingMinutes * 60000
  )
    throw Error(
      "The saved work review could not be verified. Check the current review before trying again.",
    );
  return data;
}
