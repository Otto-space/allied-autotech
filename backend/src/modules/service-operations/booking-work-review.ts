import { currentWorkEstimate, type WorkReviewBooking } from "./booking-work-estimate.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { BookingWorkReviewInput } from "./service-operations.schemas.js";
import { captureBookingTiming } from "./booking-timing.js";
import {
  approvedWorkshopResources,
  findApprovedWorkshopResources,
} from "./booking-resources.js";
import { assertSlotCalendar, technicianConflictSelect } from "./booking-slot-timing.js";
import { eligibleWorkshopTechnicianWhere } from "./workshop-technician-eligibility.js";
import { validateWorkshopResourceReferences } from "../policies/workshop-resource-policy.js";
import {
  selectWorkshopResources,
  resourceWindowAvailable,
  workshopResourceSettingsSchema,
} from "./workshop-resources.js";
import {
  workshopResourceAvailabilitySelect,
  type WorkshopResourceAvailability,
} from "./booking-resource-availability.js";
import {
  serviceOperationConflict,
  staleServiceOperation,
} from "./service-operations.errors.js";

function assertStarted(booking: WorkReviewBooking, now: Date) {
  if (
    !["CONFIRMED", "IN_PROGRESS"].includes(booking.status) ||
    !booking.startedAt ||
    booking.startedAt > now ||
    !booking.branchId ||
    !booking.serviceId ||
    !booking.assignedStaffId
  )
    throw serviceOperationConflict(
      "Review only an assessed, assigned job with a recorded work start. This action does not start or complete work.",
    );
  return {
    branchId: booking.branchId,
    serviceId: booking.serviceId,
    staffId: booking.assignedStaffId,
    startedAt: booking.startedAt,
  };
}
async function assessedPlan(
  tx: Prisma.TransactionClient,
  booking: WorkReviewBooking,
  now: Date,
) {
  const identity = assertStarted(booking, now),
    plan = await approvedWorkshopResources(tx, identity.branchId);
  if (
    !plan.settings.services.some((s) => s.serviceId === identity.serviceId) ||
    !plan.settings.technicians.some(
      (t) => t.staffId === identity.staffId && t.serviceIds.includes(identity.serviceId),
    ) ||
    !(await tx.staffProfile.count({
      where: {
        AND: [
          { id: identity.staffId },
          eligibleWorkshopTechnicianWhere(identity.branchId, now),
        ],
      },
    }))
  )
    throw serviceOperationConflict(
      "The job's actual service and technician need a current workshop assessment before review.",
    );
  return { ...identity, ...plan };
}
export async function bookingWorkReviewOptions(
  tx: Prisma.TransactionClient,
  booking: WorkReviewBooking,
  now = new Date(),
) {
  // An interactive transaction uses one database connection; keep reads ordered.
  const timing = await tx.bookingTimingSnapshot.findUnique({
    where: {
      bookingId_scheduleVersion: {
        bookingId: booking.id,
        scheduleVersion: booking.scheduleVersion,
      },
    },
    select: { cleanupMinutes: true },
  });
  const latest = await tx.bookingResourceAllocation.findFirst({
    where: { bookingId: booking.id },
    orderBy: { bookingVersion: "desc" },
  });
  const plan = booking.branchId
    ? await findApprovedWorkshopResources(tx, booking.branchId, now)
    : null;
  const requirements = plan?.settings.services.find(
    (s) => s.serviceId === booking.serviceId,
  )?.requirements;
  const actualTechnician =
    booking.branchId && booking.assignedStaffId
      ? await tx.staffProfile.count({
          where: {
            AND: [
              { id: booking.assignedStaffId },
              eligibleWorkshopTechnicianWhere(booking.branchId, now),
            ],
          },
        })
      : 0;
  const canReview = !!(
    plan &&
    requirements &&
    plan.settings.technicians.some(
      (t) =>
        t.staffId === booking.assignedStaffId &&
        t.serviceIds.includes(booking.serviceId ?? ""),
    ) &&
    actualTechnician &&
    ["CONFIRMED", "IN_PROGRESS"].includes(booking.status) &&
    booking.startedAt &&
    booking.startedAt <= now &&
    booking.serviceId &&
    booking.branchId &&
    booking.assignedStaffId
  );
  const latestEstimate = latest ? currentWorkEstimate(booking, [latest]) : null;
  const savedPolicy =
    latestEstimate && latest
      ? await tx.businessPolicyVersion.findUnique({
          where: { id: latest.policyVersionId },
          select: { settings: true },
        })
      : null;
  const savedPlan = workshopResourceSettingsSchema.safeParse(savedPolicy?.settings);
  const resourceNames =
    latest && savedPlan.success
      ? latest.resourceIds.flatMap((id) => {
          const unit = savedPlan.data.resources.find(
            (r) => r.id.toLowerCase() === id.toLowerCase(),
          );
          return unit ? [unit.name] : [];
        })
      : [];
  return {
    bookingId: booking.id,
    version: booking.version,
    scheduleVersion: booking.scheduleVersion,
    status: booking.status,
    branchId: booking.branchId,
    serviceId: booking.serviceId,
    staffId: booking.assignedStaffId,
    startedAt: booking.startedAt,
    canReview,
    resourcePolicyVersionId: canReview ? plan!.policy.id : null,
    cleanupMinutes:
      latestEstimate && latest ? latest.cleanupMinutes : (timing?.cleanupMinutes ?? null),
    requirements: canReview ? requirements! : [],
    resources: canReview
      ? plan!.settings.resources.map((r) => ({
          id: r.id,
          name: r.name,
          kind: r.kind,
          status: r.status,
          pools: r.pools,
        }))
      : [],
    current:
      latest && latestEstimate
        ? {
            id: latest.id,
            bookingVersion: latest.bookingVersion,
            resourcePolicyVersionId: latest.policyVersionId,
            reviewedAt: latest.workReviewedAt,
            remainingMinutes: latest.remainingMinutes,
            cleanupMinutes: latest.cleanupMinutes,
            expectedWorkEndsAt: latest.expectedWorkEndsAt,
            resourceIds: latest.resourceIds,
            resourceNames,
            reason: latest.reason,
            performedByUserId: latest.createdByUserId,
          }
        : null,
  };
}

