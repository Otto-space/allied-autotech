import { AppError } from "../../common/errors/app-error.js";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { serviceOperationConflict } from "./service-operations.errors.js";
import { timingWindow } from "./booking-timing.js";
import {
  assertSlotCalendar,
  calendarWindowAllowed,
  technicianConflictSelect,
} from "./booking-slot-timing.js";
import {
  assertOfferedWorkshopResources,
  approvedWorkshopResources,
} from "./booking-resources.js";
import {
  workshopResourceAvailabilitySelect,
  type WorkshopResourceAvailability,
} from "./booking-resource-availability.js";
import { selectWorkshopResources } from "./workshop-resources.js";
import { eligibleWorkshopTechnicianWhere } from "./workshop-technician-eligibility.js";
import { capacitySettingsSchema } from "./booking-capacity.js";
import { approvedPolicy } from "../policies/policies.service.js";
import {
  effectiveAttendance,
  attendanceWorkReviewRequired,
} from "./booking-attendance.js";
import { ServiceOperationsRepository } from "./service-operations.repository.js";

export const alternativeOptionsQuerySchema = z.strictObject({ day: z.iso.date() });
export const alternativeOptionsSchema = z.object({
  bookingId: z.uuid(),
  bookingVersion: z.number().int(),
  day: z.iso.date(),
  items: z.array(z.object({ startsAt: z.iso.datetime() })).max(40),
});
type Booking = NonNullable<
  Awaited<ReturnType<ServiceOperationsRepository["lockBooking"]>>
>;
export const nigeriaDay = (date: Date) =>
  new Date(date.getTime() + 3_600_000).toISOString().slice(0, 10);

async function alternativeWindow(
  tx: Prisma.TransactionClient,
  booking: Booking,
  now: Date,
) {
  const visit =
    booking.status === "CONFIRMED" && !booking.startedAt && booking.scheduledAt <= now
      ? await effectiveAttendance(tx, booking)
      : null;
  const shortNotice = !!visit && ["ARRIVED", "WAITING", "LEFT"].includes(visit.kind);
  return {
    from: new Date(now.getTime() + (shortNotice ? 0 : 7 * 86_400_000)),
    to: new Date(now.getTime() + 14 * 86_400_000),
  };
}
export async function assertAlternativeWindow(
  tx: Prisma.TransactionClient,
  booking: Booking,
  startsAt: Date,
  now = new Date(),
) {
  const window = await alternativeWindow(tx, booking, now);
  if (startsAt <= now || startsAt < window.from || startsAt > window.to)
    throw serviceOperationConflict(
      "Choose a future available time within 7-14 days, or a short-notice alternative for a recorded late visit",
    );
}

async function alternativeContext(tx: Prisma.TransactionClient, booking: Booking) {
  if (
    !booking.branchId ||
    !booking.serviceId ||
    booking.startedAt ||
    attendanceWorkReviewRequired(booking) ||
    !["REQUESTED", "CONFIRMED"].includes(booking.status)
  )
    throw serviceOperationConflict(
      "Assess the service before checking alternatives for this unstarted appointment",
    );
  const service = await tx.service.findUnique({ where: { id: booking.serviceId } });
  const timing = await tx.bookingTimingSnapshot.findUnique({
    where: {
      bookingId_scheduleVersion: {
        bookingId: booking.id,
        scheduleVersion: booking.scheduleVersion,
      },
    },
  });
  if (!service?.isActive) throw serviceOperationConflict("The service is unavailable");
  if (
    timing &&
    (timing.serviceId !== booking.serviceId ||
      timing.scheduledAt.getTime() !== booking.scheduledAt.getTime())
  )
    throw serviceOperationConflict(
      "Review the saved appointment timing before choosing an alternative",
    );
  const estimate = timing ?? service;
  timingWindow(booking.scheduledAt, estimate);
  const plan = await approvedWorkshopResources(tx, booking.branchId);
  const staff = await tx.staffProfile.findMany({
    where: {
      AND: [
        {
          id: {
            in: plan.settings.technicians
              .filter((t) => t.serviceIds.includes(booking.serviceId!))
              .map((t) => t.staffId),
          },
        },
        eligibleWorkshopTechnicianWhere(booking.branchId, new Date()),
      ],
    },
    select: { id: true },
  });
  const staffIds = staff.map((t) => t.id).sort();
  if (!staffIds.length)
    throw serviceOperationConflict("No qualified technician is available in this branch");
  return {
    branchId: booking.branchId,
    serviceId: booking.serviceId,
    staffIds,
    plan,
    estimate,
  };
}

