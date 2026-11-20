import { Prisma } from "../../generated/prisma/client.js";

/** Queries bind Booking as b. A recorded start is authoritative even when an
 * older confirmed record has not completed its operational status transition. */
export const unfinishedBookingWork = Prisma.sql`(b."status"='IN_PROGRESS' OR (b."status"='CONFIRMED' AND b."startedAt" IS NOT NULL))`;

/** Latest identity-bound review only; an older allocation never revives. */
export const currentBookingWorkReviewJoin = Prisma.sql`LEFT JOIN LATERAL (SELECT a."id",a."endsAt",a."cleanupMinutes" FROM "BookingResourceAllocation" a WHERE a."bookingId"=b."id" AND a."bookingVersion"=(SELECT max(h."bookingVersion") FROM "BookingResourceAllocation" h WHERE h."bookingId"=b."id") AND a."scheduleVersion"=b."scheduleVersion" AND a."branchId"=b."branchId" AND a."serviceId"=b."serviceId" AND a."staffId"=b."assignedStaffId" AND a."scheduledAt"=b."scheduledAt" AND a."workReviewedAt" IS NOT NULL AND a."workStartedAt"=b."startedAt") wr ON TRUE`;
