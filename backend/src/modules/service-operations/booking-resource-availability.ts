import { Prisma } from "../../generated/prisma/client.js";

/** Latest decision only: returning to an earlier technician never revives an old allocation. */
const currentAllocation = Prisma.sql`a."bookingId"=b."id" AND a."bookingVersion"=(SELECT max(h."bookingVersion") FROM "BookingResourceAllocation" h WHERE h."bookingId"=b."id")
 AND a."scheduleVersion"=b."scheduleVersion" AND a."branchId"=b."branchId" AND a."serviceId"=b."serviceId"
 AND a."staffId"=b."assignedStaffId" AND a."scheduledAt"=b."scheduledAt"`;
const effectiveEnd = Prisma.sql`CASE
 WHEN b."status"='IN_PROGRESS' AND a."endsAt"<=timezone('UTC',now()) THEN 'infinity'::timestamp
 WHEN b."status"='COMPLETED' AND b."completedAt" IS NOT NULL THEN b."completedAt"+make_interval(mins=>t."cleanupMinutes")
 WHEN b."status"='CANCELLED' AND b."startedAt" IS NOT NULL AND b."cancelledAt" IS NOT NULL THEN b."cancelledAt"+make_interval(mins=>t."cleanupMinutes")
 ELSE a."endsAt" END`;
const occupying = Prisma.sql`(b."status" IN ('CONFIRMED','IN_PROGRESS','COMPLETED') OR (b."status"='CANCELLED' AND b."startedAt" IS NOT NULL))`;

/** One occupancy definition for offered times and atomic confirmation. No public
 * response includes these identities or the existence/details of another job. */
export function workshopResourceAvailabilitySelect(
  branchId: Prisma.Sql,
  startsAt: Prisma.Sql,
  endsAt: Prisma.Sql,
  excludeBookingId: Prisma.Sql = Prisma.sql`NULL::uuid`,
) {
  return Prisma.sql`SELECT EXISTS (
 SELECT 1 FROM "Booking" b LEFT JOIN "BookingTimingSnapshot" t ON t."bookingId"=b."id" AND t."scheduleVersion"=b."scheduleVersion"
 WHERE (${excludeBookingId} IS NULL OR b."id"<>${excludeBookingId}) AND b."branchId"=${branchId} AND b."status" IN ('CONFIRMED','IN_PROGRESS')
 AND NOT EXISTS(SELECT 1 FROM "BookingResourceAllocation" a WHERE ${currentAllocation})
 AND ((t."durationMinutes" IS NOT NULL AND t."preparationMinutes" IS NOT NULL AND t."cleanupMinutes" IS NOT NULL
 AND b."scheduledAt"-make_interval(mins=>t."preparationMinutes")<${endsAt}
 AND (CASE WHEN b."status"='IN_PROGRESS' AND b."scheduledAt"+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes")<=timezone('UTC',now()) THEN 'infinity'::timestamp ELSE b."scheduledAt"+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes") END)>${startsAt})
 OR ((t."durationMinutes" IS NULL OR t."preparationMinutes" IS NULL OR t."cleanupMinutes" IS NULL)
 AND (b."status"='IN_PROGRESS' OR (b."scheduledAt">=date_trunc('day',(${startsAt})::timestamp+interval '1 hour')-interval '1 hour'
 AND b."scheduledAt"<date_trunc('day',(${endsAt})::timestamp+interval '1 hour')+interval '23 hours'))))) AS "legacyUnassessed",
 ARRAY(SELECT DISTINCT unnest(a."resourceIds") FROM "BookingResourceAllocation" a JOIN "Booking" b ON ${currentAllocation}
 JOIN "BookingTimingSnapshot" t ON t."id"=a."timingSnapshotId"
 WHERE (${excludeBookingId} IS NULL OR b."id"<>${excludeBookingId}) AND ${occupying} AND a."startsAt"<${endsAt} AND (${effectiveEnd})>${startsAt}) AS "busyResourceIds"`;
}
export type WorkshopResourceAvailability = {
  legacyUnassessed: boolean;
  busyResourceIds: string[];
};