/** No reservation or schedule mutation. Approval rechecks and reserves atomically. */
export async function reviewBookingAlternative(
  tx: Prisma.TransactionClient,
  booking: Booking,
  startsAt: Date,
  selectedStaffId?: string,
  stage: "PROPOSAL" | "APPROVAL" = "PROPOSAL",
) {
  if (stage === "APPROVAL") {
    if (startsAt <= new Date())
      throw serviceOperationConflict("The requested replacement time has passed");
  } else await assertAlternativeWindow(tx, booking, startsAt);
  if (startsAt.getTime() === booking.scheduledAt.getTime())
    throw serviceOperationConflict("Choose a different appointment time");
  const context = await alternativeContext(tx, booking);
  const window = timingWindow(startsAt, context.estimate);
  if (window.startsAt <= new Date())
    throw serviceOperationConflict(
      "Allow the full preparation time before the proposed appointment",
    );
  await assertSlotCalendar(
    tx,
    context.branchId,
    window.startsAt,
    window.endsAt,
    booking.id,
  );
  const choices = selectedStaffId
    ? context.staffIds.filter((id) => id === selectedStaffId)
    : context.staffIds;
  // Match the shared staff-before-customer lock order; candidate identities are sorted.
  for (const staffId of choices)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${staffId}`},0))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${booking.customerId}`},0))`;
  const repository = new ServiceOperationsRepository();
  if (
    await repository.hasCustomerScheduleConflict(
      booking.customerId,
      startsAt,
      window.jobEndsAt,
      booking.id,
      tx,
    )
  )
    throw serviceOperationConflict("The customer has another appointment in this period");
  for (const staffId of choices) {
    if (
      await repository.hasScheduleConflict(
        staffId,
        window.startsAt,
        window.endsAt,
        booking.id,
        tx,
      )
    )
      continue;
    try {
      await assertOfferedWorkshopResources(tx, {
        branchId: context.branchId,
        serviceId: context.serviceId,
        staffId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        excludeBookingId: booking.id,
      });
      return;
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode !== 409) throw error;
    }
  }
  throw serviceOperationConflict(
    "This time is no longer available with an eligible technician and required resources. The original appointment is unchanged",
  );
}

/** A bounded, private day search using this booking's saved duration and buffers. */
export async function bookingAlternativeOptions(
  tx: Prisma.TransactionClient,
  booking: Booking,
  day: string,
) {
  const context = await alternativeContext(tx, booking),
    now = new Date();
  const policy = await approvedPolicy(tx, `booking-capacity:${context.branchId}`);
  const parsed = capacitySettingsSchema.safeParse(policy.settings);
  if (!parsed.success)
    throw serviceOperationConflict(
      "Review the approved workshop calendar before checking alternatives",
    );
  const calendar = parsed.data;
  const plan = context.plan;
  const from = new Date(`${day}T08:00:00+01:00`),
    to = new Date(`${day}T17:45:00+01:00`);
  // A day outside the window has an honest empty state rather than a failed search.
  if (to <= now || from.getTime() > now.getTime() + 14 * 86_400_000)
    return { bookingId: booking.id, bookingVersion: booking.version, day, items: [] };
  const used = await tx.booking.count({
    where: {
      id: { not: booking.id },
      branchId: context.branchId,
      status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] },
      scheduledAt: {
        gte: new Date(`${day}T00:00:00+01:00`),
        lt: new Date(new Date(`${day}T00:00:00+01:00`).getTime() + 86_400_000),
      },
    },
  });
  if (used >= calendar.dailyLimit)
    return { bookingId: booking.id, bookingVersion: booking.version, day, items: [] };
  const starts = Prisma.sql`candidate - make_interval(mins=>${context.estimate.preparationMinutes!})`;
  const ends = Prisma.sql`candidate + make_interval(mins=>${context.estimate.durationMinutes! + context.estimate.cleanupMinutes!})`;
  const needsResources =
    (plan.settings.services.find((row) => row.serviceId === context.serviceId)
      ?.requirements.length ?? 0) > 0;
  const availabilityQuery = needsResources
    ? workshopResourceAvailabilitySelect(
        Prisma.sql`${context.branchId}::uuid`,
        starts,
        ends,
        Prisma.sql`${booking.id}::uuid`,
      )
    : Prisma.sql`SELECT false AS "legacyUnassessed", ARRAY[]::uuid[] AS "busyResourceIds"`;
  const rows = await tx.$queryRaw<
    Array<WorkshopResourceAvailability & { startsAt: Date; staffId: string }>
  >(Prisma.sql`
    SELECT candidate AS "startsAt", technician.id AS "staffId", availability.* FROM generate_series(${from}::timestamp, ${to}::timestamp, interval '15 minutes') candidate CROSS JOIN unnest(${context.staffIds}::uuid[]) technician(id)
    CROSS JOIN LATERAL (${availabilityQuery}) availability
    WHERE ${starts}>timezone('UTC',now()) AND candidate<>${booking.scheduledAt}
    AND NOT EXISTS (${technicianConflictSelect(Prisma.sql`technician.id`, starts, ends, Prisma.sql`${booking.id}::uuid`)}) ORDER BY candidate`);
  const repository = new ServiceOperationsRepository();
  const items: Array<{ startsAt: string }> = [];
  const allowed = await alternativeWindow(tx, booking, now);
  for (const row of rows) {
    if (row.startsAt <= now || row.startsAt < allowed.from || row.startsAt > allowed.to)
      continue;
    const window = timingWindow(row.startsAt, context.estimate);
    if (
      row.legacyUnassessed ||
      !calendarWindowAllowed(calendar, window.startsAt, window.endsAt) ||
      !selectWorkshopResources(plan.settings, {
        serviceId: context.serviceId,
        staffId: row.staffId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        busyResourceIds: new Set(row.busyResourceIds.map((id) => id.toLowerCase())),
      }).ok
    )
      continue;
    if (
      await repository.hasCustomerScheduleConflict(
        booking.customerId,
        row.startsAt,
        window.jobEndsAt,
        booking.id,
        tx,
      )
    )
      continue;
    if (!items.some((item) => item.startsAt === row.startsAt.toISOString()))
      items.push({ startsAt: row.startsAt.toISOString() });
  }
  return { bookingId: booking.id, bookingVersion: booking.version, day, items };
}