/** Caller holds workforce/access/booking locks and checks BOOKING_CONFIRM and scope
 * before and after this transaction. A review neither changes the visit nor pays. */
export async function reviewStartedBookingWork(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  booking: WorkReviewBooking,
  input: BookingWorkReviewInput,
  now = new Date(),
) {
  if (booking.version !== input.expectedVersion) throw staleServiceOperation();
  const plan = await assessedPlan(tx, booking, now);
  if (plan.policy.id !== input.resourcePolicyVersionId)
    throw serviceOperationConflict(
      "The approved resource plan changed. Refresh the job and review its current equipment or space.",
    );
  await validateWorkshopResourceReferences(tx, actor, plan.branchId, {
    ...plan.settings,
    services: plan.settings.services.filter((s) => s.serviceId === plan.serviceId),
    technicians: plan.settings.technicians.filter((t) => t.staffId === plan.staffId),
  });
  const expectedWorkEndsAt = new Date(now.getTime() + input.remainingMinutes * 60000),
    endsAt = new Date(expectedWorkEndsAt.getTime() + input.cleanupMinutes * 60000);
  await assertSlotCalendar(tx, plan.branchId, now, endsAt, booking.id);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${plan.staffId}`},0))`;
  const [technician] = await tx.$queryRaw<{ exists: boolean }[]>(
    Prisma.sql`SELECT EXISTS (${technicianConflictSelect(Prisma.sql`${plan.staffId}::uuid`, Prisma.sql`${now}::timestamp`, Prisma.sql`${endsAt}::timestamp`, Prisma.sql`${booking.id}::uuid`)}) AS "exists"`,
  );
  if (technician?.exists)
    throw serviceOperationConflict(
      "The remaining work conflicts with this technician's existing appointments. No other appointment was displaced.",
    );
  for (const id of plan.settings.resources.map((r) => r.id).sort())
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`workshop-resource:${id}`},0))`;
  const needsResources =
    plan.settings.services.find((s) => s.serviceId === plan.serviceId)!.requirements
      .length > 0 || input.resourceIds.length > 0;
  const [availability] = needsResources
    ? await tx.$queryRaw<WorkshopResourceAvailability[]>(
        workshopResourceAvailabilitySelect(
          Prisma.sql`${plan.branchId}::uuid`,
          Prisma.sql`${now}::timestamp`,
          Prisma.sql`${endsAt}::timestamp`,
          Prisma.sql`${booking.id}::uuid`,
        ),
      )
    : [{ legacyUnassessed: false, busyResourceIds: [] }];
  if (!availability || availability.legacyUnassessed)
    throw serviceOperationConflict(
      "Existing work needs a resource assessment before this review can reserve equipment or space.",
    );
  const chosen = new Set(input.resourceIds.map((id) => id.toLowerCase())),
    busy = new Set(availability.busyResourceIds.map((id) => id.toLowerCase()));
  for (const unit of plan.settings.resources) if (!chosen.has(unit.id)) busy.add(unit.id);
  const selected = selectWorkshopResources(plan.settings, {
    serviceId: plan.serviceId,
    staffId: plan.staffId,
    startsAt: now,
    endsAt,
    busyResourceIds: busy,
  });
  if (
    !selected.ok ||
    selected.resourceIds.some((id) => !chosen.has(id)) ||
    [...chosen].some((id) => {
      const unit = plan.settings.resources.find((r) => r.id === id);
      return (
        !unit ||
        unit.status !== "AVAILABLE" ||
        availability.busyResourceIds.includes(id) ||
        !resourceWindowAvailable(unit, now, endsAt)
      );
    })
  )
    throw serviceOperationConflict(
      "Choose the required distinct equipment and spaces from the approved plan. Additional units must also be approved and available for the full remaining work and cleanup period.",
    );
  const timing = await captureBookingTiming(tx, booking, actor.userId, true);
  const changed = await tx.booking.updateMany({
    where: { id: booking.id, version: input.expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (changed.count !== 1) throw staleServiceOperation();
  return tx.bookingResourceAllocation.create({
    data: {
      bookingId: booking.id,
      bookingVersion: booking.version + 1,
      scheduleVersion: booking.scheduleVersion,
      branchId: plan.branchId,
      serviceId: plan.serviceId,
      staffId: plan.staffId,
      scheduledAt: booking.scheduledAt,
      startsAt: now,
      endsAt,
      resourceIds: [...chosen].sort(),
      timingSnapshotId: timing.id,
      policyVersionId: plan.policy.id,
      reason: input.reason,
      createdByUserId: actor.userId,
      workReviewedAt: now,
      workStartedAt: plan.startedAt,
      remainingMinutes: input.remainingMinutes,
      cleanupMinutes: input.cleanupMinutes,
      expectedWorkEndsAt,
    },
  });
}
