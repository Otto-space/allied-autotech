import { Prisma } from "../../generated/prisma/client.js";

export type WorkReviewBooking = {
  id: string;
  version: number;
  scheduleVersion: number;
  status: string;
  branchId: string | null;
  serviceId: string | null;
  assignedStaffId: string | null;
  scheduledAt: Date;
  startedAt: Date | null;
};
export const bookingWorkEstimateSelect = {
  id: true,
  bookingId: true,
  bookingVersion: true,
  scheduleVersion: true,
  branchId: true,
  serviceId: true,
  staffId: true,
  scheduledAt: true,
  workStartedAt: true,
  workReviewedAt: true,
  remainingMinutes: true,
  cleanupMinutes: true,
  expectedWorkEndsAt: true,
} satisfies Prisma.BookingResourceAllocationSelect;
export type EstimateAllocation = Prisma.BookingResourceAllocationGetPayload<{
  select: typeof bookingWorkEstimateSelect;
}>;
/** Never revive an older review after a newer allocation or identity change. */
export function currentWorkEstimate(
  booking: WorkReviewBooking,
  allocations: EstimateAllocation[],
) {
  const row = allocations[0];
  if (
    !row ||
    !row.workReviewedAt ||
    !row.workStartedAt ||
    row.remainingMinutes === null ||
    row.cleanupMinutes === null ||
    !row.expectedWorkEndsAt ||
    row.bookingVersion > booking.version ||
    row.bookingId !== booking.id ||
    row.scheduleVersion !== booking.scheduleVersion ||
    row.branchId !== booking.branchId ||
    row.serviceId !== booking.serviceId ||
    row.staffId !== booking.assignedStaffId ||
    row.scheduledAt.getTime() !== booking.scheduledAt.getTime() ||
    row.workStartedAt.getTime() !== booking.startedAt?.getTime()
  )
    return null;
  return {
    reviewedAt: row.workReviewedAt,
    remainingMinutes: row.remainingMinutes,
    estimatedWorkEndsAt: row.expectedWorkEndsAt,
  };
}

export function bookingWithWorkEstimate<
  T extends WorkReviewBooking & { resourceAllocations?: EstimateAllocation[] },
>(booking: T) {
  const { resourceAllocations, ...safe } = booking;
  return {
    ...safe,
    workEstimate: currentWorkEstimate(booking, resourceAllocations ?? []),
  };
}
