import { currentWorkEstimate } from "./booking-work-estimate.js";
import { eligibleWorkshopTechnicianWhere } from "./workshop-technician-eligibility.js";
import {
  workshopResourceAvailabilitySelect,
  type WorkshopResourceAvailability,
} from "./booking-resource-availability.js";
import { technicianConflictSelect } from "./booking-slot-timing.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { Prisma } from "../../generated/prisma/client.js";
import { validateWorkshopResourceReferences } from "../policies/workshop-resource-policy.js";
import { timingWindow } from "./booking-timing.js";
import {
  selectWorkshopResources,
  resourceWindowAvailable,
  workshopResourceSettingsSchema,
} from "./workshop-resources.js";
import {
  scheduleConflict,
  serviceOperationConflict,
} from "./service-operations.errors.js";

export async function findApprovedWorkshopResources(
  tx: Prisma.TransactionClient,
  branchId: string,
  now = new Date(),
) {
  const policy = await tx.businessPolicyVersion.findFirst({
    where: { key: `booking-resources:${branchId}`, effectiveAt: { lte: now } },
    orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
  });
  const parsed = workshopResourceSettingsSchema.safeParse(policy?.settings);
  if (!policy || policy.approvalStatus !== "APPROVED" || !parsed.success) return null;
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

export async function approvedWorkshopResources(
  tx: Prisma.TransactionClient,
  branchId: string,
) {
  const plan = await findApprovedWorkshopResources(tx, branchId);
  if (!plan)
    throw serviceOperationConflict(
      "Approved workshop resources are not configured. The owner must review actual technicians, equipment, shared spaces and working periods before confirmation.",
    );
  return plan;
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
  const latest = await tx.bookingResourceAllocation.findFirst({
    where: { bookingId },
    orderBy: { bookingVersion: "desc" },
  });
  const workReview = latest && currentWorkEstimate(booking, [latest]) ? latest : null;
  if (workReview && workReview.endsAt <= new Date())
    throw serviceOperationConflict(
      "Review the remaining work again before changing its operational status; its earlier estimate has elapsed.",
    );
  const planned = workReview
    ? { startsAt: workReview.startsAt, endsAt: workReview.endsAt }
    : timingWindow(booking.scheduledAt, timing);
  const startsAt = workReview
    ? planned.startsAt
    : new Date(
        Math.min(planned.startsAt.getTime(), booking.startedAt?.getTime() ?? Infinity),
      );
  const endsAt = workReview
    ? planned.endsAt
    : new Date(
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
      .length ?? 0) > 0 || (workReview?.resourceIds.length ?? 0) > 0;
  // Lock all candidate identities in stable global order, including units shared
  // between branch plans. Other bookings cannot select the last unit concurrently.
  for (const id of settings.resources.map((row) => row.id).sort())
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`workshop-resource:${id}`},0))`;
  const [availability] = needsResources
    ? await tx.$queryRaw<WorkshopResourceAvailability[]>(
        workshopResourceAvailabilitySelect(
          Prisma.sql`${booking.branchId}::uuid`,
          Prisma.sql`${startsAt}::timestamp`,
          Prisma.sql`${endsAt}::timestamp`,
          Prisma.sql`${bookingId}::uuid`,
        ),
      )
    : [{ legacyUnassessed: false, busyResourceIds: [] }];
  if (!availability || availability.legacyUnassessed)
    throw serviceOperationConflict(
      "Review resource allocations for existing work in this period before confirming another appointment. No existing appointment was displaced.",
    );
  const prior =
    workReview ??
    (await tx.bookingResourceAllocation.findUnique({
      where: { bookingId_bookingVersion: { bookingId, bookingVersion: booking.version } },
    }));
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
  const busy = new Set(availability.busyResourceIds.map((id) => id.toLowerCase()));
  if (
    workReview &&
    workReview.resourceIds.some((id) => {
      const unit = settings.resources.find((r) => r.id === id);
      return (
        !unit ||
        unit.status !== "AVAILABLE" ||
        busy.has(id) ||
        !resourceWindowAvailable(unit, startsAt, endsAt)
      );
    })
  )
    throw serviceOperationConflict(
      "A reviewed physical unit is no longer available. Review the remaining work before changing its status.",
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

/** Recheck a selected offer without reserving a unit or changing another booking. */
export async function assertOfferedWorkshopResources(
  tx: Prisma.TransactionClient,
  input: {
    branchId: string;
    serviceId: string;
    staffId: string;
    startsAt: Date;
    endsAt: Date;
    excludeBookingId?: string | null;
  },
) {
  const { settings } = await approvedWorkshopResources(tx, input.branchId);
  if (
    !(await tx.staffProfile.count({
      where: {
        AND: [
          { id: input.staffId },
          eligibleWorkshopTechnicianWhere(input.branchId, new Date()),
        ],
      },
    }))
  )
    throw scheduleConflict();
  const needsResources =
    (settings.services.find((row) => row.serviceId === input.serviceId)?.requirements
      .length ?? 0) > 0;
  const [availability] = needsResources
    ? await tx.$queryRaw<WorkshopResourceAvailability[]>(
        workshopResourceAvailabilitySelect(
          Prisma.sql`${input.branchId}::uuid`,
          Prisma.sql`${input.startsAt}::timestamp`,
          Prisma.sql`${input.endsAt}::timestamp`,
          Prisma.sql`${input.excludeBookingId ?? null}::uuid`,
        ),
      )
    : [{ legacyUnassessed: false, busyResourceIds: [] }];
  if (
    !availability ||
    availability.legacyUnassessed ||
    !selectWorkshopResources(settings, {
      serviceId: input.serviceId,
      staffId: input.staffId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      busyResourceIds: new Set(
        availability.busyResourceIds.map((id) => id.toLowerCase()),
      ),
    }).ok
  )
    throw scheduleConflict();
}
