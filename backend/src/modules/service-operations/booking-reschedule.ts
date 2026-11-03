import type { Prisma } from "../../generated/prisma/client.js";
import { z } from "zod";
import { serviceOperationConflict } from "./service-operations.errors.js";
const scheduleSchema = z
  .object({
    scheduledAt: z.iso.datetime(),
    bookingSlotId: z.uuid().nullable(),
    branchId: z.uuid().nullable(),
    serviceId: z.uuid().nullable(),
    scheduleVersion: z.number().int().nonnegative(),
    status: z.string(),
  })
  .strict();
type Schedule = {
  scheduledAt: Date;
  bookingSlotId: string | null;
  branchId: string | null;
  serviceId: string | null;
  scheduleVersion: number;
  status: string;
};
export function rescheduleOriginal(booking: Schedule) {
  return {
    scheduledAt: booking.scheduledAt.toISOString(),
    bookingSlotId: booking.bookingSlotId,
    branchId: booking.branchId,
    serviceId: booking.serviceId,
    scheduleVersion: booking.scheduleVersion,
    status: booking.status,
  };
}
export function assertOriginalAppointment(snapshot: unknown, booking: Schedule) {
  const parsed = scheduleSchema.safeParse(snapshot);
  const current = rescheduleOriginal(booking);
  if (
    !parsed.success ||
    !["REQUESTED", "CONFIRMED"].includes(booking.status) ||
    Object.entries(current).some(
      ([key, value]) => parsed.data[key as keyof typeof current] !== value,
    )
  )
    throw serviceOperationConflict(
      "The original appointment changed. Refresh and review the reschedule request again",
    );
}
/** Caller owns the booking row lock. A request is never a capacity reservation. */
export async function createPendingReschedule(
  tx: Prisma.TransactionClient,
  booking: Schedule & { id: string },
  userId: string,
  target: { id: string | null; branchId: string; startsAt: Date },
  reason: string,
  source: "CUSTOMER" | "WORKSHOP_ALTERNATIVE",
) {
  if (
    await tx.bookingRescheduleRequest.findFirst({
      where: { bookingId: booking.id, status: "PENDING" },
      select: { id: true },
    })
  )
    throw serviceOperationConflict(
      "A reschedule request is already awaiting review. Withdraw it before requesting another time",
    );
  return tx.bookingRescheduleRequest.create({
    data: {
      bookingId: booking.id,
      requestedByUserId: userId,
      branchId: target.branchId,
      slotId: target.id,
      startsAt: target.startsAt,
      reason,
      source,
      originalSchedule: rescheduleOriginal(booking),
    },
  });
}
