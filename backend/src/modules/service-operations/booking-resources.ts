import { technicianConflictSelect } from "./booking-slot-timing.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { Prisma } from "../../generated/prisma/client.js";
import { validateWorkshopResourceReferences } from "../policies/workshop-resource-policy.js";
import { timingWindow } from "./booking-timing.js";
import {
  selectWorkshopResources,
  workshopResourceSettingsSchema,
} from "./workshop-resources.js";
import { serviceOperationConflict } from "./service-operations.errors.js";

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

export async function approvedWorkshopResources(
  tx: Prisma.TransactionClient,
  branchId: string,
) {
  const policy = await tx.businessPolicyVersion.findFirst({
    where: { key: `booking-resources:${branchId}`, effectiveAt: { lte: new Date() } },
    orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
  });
  const parsed = workshopResourceSettingsSchema.safeParse(policy?.settings);
  if (!policy || policy.approvalStatus !== "APPROVED" || !parsed.success)
    throw serviceOperationConflict(
      "Approved workshop resources are not configured. The owner must review actual technicians, equipment, shared spaces and working periods before confirmation.",
    );
  // UUIDs are case-insensitive database identities, including in historical policies.
  const settings = parsed.data;
  settings.resources.forEach((row) => {
    row.id = row.id.toLowerCase();
  });
  settings.services.forEach((row) => {
    row.serviceId = row.serviceId.toLowerCase();
  });
  settings.technicians.forEach((row) => {
    row.staffId = row.staffId.toLowerCase();
    row.serviceIds = row.serviceIds.map((id) => id.toLowerCase());
  });
  return { policy, settings };
}

