import { Prisma } from "../../generated/prisma/client.js";
import { capacitySettingsSchema } from "./booking-capacity.js";
import { timingWindow, type TimingValues } from "./booking-timing.js";
import { serviceOperationConflict } from "./service-operations.errors.js";
import { approvedPolicy } from "../policies/policies.service.js";
export type TimedSlot = TimingValues & {
  startsAt: Date;
  endsAt: Date;
  serviceTimingVersion: number | null;
};
export function slotTimingIsCurrent(
  slot: TimedSlot,
  service: TimingValues & { timingVersion: number },
) {
  return (
    slot.serviceTimingVersion !== null &&
    slot.serviceTimingVersion === service.timingVersion &&
    slot.durationMinutes !== null &&
    slot.preparationMinutes !== null &&
    slot.cleanupMinutes !== null &&
    slot.durationMinutes === service.durationMinutes &&
    slot.preparationMinutes === service.preparationMinutes &&
    slot.cleanupMinutes === service.cleanupMinutes &&
    slot.endsAt.getTime() === slot.startsAt.getTime() + slot.durationMinutes * 60000
  );
}
export function assertCurrentSlotTiming(
  slot: TimedSlot,
  service: TimingValues & { timingVersion: number },
) {
  if (!slotTimingIsCurrent(slot, service))
    throw serviceOperationConflict(
      "This offered time needs a fresh workshop timing review. Choose another time or send a preferred-time request.",
    );
  return timingWindow(slot.startsAt, slot);
}
export function calendarWindowAllowed(
  settings: ReturnType<typeof capacitySettingsSchema.parse>,
  startsAt: Date,
  endsAt: Date,
) {
  const start = new Date(startsAt.getTime() + 3600000),
    end = new Date(endsAt.getTime() + 3600000);
  const day = start.toISOString().slice(0, 10);
  return (
    settings.openingDays.includes(start.getUTCDay()) &&
    !settings.holidays.includes(day) &&
    day === end.toISOString().slice(0, 10) &&
    startsAt.getTime() >= Date.parse(`${day}T08:00:00+01:00`) &&
    endsAt.getTime() <= Date.parse(`${day}T18:00:00+01:00`) &&
    endsAt > startsAt
  );
}
export async function assertSlotCalendar(
  tx: Prisma.TransactionClient,
  branchId: string,
  startsAt: Date,
  endsAt: Date,
  excludeBookingId: string | null = null,
) {
  const policy = await approvedPolicy(tx, `booking-capacity:${branchId}`);
  const parsed = capacitySettingsSchema.safeParse(policy.settings);
  if (!parsed.success || !calendarWindowAllowed(parsed.data, startsAt, endsAt))
    throw serviceOperationConflict(
      "The full preparation, job and cleanup period must fit the approved workshop calendar",
    );
  const day = new Date(startsAt.getTime() + 3600000).toISOString().slice(0, 10),
    from = new Date(`${day}T00:00:00+01:00`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`branch-capacity:${branchId}:${day}`},0))`;
  const used = await tx.booking.count({
    where: {
      branchId,
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      scheduledAt: { gte: from, lt: new Date(from.getTime() + 86400000) },
      status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] },
    },
  });
  if (used >= parsed.data.dailyLimit)
    throw serviceOperationConflict("Approved branch daily capacity is full");
  return parsed.data;
}
/** SQL expressions are constructed by callers, never from user-supplied identifiers. */
export function technicianConflictSelect(
  staff: Prisma.Sql,
  starts: Prisma.Sql,
  ends: Prisma.Sql,
  exclude: Prisma.Sql,
) {
  return Prisma.sql`SELECT 1 FROM "Booking" b
 LEFT JOIN "BookingTimingSnapshot" t ON t."bookingId"=b."id" AND t."scheduleVersion"=b."scheduleVersion"
 WHERE b."assignedStaffId"=${staff} AND (b."status" IN ('REQUESTED','AWAITING_DEPOSIT','CONFIRMED','IN_PROGRESS','COMPLETED') OR (b."status"='CANCELLED' AND b."startedAt" IS NOT NULL))
 AND (${exclude} IS NULL OR b."id"<>${exclude}) AND (
 (t."id" IS NOT NULL AND t."durationMinutes" IS NOT NULL AND t."preparationMinutes" IS NOT NULL AND t."cleanupMinutes" IS NOT NULL
 AND LEAST(b."scheduledAt"-make_interval(mins=>t."preparationMinutes"),COALESCE(b."startedAt",b."scheduledAt")) < ${ends}
 AND (CASE
 WHEN b."status"='IN_PROGRESS' AND GREATEST(b."scheduledAt"+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes"),COALESCE(b."startedAt",b."scheduledAt")+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes"))<=timezone('UTC',now()) THEN 'infinity'::timestamp
 WHEN b."status"='COMPLETED' AND b."completedAt" IS NOT NULL THEN b."completedAt"+make_interval(mins=>t."cleanupMinutes")
 WHEN b."status"='CANCELLED' AND b."startedAt" IS NOT NULL AND b."cancelledAt" IS NOT NULL THEN b."cancelledAt"+make_interval(mins=>t."cleanupMinutes")
 ELSE GREATEST(b."scheduledAt"+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes"),COALESCE(b."startedAt",b."scheduledAt")+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes")) END) > ${starts})
 OR ((t."id" IS NULL OR t."durationMinutes" IS NULL OR t."preparationMinutes" IS NULL OR t."cleanupMinutes" IS NULL)
 AND (b."status"='IN_PROGRESS' OR (b."scheduledAt">=date_trunc('day',(${starts})::timestamp+interval '1 hour')-interval '1 hour'
 AND b."scheduledAt"<date_trunc('day',(${ends})::timestamp+interval '1 hour')+interval '23 hours'))))`;
}
export function openSlotConflictSelect(
  staffId: string,
  startsAt: Date,
  endsAt: Date,
  excludeSlotId: string | null,
) {
  return Prisma.sql`SELECT 1 FROM "BookingSlot" os JOIN "Service" sv ON sv."id"=os."serviceId"
 WHERE os."staffId"=${staffId}::uuid AND os."status"='OPEN'
 AND (${excludeSlotId}::uuid IS NULL OR os."id"<>${excludeSlotId}::uuid)
 AND ((sv."isActive" AND os."serviceTimingVersion"=sv."timingVersion"
 AND os."durationMinutes"=sv."durationMinutes" AND os."preparationMinutes"=sv."preparationMinutes" AND os."cleanupMinutes"=sv."cleanupMinutes"
 AND os."startsAt"-make_interval(mins=>os."preparationMinutes") < ${endsAt}
 AND os."endsAt"+make_interval(mins=>os."cleanupMinutes") > ${startsAt})
 -- Even a stale open offer must be explicitly withdrawn before publishing an
 -- overlapping replacement; this matches the retained database publication guard.
 OR (os."startsAt" < ${endsAt} AND os."endsAt" > ${startsAt}))`;
}
