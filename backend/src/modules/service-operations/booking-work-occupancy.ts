import { Prisma } from "../../generated/prisma/client.js";

/** Queries bind Booking as b. A recorded start is authoritative even when an
 * older confirmed record has not completed its operational status transition. */
export const unfinishedBookingWork = Prisma.sql`(b."status"='IN_PROGRESS' OR (b."status"='CONFIRMED' AND b."startedAt" IS NOT NULL))`;