/** Caller holds the booking row and existing workforce lock. No public DTO includes this history. */
export async function allocateBookingResources(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  bookingId: string,
  reason: string,
) {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: {
      id: true,
      branchId: true,
      serviceId: true,
      assignedStaffId: true,
      scheduledAt: true,
      version: true,
      scheduleVersion: true,
      status: true,
      startedAt: true,
    },
  });
  if (!["CONFIRMED", "IN_PROGRESS"].includes(booking.status)) return null;
  if (!booking.branchId || !booking.serviceId || !booking.assignedStaffId)
    throw serviceOperationConflict(
      "Assess the service, branch and actual technician before reserving workshop resources",
    );
  if (reason.trim().length < 10)
    throw serviceOperationConflict("Record the resource-review reason");
  const timing = await tx.bookingTimingSnapshot.findUnique({
    where: {
      bookingId_scheduleVersion: { bookingId, scheduleVersion: booking.scheduleVersion },
    },
  });
  if (
    !timing ||
    timing.serviceId !== booking.serviceId ||
    timing.scheduledAt.getTime() !== booking.scheduledAt.getTime()
  )
    throw serviceOperationConflict(
      "Review this appointment's saved timing before reserving resources",
    );
  const planned = timingWindow(booking.scheduledAt, timing);
  const startsAt = new Date(
    Math.min(planned.startsAt.getTime(), booking.startedAt?.getTime() ?? Infinity),
  );
  const endsAt = new Date(
    Math.max(
      planned.endsAt.getTime(),
      booking.startedAt
        ? booking.startedAt.getTime() +
            (timing.durationMinutes! + timing.cleanupMinutes!) * 60000
        : -Infinity,
    ),
  );
  const { policy, settings } = await approvedWorkshopResources(tx, booking.branchId);
  await validateWorkshopResourceReferences(tx, actor, booking.branchId, {
    ...settings,
    services: settings.services.filter((row) => row.serviceId === booking.serviceId),
    technicians: settings.technicians.filter(
      (row) => row.staffId === booking.assignedStaffId,
    ),
  });
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${booking.assignedStaffId}`},0))`;
  const technicianBusy = await tx.$queryRaw<Array<{ exists: boolean }>>(
    Prisma.sql`SELECT EXISTS (${technicianConflictSelect(Prisma.sql`${booking.assignedStaffId}::uuid`, Prisma.sql`${startsAt}::timestamp`, Prisma.sql`${endsAt}::timestamp`, Prisma.sql`${bookingId}::uuid`)}) AS "exists"`,
  );
  if (technicianBusy[0]?.exists)
    throw serviceOperationConflict(
      "This technician has another appointment or unfinished work in this period",
    );
  const needsResources =
    (settings.services.find((row) => row.serviceId === booking.serviceId)?.requirements
      .length ?? 0) > 0;
  // Lock all candidate identities in stable global order, including units shared
  // between branch plans. Other bookings cannot select the last unit concurrently.
  for (const id of settings.resources.map((row) => row.id).sort())
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`workshop-resource:${id}`},0))`;
  const legacy = needsResources
    ? await tx.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`SELECT EXISTS (
 SELECT 1 FROM "Booking" b LEFT JOIN "BookingTimingSnapshot" t ON t."bookingId"=b."id" AND t."scheduleVersion"=b."scheduleVersion"
 WHERE b."id"<>${bookingId}::uuid AND b."branchId"=${booking.branchId}::uuid AND b."status" IN ('CONFIRMED','IN_PROGRESS')
 AND NOT EXISTS(SELECT 1 FROM "BookingResourceAllocation" a WHERE ${currentAllocation})
 AND ((t."durationMinutes" IS NOT NULL AND t."preparationMinutes" IS NOT NULL AND t."cleanupMinutes" IS NOT NULL
 AND b."scheduledAt"-make_interval(mins=>t."preparationMinutes")<${endsAt}
 AND (CASE WHEN b."status"='IN_PROGRESS' AND b."scheduledAt"+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes")<=timezone('UTC',now()) THEN 'infinity'::timestamp ELSE b."scheduledAt"+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes") END)>${startsAt})
 OR ((t."durationMinutes" IS NULL OR t."preparationMinutes" IS NULL OR t."cleanupMinutes" IS NULL)
 AND (b."status"='IN_PROGRESS' OR (b."scheduledAt">=date_trunc('day',${startsAt}::timestamp+interval '1 hour')-interval '1 hour'
 AND b."scheduledAt"<date_trunc('day',${endsAt}::timestamp+interval '1 hour')+interval '23 hours'))))) AS "exists"`)
    : [{ exists: false }];
  if (legacy[0]?.exists)
    throw serviceOperationConflict(
      "Review resource allocations for existing work in this period before confirming another appointment. No existing appointment was displaced.",
    );
  const rows = needsResources
    ? await tx.$queryRaw<
        Array<{ resourceIds: string[] }>
      >(Prisma.sql`SELECT a."resourceIds" FROM "BookingResourceAllocation" a JOIN "Booking" b ON ${currentAllocation}
 JOIN "BookingTimingSnapshot" t ON t."id"=a."timingSnapshotId"
 WHERE b."id"<>${bookingId}::uuid AND ${occupying} AND a."startsAt"<${endsAt} AND (${effectiveEnd})>${startsAt}`)
    : ([] as Array<{ resourceIds: string[] }>);
  const prior = await tx.bookingResourceAllocation.findUnique({
    where: { bookingId_bookingVersion: { bookingId, bookingVersion: booking.version } },
  });
  if (
    prior &&
    (prior.policyVersionId !== policy.id ||
      prior.scheduleVersion !== booking.scheduleVersion ||
      prior.staffId !== booking.assignedStaffId ||
      prior.branchId !== booking.branchId ||
      prior.serviceId !== booking.serviceId ||
      prior.scheduledAt.getTime() !== booking.scheduledAt.getTime() ||
      prior.timingSnapshotId !== timing.id)
  )
    throw serviceOperationConflict(
      "The resource review changed; review the current appointment revision",
    );
  const busy = new Set(
    rows.flatMap((row) => row.resourceIds.map((id) => id.toLowerCase())),
  );
  if (prior)
    for (const unit of settings.resources)
      if (!prior.resourceIds.includes(unit.id)) busy.add(unit.id);
  const selected = selectWorkshopResources(settings, {
    serviceId: booking.serviceId,
    staffId: booking.assignedStaffId,
    startsAt,
    endsAt,
    busyResourceIds: busy,
  });
  if (!selected.ok)
    throw serviceOperationConflict(
      {
        SERVICE_UNASSESSED:
          "Review this service's required resources in the approved branch plan",
        TECHNICIAN_INELIGIBLE:
          "This technician is not approved for this service in the branch resource plan",
        TECHNICIAN_UNAVAILABLE:
          "The technician's working period or recorded absence does not allow this appointment",
        RESOURCE_UNAVAILABLE:
          "Required equipment or shared space is unavailable for the full appointment period",
      }[selected.reason],
    );
  if (prior) return prior;
  return tx.bookingResourceAllocation.create({
    data: {
      bookingId,
      bookingVersion: booking.version,
      scheduleVersion: booking.scheduleVersion,
      branchId: booking.branchId,
      serviceId: booking.serviceId,
      staffId: booking.assignedStaffId,
      scheduledAt: booking.scheduledAt,
      startsAt,
      endsAt,
      resourceIds: selected.resourceIds,
      timingSnapshotId: timing.id,
      policyVersionId: policy.id,
      reason,
      createdByUserId: actor.userId,
    },
  });
}
