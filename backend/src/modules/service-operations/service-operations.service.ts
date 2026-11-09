import {
  agreedServiceWork,
  assertAgreedMaterialsReady,
  assertAgreedWorkCanProceed,
  assertAgreedWorkScope,
  priceAgreedWorkInputs,
} from "./agreed-service-work.js";
import {
  attendanceSnapshot,
  attendancePolicy,
  assertAttendanceAction,
  attendanceDigest,
  attendanceEventSelect,
  type BookingAttendanceInput,
} from "./booking-attendance.js";
import {
  bookingWithWorkEstimate,
  currentWorkEstimate,
  type WorkReviewBooking,
  type EstimateAllocation,
} from "./booking-work-estimate.js";
import {
  bookingWorkReviewOptions,
  reviewStartedBookingWork,
} from "./booking-work-review.js";
import type { BookingWorkReviewInput } from "./service-operations.schemas.js";
import {
  allocateBookingResources,
  findApprovedWorkshopResources,
  assertOfferedWorkshopResources,
} from "./booking-resources.js";
import { eligibleWorkshopTechnicianWhere } from "./workshop-technician-eligibility.js";
import {
  assertCurrentSlotTiming,
  assertSlotCalendar,
  openSlotConflictSelect,
  slotTimingIsCurrent,
} from "./booking-slot-timing.js";
import { capacitySettingsSchema } from "./booking-capacity.js";
import { Prisma as PrismaSql } from "../../generated/prisma/client.js";
import {
  assignmentTimingWindow,
  assertPublishedSlotAssignment,
  captureAssessedTimingIfMissing,
} from "./booking-timing.js";
import type { BookingTimingOverrideInput } from "./service-operations.schemas.js";
import {
  captureBookingTiming,
  carryBookingTiming,
  bookedJobMinutes,
  preserveExistingBookingTiming,
  timingWindow,
} from "./booking-timing.js";
import {
  assertOriginalAppointment,
  createPendingReschedule,
} from "./booking-reschedule.js";
import type {
  BookingRescheduleDecisionInput,
  BookingRescheduleWithdrawInput,
} from "./service-operations.schemas.js";
import { publicServiceCopy } from "./public-service-copy.js";
import type {
  BookingAlternativeInput,
  BookingAlternativeResponseInput,
} from "./service-operations.schemas.js";
import { basisPoints } from "../policies/policy-money.js";
import { quotationTerms } from "../policies/quotation-terms.js";
import {
  approvedPolicy,
  policySnapshot,
  assertCapability,
  assertFinanceGate,
} from "../policies/policies.service.js";
import { assertBookingCapacity } from "./booking-capacity.js";
import { lockWorkforce } from "../organization/workforce-access.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import {
  bookingScope,
  bookingSnapshotAllowed,
  branchesFor,
  workforceSnapshot,
  workforceDenied,
  workforceNotFound,
} from "../organization/workforce.policy.js";
import { createHash, randomUUID } from "node:crypto";

import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { hashToken } from "../../common/security/session-tokens.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { BookingStatus, WorkOrderStatus } from "../../generated/prisma/enums.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import {
  invalidServiceTransition,
  scheduleConflict,
  serviceOperationConflict,
  serviceOperationForbidden,
  serviceOperationNotFound,
  staleServiceOperation,
} from "./service-operations.errors.js";
import {
  assertCustomerActor,
  assertPrivilegedActor,
  assertServiceAdministrator,
} from "./service-operations.policy.js";
import { ServiceOperationsRepository } from "./service-operations.repository.js";
import type {
  AdminServiceListQuery,
  BookingAssignmentInput,
  BookingCancelInput,
  BookingCreateInput,
  BookingDisruptionInput,
  BookingDisruptionResolutionInput,
  BookingRescheduleInput,
  BookingSlotCreateInput,
  BookingSlotUpdateInput,
  BookingTransitionInput,
  CustomerBookingListQuery,
  PublicServiceListQuery,
  PublicBookingSlotListQuery,
  QuoteCreateInput,
  QuoteReplaceInput,
  QuoteTransitionInput,
  ServiceCreateInput,
  ServiceLineItemInput,
  ServiceUpdateInput,
  StaffBookingListQuery,
  StaffBookingSlotListQuery,
  WorkOrderCreateInput,
  WorkOrderTransitionInput,
  WorkOrderUpdateInput,
} from "./service-operations.schemas.js";
import { page, type PricedLine } from "./service-operations.types.js";

const activeBookingStatuses: readonly BookingStatus[] = [
  "REQUESTED",
  "AWAITING_DEPOSIT",
  "CONFIRMED",
  "IN_PROGRESS",
];
const bookingTransitions: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  AWAITING_DEPOSIT: ["CANCELLED", "EXPIRED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  EXPIRED: [],
};
const workTransitions: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["AWAITING_PARTS", "QUALITY_CHECK", "CANCELLED"],
  AWAITING_PARTS: ["IN_PROGRESS", "CANCELLED"],
  QUALITY_CHECK: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, jsonSafe(child)]),
    );
  }
  return value;
}

function customerSafeBooking<
  T extends WorkReviewBooking & {
    resourceAllocations?: EstimateAllocation[];
    staffNotes: unknown;
    scheduleVersion: number;
    timingSnapshots: Array<{ scheduleVersion: number; durationMinutes: number | null }>;
    bookingSlot?: Awaited<ReturnType<ServiceOperationsRepository["bookingSlot"]>>;
    service: null | {
      description: string | null;
      shortDescription: string | null;
      durationMinutes: number | null;
      timingVersion?: number;
      preparationMinutes: number | null;
      cleanupMinutes: number | null;
    };
    workOrder: null | { internalNotes: unknown };
    depositPayment: null | { settledAttemptId: unknown };
    quotes: Array<{ status: string; issuedAt: Date | null }>;
  },
>(booking: T) {
  const {
    staffNotes: _staffNotes,
    resourceAllocations,
    timingSnapshots,
    workOrder,
    depositPayment,
    ...safe
  } = booking;
  const timing = timingSnapshots.find(
    (row) => row.scheduleVersion === booking.scheduleVersion,
  );
  const safeService = booking.service
    ? (() => {
        const {
          timingVersion: _timingVersion,
          preparationMinutes: _preparation,
          cleanupMinutes: _cleanup,
          ...service
        } = booking.service;
        return {
          ...service,
          durationMinutes: timing ? timing.durationMinutes : service.durationMinutes,
        };
      })()
    : null;
  const safeSlot = booking.bookingSlot
    ? (() => {
        const {
          durationMinutes: _slotDuration,
          preparationMinutes: _slotPreparation,
          cleanupMinutes: _slotCleanup,
          serviceTimingVersion: _slotRevision,
          service: slotService,
          ...slot
        } = booking.bookingSlot!;
        const {
          timingVersion: _serviceRevision,
          preparationMinutes: _preparation,
          cleanupMinutes: _cleanup,
          ...service
        } = slotService;
        return {
          ...slot,
          service: {
            ...service,
            durationMinutes: safeService?.durationMinutes ?? null,
            description: publicServiceCopy(service.description),
            shortDescription: publicServiceCopy(service.shortDescription),
          },
        };
      })()
    : booking.bookingSlot;
  return {
    ...safe,
    workEstimate: currentWorkEstimate(booking, resourceAllocations ?? []),
    bookingSlot: safeSlot,
    service:
      safeService === null
        ? null
        : {
            ...safeService,
            description: publicServiceCopy(safeService.description),
            shortDescription: publicServiceCopy(safeService.shortDescription),
          },
    quotes: booking.quotes.filter(
      (quote) => quote.status !== "DRAFT" && quote.issuedAt !== null,
    ),
    depositPayment:
      depositPayment === null
        ? null
        : (() => {
            const { settledAttemptId: _settledAttemptId, ...safePayment } =
              depositPayment;
            return safePayment;
          })(),
    workOrder:
      workOrder === null
        ? null
        : (() => {
            const { internalNotes: _internalNotes, ...safeWorkOrder } = workOrder;
            return safeWorkOrder;
          })(),
  };
}

function reference(prefix: "Q" | "WO"): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
}

export const bookingPolicy = Object.freeze({
  version: "owner-booking-request-v2",
  minimumAdvanceHours: 168,
  maximumAdvanceHours: 336,
  paymentHoldMinutes: 30,
  depositBasisPoints: 0,
  depositRefundableForCustomerCancellation: true,
  customerRescheduleLimit: 1,
  customerRescheduleCutoffHours: 24,
  reminderHoursBeforeAppointment: [1] as const,
});

const refundNumber = () =>
  `REF-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;

function bookingFingerprint(input: BookingCreateInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        ...(input.serviceCategoryId === undefined
          ? {}
          : { serviceCategoryId: input.serviceCategoryId }),
        slotId: input.slotId,
        ...(input.slotId === undefined
          ? {
              serviceId: input.serviceId,
              branchId: input.branchId,
              preferredAt: input.preferredAt,
            }
          : {}),
        vehicleId: input.vehicleId ?? null,
        customerNotes: input.customerNotes ?? null,
        policyVersion: input.policyVersion,
        acceptNonRefundableDeposit: input.acceptNonRefundableDeposit,
      }),
    )
    .digest("hex");
}

function bookingWindow(now = new Date()) {
  return {
    from: new Date(now.getTime() + bookingPolicy.minimumAdvanceHours * 3_600_000),
    to: new Date(now.getTime() + bookingPolicy.maximumAdvanceHours * 3_600_000),
  };
}

function assertWithinBookingWindow(startsAt: Date, now = new Date()): void {
  const window = bookingWindow(now);
  if (startsAt < window.from || startsAt > window.to)
    throw serviceOperationConflict(
      "Bookings must be scheduled between 7 and 14 days in advance",
    );
}

export async function cancelPendingReminders(
  transaction: Prisma.TransactionClient,
  bookingId: string,
): Promise<void> {
  await transaction.bookingReminder.updateMany({
    where: {
      bookingId,
      status: { in: ["PENDING", "PROCESSING", "FAILED"] },
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      lockedAt: null,
      nextAttemptAt: null,
    },
  });
}

// Preserve contributor history across the legacy-to-workforce cutover. Callers
// already hold the parent booking lock, shared by both operational paths.
async function recordWorkContributor(
  transaction: Prisma.TransactionClient,
  workOrderId: string,
  userId: string,
) {
  const work = await transaction.workOrder.findUniqueOrThrow({
    where: { id: workOrderId },
    select: { workedByUserIds: true },
  });
  if (!work.workedByUserIds.includes(userId))
    await transaction.workOrder.update({
      where: { id: workOrderId },
      data: { workedByUserIds: { push: userId } },
    });
}

export async function scheduleReminders(
  transaction: Prisma.TransactionClient,
  booking: { id: string; scheduledAt: Date; scheduleVersion: number },
): Promise<void> {
  const definitions = [["ONE_HOUR", 1]] as const;
  const now = Date.now();
  const reminders = definitions
    .map(([kind, hours]) => ({
      bookingId: booking.id,
      kind,
      scheduledFor: new Date(booking.scheduledAt.getTime() - hours * 3_600_000),
      scheduleVersion: booking.scheduleVersion,
    }))
    // Short-notice confirmation must not dump already missed reminders at once.
    .filter((reminder) => reminder.scheduledFor.getTime() > now);
  if (reminders.length === 0) return;
  await transaction.bookingReminder.createMany({
    data: reminders,
    skipDuplicates: true,
  });
}

import { validateServiceCategoryAssignment } from "./service-category.service.js";

export class ServiceOperationsService {
  private readonly repository: ServiceOperationsRepository;
  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new ServiceOperationsRepository(database);
  }

  async publicServices(query: PublicServiceListQuery) {
    return jsonSafe(page(await this.repository.listServices(query, true), query.limit));
  }

  async publicService(id: string) {
    const service = await this.repository.service(id, true);
    if (service === null) throw serviceOperationNotFound();
    const {
      timingVersion: _timingVersion,
      preparationMinutes: _preparation,
      cleanupMinutes: _cleanup,
      ...publicService
    } = service;
    return jsonSafe(publicService);
  }

  publicBookingPolicy() {
    return bookingPolicy;
  }

  async publicBookingSlots(serviceId: string, query: PublicBookingSlotListQuery) {
    const now = new Date();
    return this.database.$transaction(
      async (tx) => {
        const service = await this.repository.service(serviceId, true, tx);
        if (
          service === null ||
          service.pricingType !== "FIXED" ||
          service.priceKobo === null ||
          service.durationMinutes === null
        )
          throw serviceOperationNotFound();
        if (service.preparationMinutes === null || service.cleanupMinutes === null)
          return { items: [] };
        const canonicalServiceId = service.id;
        const branchId = query.branchId.toLowerCase();
        const policy = await tx.businessPolicyVersion.findFirst({
          where: {
            key: `booking-capacity:${branchId}`,
            effectiveAt: { lte: now },
          },
          orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
        });
        const calendar = capacitySettingsSchema.safeParse(policy?.settings);
        if (policy?.approvalStatus !== "APPROVED" || !calendar.success)
          return { items: [] };
        const plan = await findApprovedWorkshopResources(tx, branchId, now);
        if (
          !plan ||
          !plan.settings.services.some((row) => row.serviceId === canonicalServiceId)
        )
          return { items: [] };
        const staff = await tx.staffProfile.findMany({
          where: {
            AND: [
              {
                id: {
                  in: plan.settings.technicians
                    .filter((row) => row.serviceIds.includes(canonicalServiceId))
                    .map((row) => row.staffId),
                },
              },
              eligibleWorkshopTechnicianWhere(branchId, now),
            ],
          },
          select: { id: true },
        });
        const allowed = bookingWindow();
        const requestedFrom =
          query.from === undefined ? allowed.from : new Date(query.from);
        const requestedTo = query.to === undefined ? allowed.to : new Date(query.to);
        const from = requestedFrom > allowed.from ? requestedFrom : allowed.from;
        const to = requestedTo < allowed.to ? requestedTo : allowed.to;
        if (to < from) return { items: [] };
        return jsonSafe(
          page(
            await this.repository.publicBookingSlots(
              canonicalServiceId,
              {
                ...query,
                branchId,
                from: from.toISOString(),
                to: to.toISOString(),
              },
              calendar.data,
              plan.settings,
              staff.map((row) => row.id),
              tx,
            ),
            query.limit,
          ),
        );
      },
      { isolationLevel: "RepeatableRead", timeout: 15000 },
    );
  }

  private async reviewOfferedSlot(
    tx: Prisma.TransactionClient,
    slot: NonNullable<Awaited<ReturnType<ServiceOperationsRepository["bookingSlot"]>>>,
    excludeBookingId: string | null = null,
  ) {
    if (
      await tx.booking.findFirst({
        where: {
          bookingSlotId: slot.id,
          status: { in: [...activeBookingStatuses] },
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        },
        select: { id: true },
      })
    )
      throw scheduleConflict();
    await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id"=${slot.serviceId}::uuid FOR SHARE`;
    const service = await this.repository.service(slot.serviceId, true, tx);
    const staff = await this.repository.assignableStaff(slot.staffId, tx);
    if (
      !service ||
      !staff ||
      staff.branchId !== slot.branchId ||
      !(await this.repository.branch(slot.branchId, tx))
    )
      throw serviceOperationNotFound();
    const occupied = assertCurrentSlotTiming(slot, service);
    await assertSlotCalendar(
      tx,
      slot.branchId,
      occupied.startsAt,
      occupied.endsAt,
      excludeBookingId,
    );
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${slot.staffId}`},0))`;
    if (
      await this.repository.hasScheduleConflict(
        slot.staffId,
        occupied.startsAt,
        occupied.endsAt,
        excludeBookingId,
        tx,
      )
    )
      throw scheduleConflict();
    await assertOfferedWorkshopResources(tx, {
      branchId: slot.branchId,
      serviceId: slot.serviceId,
      staffId: slot.staffId,
      startsAt: occupied.startsAt,
      endsAt: occupied.endsAt,
      excludeBookingId,
    });
    return occupied;
  }

  async staffBookingSlots(actor: AuthenticatedActor, query: StaffBookingSlotListQuery) {
    assertPrivilegedActor(actor);
    const profile = await this.repository.staffProfile(actor.userId);
    if (
      actor.role === "STAFF" &&
      (profile === null || profile.branchId === null || profile.branch?.isActive !== true)
    )
      throw serviceOperationForbidden();
    return jsonSafe(
      page(
        (
          await this.repository.listBookingSlots(
            query,
            actor.role === "STAFF" ? profile!.branchId : null,
          )
        ).map((slot) => ({
          ...slot,
          timingReviewRequired: !slotTimingIsCurrent(slot, slot.service),
        })),
        query.limit,
      ),
    );
  }

  async createBookingSlot(
    actor: AuthenticatedActor,
    input: BookingSlotCreateInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    const startsAt = new Date(input.startsAt);
    if (startsAt <= new Date())
      throw serviceOperationConflict("Booking slots must start in the future");
    return this.database.$transaction(async (transaction) => {
      await lockWorkforce(transaction);
      const [actorProfile, targetStaff, service, branch] = await Promise.all([
        this.repository.staffProfile(actor.userId, transaction),
        this.repository.assignableStaff(input.staffId, transaction),
        this.repository.service(input.serviceId, true, transaction),
        this.repository.branch(input.branchId, transaction),
      ]);
      if (
        targetStaff === null ||
        branch === null ||
        service === null ||
        targetStaff.branchId !== input.branchId ||
        service.pricingType !== "FIXED" ||
        service.priceKobo === null ||
        service.durationMinutes === null
      )
        throw serviceOperationNotFound();
      if (
        actor.role === "STAFF" &&
        (actorProfile === null ||
          actorProfile.id !== targetStaff.id ||
          actorProfile.branchId !== input.branchId)
      )
        throw serviceOperationForbidden();
      await transaction.$queryRaw`SELECT "id" FROM "Service" WHERE "id"=${service.id}::uuid FOR SHARE`;
      const currentService = await this.repository.service(service.id, true, transaction);
      if (!currentService) throw serviceOperationNotFound();
      if (
        input.expectedServiceVersion !== undefined &&
        currentService.version !== input.expectedServiceVersion
      )
        throw staleServiceOperation();
      const occupied = timingWindow(startsAt, currentService);
      await assertSlotCalendar(
        transaction,
        branch.id,
        occupied.startsAt,
        occupied.endsAt,
      );
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${input.staffId}`}, 0))`;
      if (
        await this.repository.hasScheduleConflict(
          input.staffId,
          occupied.startsAt,
          occupied.endsAt,
          null,
          transaction,
        )
      )
        throw scheduleConflict();
      const conflict = await transaction.$queryRaw<Array<{ exists: boolean }>>(
        PrismaSql.sql`SELECT EXISTS (${openSlotConflictSelect(input.staffId, occupied.startsAt, occupied.endsAt, null)}) AS "exists"`,
      );
      if (conflict[0]?.exists)
        throw serviceOperationConflict(
          "Another open offer overlaps this period. Close obsolete offers before publishing a replacement, or choose another time.",
        );
      const endsAt = occupied.jobEndsAt;
      const slot = await this.repository.createBookingSlot(
        {
          branchId: input.branchId,
          serviceId: input.serviceId,
          staffId: input.staffId,
          startsAt,
          endsAt,
          durationMinutes: currentService.durationMinutes,
          preparationMinutes: currentService.preparationMinutes,
          cleanupMinutes: currentService.cleanupMinutes,
          serviceTimingVersion: currentService.timingVersion,
        },
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "BOOKING_SLOT",
        entityId: slot.id,
        newValues: {
          branchId: slot.branchId,
          serviceId: slot.serviceId,
          staffId: slot.staffId,
          startsAt: slot.startsAt.toISOString(),
        },
        context,
      });
      return jsonSafe(slot);
    });
  }

  async updateBookingSlot(
    actor: AuthenticatedActor,
    id: string,
    input: BookingSlotUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await lockWorkforce(transaction);
      const [profile, slot] = await Promise.all([
        this.repository.staffProfile(actor.userId, transaction),
        this.repository.lockBookingSlot(id, transaction),
      ]);
      if (slot === null) throw serviceOperationNotFound();
      if (
        actor.role === "STAFF" &&
        (profile === null ||
          profile.branch?.isActive !== true ||
          profile.id !== slot.staffId ||
          profile.branchId !== slot.branchId)
      )
        throw serviceOperationForbidden();
      if (slot.version !== input.expectedVersion) throw staleServiceOperation();
      if (input.status === "OPEN") {
        if (slot.startsAt <= new Date())
          throw serviceOperationConflict("Publish a future appointment time");
        if (
          await transaction.booking.findFirst({
            where: { bookingSlotId: id, status: { in: [...activeBookingStatuses] } },
            select: { id: true },
          })
        )
          throw serviceOperationConflict(
            "An active appointment retains this offer; review its own estimate instead",
          );
        await transaction.$queryRaw`SELECT "id" FROM "Service" WHERE "id"=${slot.serviceId}::uuid FOR SHARE`;
        const service = await this.repository.service(slot.serviceId, true, transaction);
        const staff = await this.repository.assignableStaff(slot.staffId, transaction);
        if (
          !service ||
          !staff ||
          staff.branchId !== slot.branchId ||
          !(await this.repository.branch(slot.branchId, transaction))
        )
          throw serviceOperationNotFound();
        if (
          input.expectedServiceVersion !== undefined &&
          service.version !== input.expectedServiceVersion
        )
          throw staleServiceOperation();
        const history = await transaction.booking.findFirst({
          where: { bookingSlotId: id },
          select: { id: true },
        });
        if (history && !slotTimingIsCurrent(slot, service))
          throw serviceOperationConflict(
            "This offer has booking history. Publish a new slot with the current estimates; the earlier schedule must remain unchanged.",
          );
        const occupied = timingWindow(slot.startsAt, service);
        await assertSlotCalendar(
          transaction,
          slot.branchId,
          occupied.startsAt,
          occupied.endsAt,
        );
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${slot.staffId}`},0))`;
        if (
          await this.repository.hasScheduleConflict(
            slot.staffId,
            occupied.startsAt,
            occupied.endsAt,
            null,
            transaction,
          )
        )
          throw scheduleConflict();
        const overlaps = await transaction.$queryRaw<Array<{ exists: boolean }>>(
          PrismaSql.sql`SELECT EXISTS (${openSlotConflictSelect(slot.staffId, occupied.startsAt, occupied.endsAt, id)}) AS "exists"`,
        );
        if (overlaps[0]?.exists)
          throw serviceOperationConflict(
            "Another open offer overlaps this period. Close obsolete offers before reopening a replacement, or choose another time.",
          );
        if (!history)
          await transaction.bookingSlot.update({
            where: { id },
            data: {
              durationMinutes: service.durationMinutes,
              preparationMinutes: service.preparationMinutes,
              cleanupMinutes: service.cleanupMinutes,
              serviceTimingVersion: service.timingVersion,
              endsAt: occupied.jobEndsAt,
            },
          });
      }
      const updated = await this.repository.updateBookingSlot(
        id,
        input.expectedVersion,
        input.status,
        transaction,
      );
      if (updated.count !== 1) throw staleServiceOperation();
      const result = await this.repository.bookingSlot(id, transaction);
      if (result === null) throw serviceOperationNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "BOOKING_SLOT",
        entityId: id,
        oldValues: {
          status: slot.status,
          version: slot.version,
          durationMinutes: slot.durationMinutes,
          preparationMinutes: slot.preparationMinutes,
          cleanupMinutes: slot.cleanupMinutes,
          serviceTimingVersion: slot.serviceTimingVersion,
        },
        newValues: {
          status: result.status,
          version: result.version,
          durationMinutes: result.durationMinutes,
          preparationMinutes: result.preparationMinutes,
          cleanupMinutes: result.cleanupMinutes,
          serviceTimingVersion: result.serviceTimingVersion,
        },
        context,
      });
      return jsonSafe(result);
    });
  }

  async adminServices(actor: AuthenticatedActor, query: AdminServiceListQuery) {
    assertServiceAdministrator(actor);
    return jsonSafe(page(await this.repository.listServices(query, false), query.limit));
  }

  async adminService(actor: AuthenticatedActor, id: string) {
    assertServiceAdministrator(actor);
    const service = await this.repository.service(id, false);
    if (service === null) throw serviceOperationNotFound();
    return jsonSafe(service);
  }

  async createService(
    actor: AuthenticatedActor,
    input: ServiceCreateInput,
    context: RequestSecurityContext,
  ) {
    assertServiceAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await validateServiceCategoryAssignment(transaction, input.categoryId);
      const service = await this.repository.createService(input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "SERVICE",
        entityId: service.id,
        newValues: {
          pricingType: service.pricingType,
          active: service.isActive,
          currency: service.currency,
        },
        context,
      });
      return jsonSafe(service);
    });
  }

  async updateService(
    actor: AuthenticatedActor,
    id: string,
    input: ServiceUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertServiceAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await lockWorkforce(transaction);
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`service:${id}`}, 0))`;
      const existing = await this.repository.service(id, false, transaction);
      if (existing === null) throw serviceOperationNotFound();
      const nextPricing = input.pricingType ?? existing.pricingType;
      await validateServiceCategoryAssignment(transaction, input.categoryId);
      const nextPrice =
        input.priceKobo === undefined
          ? existing.priceKobo
          : input.priceKobo === null
            ? null
            : BigInt(input.priceKobo);
      if (nextPricing === "FIXED" && nextPrice === null)
        throw serviceOperationConflict("Fixed-price services require a price");
      if (input.isActive === false && existing.isActive) {
        const active = await transaction.booking.count({
          where: { serviceId: id, status: { in: [...activeBookingStatuses] } },
        });
        if (active > 0)
          throw serviceOperationConflict(
            "Active bookings must be resolved before deactivating this service",
          );
      }
      const timingChanged =
        (input.durationMinutes !== undefined &&
          input.durationMinutes !== existing.durationMinutes) ||
        (input.preparationMinutes !== undefined &&
          input.preparationMinutes !== existing.preparationMinutes) ||
        (input.cleanupMinutes !== undefined &&
          input.cleanupMinutes !== existing.cleanupMinutes);
      if (timingChanged)
        await preserveExistingBookingTiming(transaction, id, actor.userId);
      const updated = await this.repository.updateService(
        id,
        input,
        transaction,
        timingChanged,
      );
      if (updated.count !== 1) throw staleServiceOperation();
      const service = await this.repository.service(id, false, transaction);
      if (service === null) throw serviceOperationNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: input.isActive === undefined ? "UPDATE" : "STATUS_CHANGE",
        entityType: "SERVICE",
        entityId: id,
        oldValues: { version: existing.version, active: existing.isActive },
        newValues: {
          version: service.version,
          active: service.isActive,
          changedFields: Object.keys(input)
            .filter((key) => key !== "expectedVersion")
            .sort()
            .join(","),
        },
        context,
      });
      return jsonSafe(service);
    });
  }

  async customerBookings(actor: AuthenticatedActor, query: CustomerBookingListQuery) {
    assertCustomerActor(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (profile === null) throw serviceOperationForbidden();
    const result = page(
      await this.repository.listCustomerBookings(profile.id, query),
      query.limit,
    );
    return jsonSafe({ ...result, items: result.items.map(customerSafeBooking) });
  }

  async customerBooking(actor: AuthenticatedActor, id: string) {
    assertCustomerActor(actor);
    const booking = await this.ownedCustomerBooking(actor.userId, id);
    return jsonSafe(customerSafeBooking(booking));
  }

  async createBooking(
    actor: AuthenticatedActor,
    input: BookingCreateInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    if (input.policyVersion !== bookingPolicy.version)
      throw serviceOperationConflict(
        "The booking policy has changed; review it and retry",
      );
    const scope = `booking-create:${actor.userId}`;
    const keyHash = hashToken("booking-idempotency", `${actor.userId}:${rawKey}`);
    const requestHash = bookingFingerprint(input);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-idempotency:${keyHash}`}, 0))`;
      const prior = await this.repository.idempotency(scope, keyHash, transaction);
      if (prior !== null) {
        if (prior.status !== "COMPLETED" || prior.requestHash !== requestHash)
          throw serviceOperationConflict(
            "The idempotency key was already used for another request",
          );
        const bookingId =
          prior.responseBody !== null &&
          typeof prior.responseBody === "object" &&
          !Array.isArray(prior.responseBody)
            ? (prior.responseBody as { bookingId?: unknown }).bookingId
            : undefined;
        const replay =
          typeof bookingId === "string"
            ? await this.repository.customerBooking(bookingId, transaction)
            : null;
        if (replay === null) throw serviceOperationNotFound();
        // Older fingerprints omit the immutable concern. Compare the saved value
        // separately so valid pre-existing retry keys remain usable.
        if ((replay.customerConcern ?? null) !== (input.customerConcern ?? null))
          throw serviceOperationConflict(
            "This request was already received with different details. Review your booking before submitting again.",
          );
        return jsonSafe({ booking: customerSafeBooking(replay), replayed: true });
      }
      const profile = await this.repository.customerProfile(actor.userId, transaction);
      if (profile === null) throw serviceOperationForbidden();
      await this.repository.createIdempotency(
        actor.userId,
        scope,
        keyHash,
        requestHash,
        transaction,
      );
      let slot: {
        id: string | null;
        branchId: string;
        serviceId: string | null;
        staffId: string | null;
        startsAt: Date;
        endsAt: Date | null;
        service: { priceKobo: bigint | null };
      };
      if (input.slotId !== undefined) {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-slot:${input.slotId}`}, 0))`;
        const offered = await this.repository.lockBookingSlot(input.slotId, transaction);
        if (
          offered === null ||
          offered.status !== "OPEN" ||
          offered.branch.isActive !== true ||
          offered.service.isActive !== true ||
          offered.service.pricingType !== "FIXED" ||
          offered.service.priceKobo === null ||
          offered.service?.durationMinutes == null
        )
          throw serviceOperationNotFound();
        assertWithinBookingWindow(offered.startsAt);
        if (
          await transaction.booking.findFirst({
            where: {
              bookingSlotId: offered.id,
              status: {
                in: ["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS"],
              },
            },
            select: { id: true },
          })
        )
          throw scheduleConflict();

        await this.reviewOfferedSlot(transaction, offered);
        slot = offered;
      } else {
        if (
          (!input.serviceId && !input.customerConcern) ||
          !input.branchId ||
          !input.preferredAt
        )
          throw serviceOperationConflict(
            "Choose a service or describe a concern, with a branch and preferred time",
          );
        // Lock canonical records against withdrawal while the request is saved.
        if (input.serviceId)
          await transaction.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${input.serviceId}::uuid FOR SHARE`;
        await transaction.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${input.branchId}::uuid FOR SHARE`;
        const service = input.serviceId
          ? await transaction.service.findFirst({
              where: { id: input.serviceId, isActive: true },
              select: {
                id: true,
                priceKobo: true,
                pricingType: true,
                durationMinutes: true,
                currency: true,
              },
            })
          : null;
        const branch = await this.repository.branch(input.branchId, transaction);
        if (!branch || (input.serviceId && (!service || service.currency !== "NGN")))
          throw serviceOperationNotFound();
        const startsAt = new Date(input.preferredAt);
        assertWithinBookingWindow(startsAt);
        // This is a preference, never an invented available slot or assignment.
        slot = {
          id: null,
          branchId: branch.id,
          serviceId: service?.id ?? null,
          staffId: null,
          startsAt,
          endsAt:
            service?.durationMinutes == null
              ? null
              : new Date(startsAt.getTime() + service.durationMinutes * 60_000),
          service: {
            priceKobo: service?.pricingType === "FIXED" ? service.priceKobo : null,
          },
        };
      }
      // Resolve from canonical records, never a client-supplied label. Keep this
      // snapshot unchanged when staff later classify the concern or move a service.
      let categoryId = input.serviceCategoryId;
      if (slot.serviceId) {
        await transaction.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${slot.serviceId}::uuid FOR SHARE`;
        const serviceGroup = await transaction.service.findUnique({
          where: { id: slot.serviceId },
          select: { categoryId: true },
        });
        if (categoryId && categoryId !== serviceGroup?.categoryId)
          throw serviceOperationConflict(
            "The service group changed. Review the service and try again.",
          );
        categoryId ??= serviceGroup?.categoryId ?? undefined;
      }
      let requestedGroup: { id: string; name: string } | null = null;
      if (categoryId) {
        await transaction.$queryRaw`SELECT "id" FROM "ServiceCategory" WHERE "id" = ${categoryId}::uuid FOR SHARE`;
        requestedGroup = await transaction.serviceCategory.findFirst({
          where: { id: categoryId, isActive: true },
          select: { id: true, name: true },
        });
        // Unpublished groups must not leak through an otherwise public service.
        if (!requestedGroup && input.serviceCategoryId) throw serviceOperationNotFound();
      }
      if (
        input.vehicleId !== undefined &&
        (await this.repository.ownedVehicle(profile.id, input.vehicleId, transaction)) ===
          null
      )
        throw serviceOperationNotFound();
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${profile.id}`}, 0))`;
      if (
        slot.endsAt !== null &&
        (await this.repository.hasCustomerScheduleConflict(
          profile.id,
          slot.startsAt,
          slot.endsAt,
          null,
          transaction,
        ))
      )
        throw scheduleConflict();
      if (
        slot.endsAt === null &&
        (await transaction.booking.findFirst({
          where: {
            customerId: profile.id,
            scheduledAt: slot.startsAt,
            status: { in: [...activeBookingStatuses] },
          },
          select: { id: true },
        }))
      )
        throw scheduleConflict();
      const now = new Date();
      const policy = await approvedPolicy(transaction, "booking");
      const booking = await this.repository.createBooking(
        {
          customerId: profile.id,
          branchId: slot.branchId,
          serviceId: slot.serviceId,
          assignedStaffId: slot.staffId,
          bookingSlotId: slot.id,
          scheduledAt: slot.startsAt,
          status: "REQUESTED",
          requestedServiceCategoryId: requestedGroup?.id ?? null,
          requestedServiceCategoryName: requestedGroup?.name ?? null,
          customerConcern: input.customerConcern ?? null,
          quotedPriceKobo: slot.service.priceKobo,
          currency: "NGN",
          requestedAt: now,
          policySnapshot: policySnapshot(policy),
          depositPolicyVersion: bookingPolicy.version,
          depositTermsAcceptedAt: now,
          ...(input.vehicleId === undefined ? {} : { vehicleId: input.vehicleId }),
          ...(input.customerNotes === undefined
            ? {}
            : { customerNotes: input.customerNotes }),
        },
        transaction,
      );
      if (booking.serviceId) {
        const timing = await captureBookingTiming(
          transaction,
          booking,
          actor.userId,
          true,
          "SERVICE_DEFAULT",
        );
        booking.timingSnapshots = [timing];
      }
      await enqueueNotification(transaction, {
        userId: actor.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Booking request received",
        message:
          "Your booking request is saved. Your preferred time is not confirmed yet. Our team will review it. No booking deposit is required. Cancellation is free.",
        resourceType: "BOOKING",
        resourceId: booking.id,
        deduplicationKey: `booking:${booking.id}:requested`,
        channels: ["EMAIL"],
      });
      await this.repository.completeIdempotency(scope, keyHash, booking.id, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "BOOKING",
        entityId: booking.id,
        newValues: {
          requestedServiceCategoryId: booking.requestedServiceCategoryId,
          branchId: booking.branchId,
          serviceId: booking.serviceId,
          status: booking.status,
          scheduledAt: booking.scheduledAt.toISOString(),
          confirmationRequired: true,
          policyVersion: bookingPolicy.version,
        },
        context,
      });
      const result = await this.repository.customerBooking(booking.id, transaction);
      if (result === null) throw serviceOperationNotFound();
      return jsonSafe({ booking: customerSafeBooking(result), replayed: false });
    });
  }

  async proposeBookingAlternative(
    actor: AuthenticatedActor,
    id: string,
    input: BookingAlternativeInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      const booking = await this.lockAuthorizedStaffBooking(actor, id, tx, false);
      return this.proposeLockedAlternative(tx, actor, booking, input, context);
    });
  }

  async proposeWorkforceBookingAlternative(
    actor: AuthenticatedActor,
    id: string,
    input: BookingAlternativeInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      const permitted = async () => {
        const access = await workforceSnapshot(tx, actor);
        if (
          !access.managed ||
          !access.independentCapabilities.includes("BOOKING_CONFIRM")
        )
          workforceDenied();
        return tx.booking.findFirst({
          where: { AND: [{ id }, bookingScope(access, "BOOKINGS_READ")] },
          select: { id: true },
        });
      };
      if (!(await permitted())) workforceNotFound();
      const booking = await this.repository.lockBooking(id, tx);
      if (!booking || !(await permitted())) workforceNotFound();
      await this.proposeLockedAlternative(tx, actor, booking, input, context);
      // Expiry during lock waits invalidates the whole transactional mutation,
      // including the customer notification and audit record.
      if (!(await permitted())) workforceNotFound();
      const receipt = await tx.booking.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          branchId: true,
          status: true,
          version: true,
          scheduledAt: true,
          alternativeStartsAt: true,
          alternativeReason: true,
          alternativeVersion: true,
        },
      });
      return { ...receipt, performedByUserId: actor.userId };
    });
  }

  private async proposeLockedAlternative(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    booking: NonNullable<Awaited<ReturnType<ServiceOperationsRepository["lockBooking"]>>>,
    input: BookingAlternativeInput,
    context: RequestSecurityContext,
  ) {
    const id = booking.id;
    await assertCapability(tx, actor, "BOOKING_CONFIRM");
    if (!["REQUESTED", "CONFIRMED"].includes(booking.status) || !booking.branchId)
      throw invalidServiceTransition();
    if (booking.rescheduleRequests.some((request) => request.status === "PENDING"))
      throw serviceOperationConflict(
        "Review the pending reschedule request before proposing another time",
      );
    const startsAt = new Date(input.preferredAt);
    assertWithinBookingWindow(startsAt);
    if (startsAt.getTime() === booking.scheduledAt.getTime())
      throw serviceOperationConflict("Choose a different appointment time");
    if (!(await this.repository.branch(booking.branchId, tx)))
      throw serviceOperationNotFound();
    const changed = await this.repository.updateBooking(
      id,
      input.expectedVersion,
      {
        alternativeStartsAt: startsAt,
        alternativeReason: input.reason,
        alternativeVersion: input.expectedVersion + 1,
      },
      tx,
    );
    if (changed.count !== 1) throw staleServiceOperation();
    const updated = await this.repository.customerBooking(id, tx);
    if (!updated) throw serviceOperationNotFound();
    const customer = await tx.customerProfile.findUniqueOrThrow({
      where: { id: booking.customerId },
      select: { userId: true },
    });
    await enqueueNotification(tx, {
      userId: customer.userId,
      type: "BOOKING",
      category: "TRANSACTIONAL",
      title: "Review a proposed appointment time",
      message:
        "The workshop has suggested another time. Review it in your booking. Your existing appointment has not changed; the proposal does not reserve capacity.",
      resourceType: "BOOKING",
      resourceId: id,
      deduplicationKey: `booking:${id}:alternative:${updated.version}`,
      channels: ["EMAIL"],
    });
    await this.auditBooking(tx, actor, booking, updated, context);
    return jsonSafe(customerSafeBooking(updated));
  }

  async respondToBookingAlternative(
    actor: AuthenticatedActor,
    id: string,
    input: BookingAlternativeResponseInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (tx) => {
      const booking = await this.lockOwnedCustomerBooking(actor.userId, id, tx);
      if (
        booking.version !== input.expectedVersion ||
        booking.alternativeVersion !== booking.version
      )
        throw staleServiceOperation();
      if (
        !["REQUESTED", "CONFIRMED"].includes(booking.status) ||
        !booking.alternativeStartsAt ||
        !booking.branchId
      )
        throw invalidServiceTransition();
      const startsAt = booking.alternativeStartsAt;
      if (input.decision === "ACCEPT") {
        assertWithinBookingWindow(startsAt);
        await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${booking.branchId}::uuid FOR SHARE`;
        if (!(await this.repository.branch(booking.branchId, tx)))
          throw serviceOperationNotFound();
        let duration: number | null = null;
        if (booking.serviceId) {
          await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${booking.serviceId}::uuid FOR SHARE`;
          const service = await this.repository.service(booking.serviceId, true, tx);
          if (!service) throw serviceOperationNotFound();
          duration = bookedJobMinutes({ ...booking, service });
        }
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${booking.customerId}`}, 0))`;
        if (
          duration !== null &&
          (await this.repository.hasCustomerScheduleConflict(
            booking.customerId,
            startsAt,
            new Date(startsAt.getTime() + duration * 60000),
            id,
            tx,
          ))
        )
          throw scheduleConflict();
        if (
          duration === null &&
          (await tx.booking.findFirst({
            where: {
              customerId: booking.customerId,
              id: { not: id },
              scheduledAt: startsAt,
              status: { in: [...activeBookingStatuses] },
            },
            select: { id: true },
          }))
        )
          throw scheduleConflict();
      }
      if (input.decision === "ACCEPT") {
        await createPendingReschedule(
          tx,
          booking,
          actor.userId,
          { id: null, branchId: booking.branchId, startsAt },
          booking.alternativeReason ??
            "Customer accepted the workshop-proposed alternative",
          "WORKSHOP_ALTERNATIVE",
        );
      }
      const changed = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {
          alternativeStartsAt: null,
          alternativeReason: null,
          alternativeVersion: null,
        },
        tx,
      );
      if (changed.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.customerBooking(id, tx);
      if (!updated) throw serviceOperationNotFound();
      await enqueueNotification(tx, {
        userId: actor.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title:
          input.decision === "ACCEPT"
            ? "Alternative time requested"
            : "Alternative time declined",
        message:
          input.decision === "ACCEPT"
            ? "Your chosen alternative awaits staff approval. Your original appointment remains unchanged. This workshop-proposed change does not use your customer reschedule allowance or charge a fee."
            : "You declined the proposed time. Your existing booking time and status are unchanged.",
        resourceType: "BOOKING",
        resourceId: id,
        deduplicationKey: `booking:${id}:alternative-response:${updated.version}`,
        channels: ["EMAIL"],
      });
      await this.auditBooking(tx, actor, booking, updated, context);
      return jsonSafe(customerSafeBooking(updated));
    });
  }

  async rescheduleBooking(
    actor: AuthenticatedActor,
    id: string,
    input: BookingRescheduleInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    const scope = `booking-reschedule:${actor.userId}:${id}`;
    const keyHash = hashToken("booking-idempotency", `${scope}:${rawKey}`);
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-reschedule:${keyHash}`}, 0))`;
      const prior = await this.repository.idempotency(scope, keyHash, transaction);
      if (prior !== null) {
        if (prior.status !== "COMPLETED" || prior.requestHash !== requestHash)
          throw serviceOperationConflict(
            "The idempotency key was already used for another request",
          );
        const replay = await this.lockOwnedCustomerBooking(actor.userId, id, transaction);
        return jsonSafe({ ...customerSafeBooking(replay), replayed: true });
      }
      const booking = await this.lockOwnedCustomerBooking(actor.userId, id, transaction);
      if (
        booking.status !== "CONFIRMED" ||
        booking.customerRescheduleCount >= bookingPolicy.customerRescheduleLimit ||
        booking.scheduledAt.getTime() - Date.now() <
          bookingPolicy.customerRescheduleCutoffHours * 3_600_000
      )
        throw invalidServiceTransition();
      if (input.slotId === booking.bookingSlotId)
        throw serviceOperationConflict("Choose a different booking slot");
      await this.repository.createIdempotency(
        actor.userId,
        scope,
        keyHash,
        requestHash,
        transaction,
      );
      const slotIds = [booking.bookingSlotId, input.slotId]
        .filter((id): id is string => typeof id === "string")
        .sort();
      for (const slotId of slotIds) {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-slot:${slotId}`}, 0))`;
        await transaction.$queryRaw`SELECT "id" FROM "BookingSlot" WHERE "id" = ${slotId}::uuid FOR UPDATE`;
      }
      let replacement: {
        id: string | null;
        branchId: string;
        staffId: string | null;
        startsAt: Date;
        endsAt: Date | null;
      };
      if (input.slotId) {
        const offered = await this.repository.bookingSlot(input.slotId, transaction);
        if (
          !offered ||
          offered.status !== "OPEN" ||
          offered.serviceId !== booking.serviceId ||
          !offered.branch.isActive
        )
          throw serviceOperationNotFound();
        if (
          await transaction.booking.findFirst({
            where: {
              bookingSlotId: offered.id,
              id: { not: booking.id },
              status: { in: [...activeBookingStatuses] },
            },
            select: { id: true },
          })
        )
          throw scheduleConflict();
        await this.reviewOfferedSlot(transaction, offered, booking.id);
        replacement = offered;
      } else {
        if (!input.preferredAt || !booking.branchId || !booking.serviceId)
          throw invalidServiceTransition();
        await transaction.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${booking.serviceId}::uuid FOR SHARE`;
        await transaction.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${booking.branchId}::uuid FOR SHARE`;
        const service = await transaction.service.findFirst({
          where: { id: booking.serviceId, isActive: true },
          select: { durationMinutes: true },
        });
        if (!service || !(await this.repository.branch(booking.branchId, transaction)))
          throw serviceOperationNotFound();
        const startsAt = new Date(input.preferredAt);
        if (startsAt.getTime() === booking.scheduledAt.getTime())
          throw serviceOperationConflict("Choose a different preferred time");
        replacement = {
          id: null,
          branchId: booking.branchId,
          staffId: null,
          startsAt,
          endsAt:
            bookedJobMinutes({ ...booking, service }) === null
              ? null
              : new Date(
                  startsAt.getTime() +
                    bookedJobMinutes({ ...booking, service })! * 60_000,
                ),
        };
      }
      const savedJobMinutes = bookedJobMinutes(booking);
      replacement.endsAt =
        savedJobMinutes === null
          ? null
          : new Date(replacement.startsAt.getTime() + savedJobMinutes * 60000);
      assertWithinBookingWindow(replacement.startsAt);
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${booking.customerId}`}, 0))`;
      if (
        replacement.endsAt !== null &&
        (await this.repository.hasCustomerScheduleConflict(
          booking.customerId,
          replacement.startsAt,
          replacement.endsAt,
          booking.id,
          transaction,
        ))
      )
        throw scheduleConflict();
      if (
        replacement.endsAt === null &&
        (await transaction.booking.findFirst({
          where: {
            customerId: booking.customerId,
            id: { not: booking.id },
            scheduledAt: replacement.startsAt,
            status: { in: [...activeBookingStatuses] },
          },
          select: { id: true },
        }))
      )
        throw scheduleConflict();
      await createPendingReschedule(
        transaction,
        booking,
        actor.userId,
        replacement,
        input.reason,
        "CUSTOMER",
      );
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {},
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.customerBooking(id, transaction);
      if (!updated) throw serviceOperationNotFound();
      await this.notifyReschedule(
        transaction,
        booking,
        actor.userId,
        "Reschedule requested",
        "Your requested replacement awaits staff approval. Your original appointment remains confirmed and unchanged.",
        updated.version,
      );
      await this.auditBooking(transaction, actor, booking, updated, context);
      await this.repository.completeIdempotency(scope, keyHash, id, transaction, 200);
      return jsonSafe({ ...customerSafeBooking(updated), replayed: false });
    });
  }

  private async notifyReschedule(
    tx: Prisma.TransactionClient,
    booking: { id: string; assignedStaffId: string | null },
    customerUserId: string,
    title: string,
    message: string,
    version: number,
    previousStaffId?: string | null,
  ) {
    const recipients = new Set([customerUserId]);
    for (const staffId of new Set(
      [booking.assignedStaffId, previousStaffId].filter((id): id is string => !!id),
    )) {
      const staff = await tx.staffProfile.findUnique({
        where: { id: staffId },
        select: { userId: true, user: { select: { status: true } } },
      });
      if (staff?.user.status === "ACTIVE") recipients.add(staff.userId);
    }
    for (const userId of recipients)
      await enqueueNotification(tx, {
        userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title,
        message,
        resourceType: "BOOKING",
        resourceId: booking.id,
        deduplicationKey: `booking:${booking.id}:reschedule:${version}:${userId}`,
        channels: ["EMAIL"],
      });
  }

  async withdrawBookingReschedule(
    actor: AuthenticatedActor,
    id: string,
    input: BookingRescheduleWithdrawInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (tx) => {
      const booking = await this.lockOwnedCustomerBooking(actor.userId, id, tx);
      if (booking.version !== input.expectedVersion) throw staleServiceOperation();
      const request = await tx.bookingRescheduleRequest.findFirst({
        where: {
          id: input.requestId,
          bookingId: id,
          status: "PENDING",
          requestedByUserId: actor.userId,
        },
      });
      if (!request) throw serviceOperationNotFound();
      await tx.bookingRescheduleRequest.update({
        where: { id: request.id },
        data: {
          status: "WITHDRAWN",
          decidedByUserId: actor.userId,
          decidedAt: new Date(),
          decisionReason: input.reason,
        },
      });
      const changed = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {},
        tx,
      );
      if (changed.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.customerBooking(id, tx);
      if (!updated) throw serviceOperationNotFound();
      await this.auditBooking(tx, actor, booking, updated, context);
      await this.notifyReschedule(
        tx,
        booking,
        actor.userId,
        "Reschedule request withdrawn",
        "The requested change was withdrawn. The appointment time and status have not changed.",
        updated.version,
      );
      return jsonSafe(customerSafeBooking(updated));
    });
  }

  async decideBookingReschedule(
    actor: AuthenticatedActor,
    id: string,
    input: BookingRescheduleDecisionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      const booking = await this.lockAuthorizedStaffBooking(actor, id, tx, false);
      return jsonSafe(
        await this.decideLockedBookingReschedule(tx, actor, booking, input, context),
      );
    });
  }

  async decideWorkforceBookingReschedule(
    actor: AuthenticatedActor,
    id: string,
    input: BookingRescheduleDecisionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      let original:
        { branchId: string | null; assignedStaffId: string | null } | undefined;
      const permitted = async (assignmentChanged = false) => {
        const access = await workforceSnapshot(tx, actor);
        if (
          !access.managed ||
          !access.independentCapabilities.includes("BOOKING_CONFIRM")
        )
          workforceDenied();
        if (
          original &&
          (!bookingSnapshotAllowed(access, "BOOKINGS_READ", original) ||
            (assignmentChanged &&
              !bookingSnapshotAllowed(access, "JOBS_ASSIGN", original)))
        )
          workforceNotFound();
        const filters = [
          { id },
          bookingScope(access, "BOOKINGS_READ"),
          ...(assignmentChanged ? [bookingScope(access, "JOBS_ASSIGN")] : []),
        ];
        if (
          !(await tx.booking.findFirst({ where: { AND: filters }, select: { id: true } }))
        )
          workforceNotFound();
      };
      await permitted();
      const booking = await this.repository.lockBooking(id, tx);
      if (!booking) workforceNotFound();
      original = booking;
      await permitted();
      const updated = await this.decideLockedBookingReschedule(
        tx,
        actor,
        booking,
        input,
        context,
        permitted,
      );
      const request = updated.rescheduleRequests.find(
        (row) => row.id === input.requestId,
      );
      if (!request || !request.decidedAt)
        throw serviceOperationConflict("The decision receipt could not be verified");
      return jsonSafe({
        id: updated.id,
        branchId: updated.branchId,
        assignedStaffId: updated.assignedStaffId,
        status: updated.status,
        scheduledAt: updated.scheduledAt,
        version: updated.version,
        requestId: request.id,
        requestStatus: request.status,
        decidedAt: request.decidedAt,
        performedByUserId: actor.userId,
      });
    });
  }

  private async decideLockedBookingReschedule(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    booking: NonNullable<Awaited<ReturnType<ServiceOperationsRepository["lockBooking"]>>>,
    input: BookingRescheduleDecisionInput,
    context: RequestSecurityContext,
    scope?: (assignmentChanged: boolean) => Promise<void>,
  ) {
    const id = booking.id;
    let assignmentChanged = false;
    let verifyTechnician: (() => Promise<void>) | undefined;
    await assertCapability(tx, actor, "BOOKING_CONFIRM");
    if (booking.version !== input.expectedVersion) throw staleServiceOperation();
    const request = await tx.bookingRescheduleRequest.findFirst({
      where: { id: input.requestId, bookingId: id, status: "PENDING" },
    });
    if (!request) throw serviceOperationNotFound();
    if (input.decision === "APPROVE") {
      assertOriginalAppointment(request.originalSchedule, booking);
      if (request.startsAt <= new Date())
        throw serviceOperationConflict("The requested replacement time has passed");
      if (booking.serviceId)
        await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${booking.serviceId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${request.branchId}::uuid FOR SHARE`;
      const service = booking.serviceId
        ? await this.repository.service(booking.serviceId, true, tx)
        : null;
      if (!service) throw serviceOperationNotFound();
      if (!(await this.repository.branch(request.branchId, tx)))
        throw serviceOperationNotFound();
      for (const slotId of [
        ...new Set(
          [booking.bookingSlotId, request.slotId].filter(
            (value): value is string => !!value,
          ),
        ),
      ].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-slot:${slotId}`}, 0))`;
        await tx.$queryRaw`SELECT "id" FROM "BookingSlot" WHERE "id" = ${slotId}::uuid FOR UPDATE`;
      }
      const slot = request.slotId
        ? await this.repository.bookingSlot(request.slotId, tx)
        : null;
      if (
        request.slotId &&
        (!slot ||
          slot.status !== "OPEN" ||
          slot.serviceId !== booking.serviceId ||
          slot.branchId !== request.branchId ||
          slot.startsAt.getTime() !== request.startsAt.getTime())
      )
        throw serviceOperationConflict(
          "The requested slot changed or is unavailable. The original appointment is unchanged",
        );
      if (
        request.slotId &&
        (await tx.booking.findFirst({
          where: {
            bookingSlotId: request.slotId,
            id: { not: id },
            status: { in: [...activeBookingStatuses] },
          },
          select: { id: true },
        }))
      )
        throw scheduleConflict();
      const staffId = input.assignedStaffId ?? slot?.staffId ?? booking.assignedStaffId;
      const staff = staffId ? await this.repository.assignableStaff(staffId, tx) : null;
      if (!staff || (!scope && staff.branchId !== request.branchId))
        throw serviceOperationConflict(
          "Assign an available staff member at the replacement branch before approval",
        );
      if (scope) {
        verifyTechnician = async () => {
          const target = await tx.staffProfile.findFirst({
            where: {
              id: staff.id,
              user: { status: "ACTIVE", emailVerifiedAt: { not: null } },
            },
            select: { userId: true, user: { select: { role: true } } },
          });
          if (!target)
            workforceDenied(
              "Select an active technician with work access in this branch",
            );
          const targetAccess = await workforceSnapshot(tx, {
            ...actor,
            userId: target.userId,
            role: target.user.role,
          });
          if (!branchesFor(targetAccess, "JOBS_UPDATE").includes(request.branchId))
            workforceDenied(
              "Select an active technician with work access in this branch",
            );
        };
        await verifyTechnician();
      }
      const actorProfile = await this.repository.staffProfile(actor.userId, tx);
      if (!scope && actor.role === "STAFF" && actorProfile?.id !== staff.id)
        throw serviceOperationForbidden();
      if (slot?.staffId && slot.staffId !== staff.id)
        throw serviceOperationConflict(
          "Choose the technician published for the requested slot, or another available time",
        );
      assignmentChanged =
        staff.id !== booking.assignedStaffId || request.branchId !== booking.branchId;
      if (scope) await scope(assignmentChanged);
      // Preserve the workforce permission boundary before reporting availability.
      if (slot) await this.reviewOfferedSlot(tx, slot, booking.id);
      const originalTiming = await captureBookingTiming(tx, booking, actor.userId, true);
      const replacementWindow = timingWindow(request.startsAt, originalTiming);
      await assertSlotCalendar(
        tx,
        request.branchId,
        replacementWindow.startsAt,
        replacementWindow.endsAt,
        id,
      );
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${staff.id}`},0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${booking.customerId}`},0))`;
      const end = replacementWindow.jobEndsAt;
      if (
        await this.repository.hasCustomerScheduleConflict(
          booking.customerId,
          request.startsAt,
          end,
          id,
          tx,
        )
      )
        throw scheduleConflict();
      // Both changes and all capacity checks are one transaction. Any failure
      // rolls back to the original confirmed appointment and its reminders.
      const changed = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {
          scheduledAt: request.startsAt,
          bookingSlotId: request.slotId,
          branchId: request.branchId,
          assignedStaffId: staff.id,
          status: "REQUESTED",
          confirmedAt: null,
          attendanceConfirmedAt: null,
          capacityPolicyVersionId: null,
          resourceReviewNote: null,
          scheduleVersion: { increment: 1 },
          ...(request.source === "CUSTOMER"
            ? { customerRescheduleCount: { increment: 1 } }
            : {}),
          ...(booking.disruptionResolution === "PENDING"
            ? { disruptionResolution: "TRANSFERRED" as const }
            : {}),
        },
        tx,
      );
      if (changed.count !== 1) throw staleServiceOperation();
      if (scope) await scope(assignmentChanged);
      const candidate = scope
        ? await this.repository.lockBooking(id, tx)
        : await this.lockAuthorizedStaffBooking(actor, id, tx, false);
      if (!candidate) throw serviceOperationNotFound();
      await carryBookingTiming(tx, booking, candidate, actor.userId);
      await cancelPendingReminders(tx, id);
      await this.transitionLockedBooking(
        tx,
        actor,
        candidate,
        {
          status: "CONFIRMED",
          expectedVersion: candidate.version,
          resourceReviewNote: input.resourceReviewNote,
        },
        context,
      );
    } else {
      const changed = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {},
        tx,
      );
      if (changed.count !== 1) throw staleServiceOperation();
    }
    await tx.bookingRescheduleRequest.update({
      where: { id: request.id },
      data: {
        status: input.decision === "APPROVE" ? "APPROVED" : "DECLINED",
        decidedByUserId: actor.userId,
        decidedAt: new Date(),
        decisionReason: input.reason,
      },
    });
    const updated = await this.repository.staffBooking(id, actor.role !== "STAFF", tx);
    if (!updated) throw serviceOperationNotFound();
    const customer = await tx.customerProfile.findUniqueOrThrow({
      where: { id: booking.customerId },
      select: { userId: true },
    });
    await this.auditBooking(tx, actor, booking, updated, context);
    await this.notifyReschedule(
      tx,
      updated,
      customer.userId,
      input.decision === "APPROVE" ? "Reschedule approved" : "Reschedule declined",
      input.decision === "APPROVE"
        ? "The workshop approved the replacement appointment. Review the confirmed time and update your saved calendar event."
        : "The workshop declined the requested change. Your original appointment remains unchanged.",
      updated.version,
      booking.assignedStaffId,
    );
    if (verifyTechnician) await verifyTechnician();
    if (scope) await scope(assignmentChanged);
    await lockAccessActor(tx, actor);
    return updated;
  }

  private async assertWorkReviewScope(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    id: string,
    managed: boolean,
  ) {
    if (!managed) {
      await this.lockAuthorizedStaffBooking(actor, id, tx);
      return;
    }
    const access = await workforceSnapshot(tx, actor);
    if (!access.managed || !access.independentCapabilities.includes("BOOKING_CONFIRM"))
      workforceDenied();
    if (
      !(await tx.booking.findFirst({
        where: { AND: [{ id }, bookingScope(access, "BOOKINGS_READ")] },
        select: { id: true },
      }))
    )
      workforceNotFound();
  }
  async bookingWorkReviewOptions(actor: AuthenticatedActor, id: string, managed = false) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      await this.assertWorkReviewScope(tx, actor, id, managed);
      await assertCapability(tx, actor, "BOOKING_CONFIRM");
      const booking = await this.repository.lockBooking(id, tx);
      if (!booking) throw serviceOperationNotFound();
      const result = await bookingWorkReviewOptions(tx, booking);
      await this.assertWorkReviewScope(tx, actor, id, managed);
      await assertCapability(tx, actor, "BOOKING_CONFIRM");
      return jsonSafe(result);
    });
  }
  async reviewBookingWork(
    actor: AuthenticatedActor,
    id: string,
    input: BookingWorkReviewInput,
    context: RequestSecurityContext,
    managed = false,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      await this.assertWorkReviewScope(tx, actor, id, managed);
      await assertCapability(tx, actor, "BOOKING_CONFIRM");
      const booking = await this.repository.lockBooking(id, tx);
      if (!booking) throw serviceOperationNotFound();
      const review = await reviewStartedBookingWork(tx, actor, booking, input);
      await tx.bookingRescheduleRequest.updateMany({
        where: { bookingId: id, status: "PENDING" },
        data: {
          status: "SUPERSEDED",
          decidedAt: new Date(),
          decidedByUserId: actor.userId,
          decisionReason:
            "Work has a recorded start. Review any further change with the workshop; the original visit was not moved.",
        },
      });
      await cancelPendingReminders(tx, id);
      const updated = await this.repository.staffBooking(id, actor.role !== "STAFF", tx);
      if (!updated) throw serviceOperationNotFound();
      const customer = await tx.customerProfile.findUniqueOrThrow({
        where: { id: booking.customerId },
        select: { userId: true },
      });
      await enqueueNotification(tx, {
        userId: customer.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Work estimate reviewed",
        message:
          "The workshop has updated its estimate for the remaining work. View your booking for the review time and estimate. This is not a promised completion or vehicle-collection time.",
        resourceType: "BOOKING",
        resourceId: id,
        deduplicationKey: "booking:" + id + ":work-review:" + review.id,
        channels: ["EMAIL"],
      });
      await this.auditBooking(tx, actor, booking, updated, context);
      await this.assertWorkReviewScope(tx, actor, id, managed);
      await assertCapability(tx, actor, "BOOKING_CONFIRM");
      await lockAccessActor(tx, actor);
      return jsonSafe({
        id,
        branchId: updated.branchId,
        serviceId: updated.serviceId,
        staffId: updated.assignedStaffId,
        version: updated.version,
        scheduleVersion: updated.scheduleVersion,
        status: updated.status,
        scheduledAt: updated.scheduledAt,
        startedAt: updated.startedAt,
        performedByUserId: actor.userId,
        review: {
          id: review.id,
          bookingVersion: review.bookingVersion,
          resourcePolicyVersionId: review.policyVersionId,
          performedByUserId: actor.userId,
          reviewedAt: review.workReviewedAt,
          remainingMinutes: review.remainingMinutes,
          cleanupMinutes: review.cleanupMinutes,
          expectedWorkEndsAt: review.expectedWorkEndsAt,
          resourceIds: review.resourceIds,
          reason: review.reason,
        },
      });
    });
  }

  async overrideBookingTiming(
    actor: AuthenticatedActor,
    id: string,
    input: BookingTimingOverrideInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      const booking = await this.lockAuthorizedStaffBooking(actor, id, tx);
      const updated = await this.changeLockedBookingTiming(
        tx,
        actor,
        booking,
        input,
        context,
      );
      return jsonSafe({ ...updated, performedByUserId: actor.userId });
    });
  }
  async overrideWorkforceBookingTiming(
    actor: AuthenticatedActor,
    id: string,
    input: BookingTimingOverrideInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      const scope = async () => {
        const access = await workforceSnapshot(tx, actor);
        if (
          !access.managed ||
          !access.independentCapabilities.includes("BOOKING_CONFIRM")
        )
          workforceDenied();
        if (
          !(await tx.booking.findFirst({
            where: { AND: [{ id }, bookingScope(access, "BOOKINGS_READ")] },
            select: { id: true },
          }))
        )
          workforceNotFound();
      };
      await scope();
      const booking = await this.repository.lockBooking(id, tx);
      if (!booking) workforceNotFound();
      await scope();
      const updated = await this.changeLockedBookingTiming(
        tx,
        actor,
        booking,
        input,
        context,
        scope,
      );
      const timing = updated.timingSnapshots.find(
        (row) => row.scheduleVersion === updated.scheduleVersion,
      );
      if (!timing)
        throw serviceOperationConflict("The saved timing could not be verified");
      return jsonSafe({
        id: updated.id,
        branchId: updated.branchId,
        version: updated.version,
        scheduleVersion: updated.scheduleVersion,
        scheduledAt: updated.scheduledAt,
        status: updated.status,
        timing,
        performedByUserId: actor.userId,
      });
    });
  }
  private async changeLockedBookingTiming(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    booking: NonNullable<Awaited<ReturnType<ServiceOperationsRepository["lockBooking"]>>>,
    input: BookingTimingOverrideInput,
    context: RequestSecurityContext,
    scope?: () => Promise<void>,
  ) {
    await assertCapability(tx, actor, "BOOKING_CONFIRM");
    if (booking.version !== input.expectedVersion) throw staleServiceOperation();
    if (
      !["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED"].includes(booking.status) ||
      booking.startedAt !== null ||
      !booking.serviceId ||
      !booking.service
    )
      throw serviceOperationConflict(
        "Only an assessed appointment whose work has not started can have its estimate changed",
      );
    if (!booking.assignedStaffId)
      throw serviceOperationConflict(
        "Assign the actual technician before reviewing appointment timing",
      );
    if (booking.scheduledAt <= new Date())
      throw serviceOperationConflict(
        "Review a future appointment; arrival and work in progress need the operational workflow",
      );
    const occupied = timingWindow(booking.scheduledAt, input);
    await captureBookingTiming(tx, booking, actor.userId, true);
    await assertBookingCapacity(
      tx,
      { ...booking, service: { durationMinutes: input.durationMinutes } },
      input.resourceReviewNote,
      input,
    );
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${booking.assignedStaffId}`},0))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${booking.customerId}`},0))`;
    if (
      (await this.repository.hasScheduleConflict(
        booking.assignedStaffId,
        occupied.startsAt,
        occupied.endsAt,
        booking.id,
        tx,
      )) ||
      (await this.repository.hasCustomerScheduleConflict(
        booking.customerId,
        booking.scheduledAt,
        occupied.jobEndsAt,
        booking.id,
        tx,
      ))
    )
      throw scheduleConflict();

    const result = await this.repository.updateBooking(
      booking.id,
      input.expectedVersion,
      { scheduleVersion: { increment: 1 } },
      tx,
    );
    if (result.count !== 1) throw staleServiceOperation();
    await tx.bookingTimingSnapshot.create({
      data: {
        bookingId: booking.id,
        scheduleVersion: booking.scheduleVersion + 1,
        scheduledAt: booking.scheduledAt,
        serviceVersion: booking.service.version,
        durationMinutes: input.durationMinutes,
        preparationMinutes: input.preparationMinutes,
        cleanupMinutes: input.cleanupMinutes,
        serviceId: booking.serviceId,
        source: "APPOINTMENT_OVERRIDE",
        reason: input.reason,
        createdByUserId: actor.userId,
      },
    });
    await tx.bookingRescheduleRequest.updateMany({
      where: { bookingId: booking.id, status: "PENDING" },
      data: {
        status: "SUPERSEDED",
        decidedByUserId: actor.userId,
        decidedAt: new Date(),
        decisionReason:
          "Staff reviewed this appointment's timing again; request another change if needed",
      },
    });
    const updated = await this.repository.staffBooking(
      booking.id,
      actor.role !== "STAFF",
      tx,
    );
    if (!updated) throw serviceOperationNotFound();
    await allocateBookingResources(tx, actor, booking.id, input.resourceReviewNote);
    if (updated.status === "CONFIRMED") await scheduleReminders(tx, updated);
    const customer = await tx.customerProfile.findUniqueOrThrow({
      where: { id: booking.customerId },
      select: { userId: true },
    });
    await enqueueNotification(tx, {
      userId: customer.userId,
      type: "BOOKING",
      category: "TRANSACTIONAL",
      title: "Appointment estimate updated",
      message:
        "The workshop reviewed your estimated job time. Your appointment time and status remain unchanged. View your booking for the current estimate.",
      resourceType: "BOOKING",
      resourceId: booking.id,
      deduplicationKey: `booking:${booking.id}:timing:${updated.scheduleVersion}`,
      channels: ["EMAIL"],
    });
    await this.auditBooking(tx, actor, booking, updated, context);
    await assertCapability(tx, actor, "BOOKING_CONFIRM");
    if (scope) await scope();
    await lockAccessActor(tx, actor);
    return updated;
  }

  async cancelBooking(
    actor: AuthenticatedActor,
    id: string,
    input: BookingCancelInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockOwnedCustomerBooking(actor.userId, id, transaction);
      if (booking.status === "CANCELLED") return jsonSafe(customerSafeBooking(booking));
      // Customer self-service ends when work starts; staff retain the separate operational transition.
      if (
        booking.startedAt !== null ||
        !["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED"].includes(booking.status)
      )
        throw serviceOperationConflict(
          "Contact the workshop about work that has started or already ended",
        );
      const now = new Date();
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {
          status: "CANCELLED",
          cancellationReason: input.reason,
          cancelledAt: now,
        },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      if (booking.depositPayment !== null)
        await transaction.payment.updateMany({
          where: {
            id: booking.depositPayment.id,
            status: { in: ["REQUIRES_PAYMENT", "PROCESSING", "REQUIRES_REVIEW"] },
          },
          data: { status: "CANCELLED", cancelledAt: now },
        });
      await cancelPendingReminders(transaction, id);
      await transaction.bookingRescheduleRequest.updateMany({
        where: { bookingId: id, status: "PENDING" },
        data: {
          status: "SUPERSEDED",
          decidedByUserId: actor.userId,
          decidedAt: new Date(),
          decisionReason: "Customer cancelled the appointment",
        },
      });
      const updated = await this.repository.customerBooking(id, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await enqueueNotification(transaction, {
        userId: actor.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Booking cancelled",
        message:
          booking.depositPaidAt === null
            ? "Your booking was cancelled and the unpaid slot hold was released."
            : "Your booking was cancelled without a cancellation fee. Any existing payment requires a reviewed refund; no deposit is forfeited.",
        resourceType: "BOOKING",
        resourceId: id,
        deduplicationKey: `booking:${id}:cancelled:${updated.version}`,
        channels: ["EMAIL"],
      });
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe(customerSafeBooking(updated));
    });
  }

  async staffBookings(actor: AuthenticatedActor, query: StaffBookingListQuery) {
    assertPrivilegedActor(actor);
    const profile = await this.repository.staffProfile(actor.userId);
    if (
      actor.role === "STAFF" &&
      (profile === null || profile.branchId === null || profile.branch?.isActive !== true)
    )
      throw serviceOperationForbidden();
    return jsonSafe(
      page(
        await this.repository
          .listStaffBookings(
            query,
            actor.role === "STAFF" ? profile!.branchId : null,
            actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
          )
          .then((rows) => rows.map(bookingWithWorkEstimate)),
        query.limit,
      ),
    );
  }

  async staffBooking(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
  ) {
    const booking = await this.authorizedStaffBooking(actor, id);
    await this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "BOOKING",
        entityId: id,
        newValues: { privilegedRead: true },
        context,
      }),
    );
    return jsonSafe(booking);
  }

  async assignBooking(
    actor: AuthenticatedActor,
    id: string,
    input: BookingAssignmentInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await lockWorkforce(transaction);
      const booking = await this.lockAuthorizedStaffBooking(
        actor,
        id,
        transaction,
        false,
      );
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${input.assignedStaffId}`}, 0))`;
      if (!activeBookingStatuses.includes(booking.status))
        throw invalidServiceTransition();
      const target = await this.repository.assignableStaff(
        input.assignedStaffId,
        transaction,
      );
      if (
        target === null ||
        target.branchId === null ||
        booking.branchId === null ||
        target.branchId !== booking.branchId
      )
        throw serviceOperationForbidden();
      const actorProfile = await this.repository.staffProfile(actor.userId, transaction);
      if (actor.role === "STAFF" && actorProfile?.id !== target.id)
        throw serviceOperationForbidden();
      assertPublishedSlotAssignment(booking, target.id);
      let service = booking.service;
      if (input.serviceId && booking.serviceId && input.serviceId !== booking.serviceId)
        throw serviceOperationConflict(
          "The selected service cannot be changed during assignment",
        );
      if (!service) {
        if (!input.serviceId)
          throw serviceOperationConflict(
            "Choose the service for this concern before assignment",
          );
        await transaction.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${input.serviceId}::uuid FOR SHARE`;
        service = await this.repository.service(input.serviceId, true, transaction);
        if (!service || service.currency !== "NGN") throw serviceOperationNotFound();
      }
      const occupied = await assignmentTimingWindow(
        transaction,
        booking,
        actor.userId,
        booking.serviceId === null ? input.serviceId : undefined,
      );
      const end = occupied.endsAt;
      if (
        await this.repository.hasScheduleConflict(
          target.id,
          occupied.startsAt,
          end,
          booking.id,
          transaction,
        )
      )
        throw scheduleConflict();
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {
          assignedStaffId: target.id,
          ...(booking.serviceId === null
            ? {
                serviceId: service.id,
                quotedPriceKobo:
                  service.pricingType === "FIXED" ? service.priceKobo : null,
              }
            : {}),
        },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      await captureAssessedTimingIfMissing(
        transaction,
        { ...booking, serviceId: booking.serviceId ?? input.serviceId ?? null },
        actor.userId,
      );
      await allocateBookingResources(
        transaction,
        actor,
        id,
        "Technician assignment reviewed against current workshop resources",
      );
      const updated = await this.repository.staffBooking(
        id,
        actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
        transaction,
      );
      if (updated === null) throw serviceOperationNotFound();
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe(updated);
    });
  }

  async transitionBooking(
    actor: AuthenticatedActor,
    id: string,
    input: BookingTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await lockWorkforce(transaction);
      const booking = await this.lockAuthorizedStaffBooking(
        actor,
        id,
        transaction,
        input.status !== "CONFIRMED",
      );
      return jsonSafe(
        await this.transitionLockedBooking(transaction, actor, booking, input, context),
      );
    });
  }

  async confirmWorkforceBooking(
    actor: AuthenticatedActor,
    id: string,
    input: Pick<BookingTransitionInput, "expectedVersion" | "resourceReviewNote">,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      const scope = async () => {
        const access = await workforceSnapshot(tx, actor);
        if (
          !access.managed ||
          !access.independentCapabilities.includes("BOOKING_CONFIRM")
        )
          workforceDenied();
        return bookingScope(access, "BOOKINGS_READ");
      };
      const permitted = async () =>
        tx.booking.findFirst({
          where: { AND: [{ id }, await scope()] },
          select: { id: true },
        });
      if (!(await permitted())) workforceNotFound();
      const booking = await this.repository.lockBooking(id, tx);
      if (!booking || !(await permitted())) workforceNotFound();
      try {
        await this.transitionLockedBooking(
          tx,
          actor,
          booking,
          { ...input, status: "CONFIRMED" },
          context,
        );
      } catch (error) {
        // Add only reviewed recovery codes to the new scoped contract. Legacy
        // responses and all original business checks retain their existing shape.
        if (
          error instanceof AppError &&
          error.statusCode === 409 &&
          error.code === "CONFLICT"
        ) {
          const message = error.message;
          const reason =
            message.startsWith("Policy configuration is missing: booking-capacity:") ||
            message.startsWith("This operation requires approved booking-capacity:") ||
            message === "Approved branch capacity and opening calendar are not configured"
              ? "CAPACITY_POLICY_REQUIRED"
              : message === "Approved branch daily capacity is full"
                ? "CAPACITY_FULL"
                : message === "Appointment is outside the approved workshop calendar"
                  ? "CALENDAR_CLOSED"
                  : message === "Assign an available staff member before confirmation"
                    ? "ASSIGNMENT_REQUIRED"
                    : undefined;
          if (reason)
            throw new AppError({
              code: `BOOKING_${reason}`,
              statusCode: error.statusCode,
              message,
            });
        }
        throw error;
      }
      // A time-based expiry while waiting on capacity/schedule locks must roll the
      // entire change back. All side effects above are transactional database rows.
      if (!(await permitted())) workforceNotFound();
      const receipt = await tx.booking.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          branchId: true,
          assignedStaffId: true,
          status: true,
          version: true,
          scheduledAt: true,
          confirmedAt: true,
          resourceReviewNote: true,
          capacityPolicyVersionId: true,
        },
      });
      return { ...receipt, performedByUserId: actor.userId };
    });
  }

  private async lockAttendanceBooking(
    actor: AuthenticatedActor,
    id: string,
    tx: Prisma.TransactionClient,
    managed: boolean,
  ) {
    await lockWorkforce(tx);
    await lockAccessActor(tx, actor);
    if (!managed || actor.role === "ADMIN" || actor.role === "SUPER_ADMIN")
      return {
        booking: await this.lockAuthorizedStaffBooking(actor, id, tx),
        recheck: async () => {},
      };
    const permitted = async () => {
      const access = await workforceSnapshot(tx, actor);
      if (!access.managed) workforceDenied();
      const scopes: Prisma.BookingWhereInput[] = [];
      if (
        access.independentCapabilities.includes("BOOKING_CONFIRM") &&
        access.permissions.includes("BOOKINGS_READ")
      )
        scopes.push(bookingScope(access, "BOOKINGS_READ"));
      if (access.permissions.includes("JOBS_UPDATE"))
        scopes.push(bookingScope(access, "JOBS_UPDATE"));
      if (!scopes.length) workforceDenied();
      return tx.booking.findFirst({
        where: { AND: [{ id }, { OR: scopes }] },
        select: { id: true },
      });
    };
    if (!(await permitted())) workforceNotFound();
    const booking = await this.repository.lockBooking(id, tx);
    if (!booking || !(await permitted())) workforceNotFound();
    return {
      booking,
      recheck: async () => {
        if (!(await permitted())) workforceNotFound();
      },
    };
  }

  async readBookingAttendance(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
    managed = false,
    receiptId?: string,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      const { booking, recheck } = await this.lockAttendanceBooking(
        actor,
        id,
        tx,
        managed,
      );
      const result = {
        ...(await attendanceSnapshot(tx, booking)),
        receipt: receiptId
          ? await tx.bookingAttendanceEvent.findFirst({
              where: { id: receiptId, bookingId: id, recordedByUserId: actor.userId },
              select: attendanceEventSelect,
            })
          : null,
      };
      await recheck();
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "BOOKING",
        entityId: id,
        newValues: { attendanceRead: true },
        context,
      });
      return jsonSafe(result);
    });
  }

  async recordBookingAttendance(
    actor: AuthenticatedActor,
    id: string,
    input: BookingAttendanceInput,
    context: RequestSecurityContext,
    managed = false,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (tx) => {
      const { booking, recheck } = await this.lockAttendanceBooking(
        actor,
        id,
        tx,
        managed,
      );
      const digest = attendanceDigest(actor.userId, id, input);
      const existing = await tx.bookingAttendanceEvent.findUnique({
        where: { id: input.operationId },
      });
      if (existing) {
        if (
          existing.bookingId !== id ||
          existing.recordedByUserId !== actor.userId ||
          existing.operationDigest !== digest
        )
          throw serviceOperationConflict(
            "This update reference was already used for another action",
          );
        const event = await tx.bookingAttendanceEvent.findUniqueOrThrow({
          where: { id: existing.id },
          select: attendanceEventSelect,
        });
        const attendance = await attendanceSnapshot(tx, booking);
        await recheck();
        return jsonSafe({ event, performedByUserId: actor.userId, attendance });
      }
      if (booking.version !== input.expectedVersion) throw staleServiceOperation();
      const now = new Date(),
        policy = await attendancePolicy(tx, booking.branchId, now);
      const previous = await tx.bookingAttendanceEvent.findFirst({
        where: { bookingId: id, scheduleVersion: booking.scheduleVersion },
        orderBy: { bookingVersion: "desc" },
        select: { kind: true },
      });
      const arrived = await tx.bookingAttendanceEvent.findFirst({
        where: {
          bookingId: id,
          scheduleVersion: booking.scheduleVersion,
          kind: { in: ["ARRIVED", "WAITING", "LEFT"] },
        },
        select: { id: true },
      });
      assertAttendanceAction(
        booking,
        input.kind,
        previous?.kind ?? null,
        !!arrived,
        policy.graceMinutes,
        now,
      );
      if (input.kind === "ABSENCE_CONFIRMED") {
        await this.transitionLockedBooking(
          tx,
          actor,
          booking,
          {
            status: "NO_SHOW",
            expectedVersion: input.expectedVersion,
            reason: input.reason!,
          },
          context,
          true,
        );
      } else {
        const result = await this.repository.updateBooking(
          id,
          input.expectedVersion,
          {},
          tx,
        );
        if (result.count !== 1) throw staleServiceOperation();
      }
      const event = await tx.bookingAttendanceEvent.create({
        data: {
          id: input.operationId,
          bookingId: id,
          recordedByUserId: actor.userId,
          bookingVersion: booking.version + 1,
          scheduleVersion: booking.scheduleVersion,
          kind: input.kind,
          reason: input.reason ?? "Arrival recorded by the workshop",
          operationDigest: digest,
          ...(input.kind === "ABSENCE_CONFIRMED"
            ? {
                graceMinutes: policy.graceMinutes,
                graceSource: policy.source,
                gracePolicyVersionId: policy.policyVersionId,
              }
            : {}),
        },
        select: attendanceEventSelect,
      });
      if (input.kind !== "ABSENCE_CONFIRMED") {
        const customer = await tx.customerProfile.findUniqueOrThrow({
          where: { id: booking.customerId },
          select: { userId: true },
        });
        await enqueueNotification(tx, {
          userId: customer.userId,
          type: "BOOKING",
          category: "TRANSACTIONAL",
          title: "Appointment attendance updated",
          message:
            input.kind === "ARRIVED"
              ? "The workshop has recorded your arrival."
              : input.kind === "WAITING"
                ? "You are waiting for an available turn. A new appointment time still needs confirmation."
                : "The workshop has recorded that you left. Contact the team or request another appointment time if needed.",
          resourceType: "BOOKING",
          resourceId: id,
          deduplicationKey: `booking:${id}:attendance:${input.operationId}`,
          channels: ["EMAIL"],
        });
      }
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "BOOKING",
        entityId: id,
        newValues: {
          attendanceEventId: event.id,
          kind: event.kind,
          reason: event.reason,
          scheduleVersion: event.scheduleVersion,
          bookingVersion: event.bookingVersion,
          graceMinutes: event.graceMinutes,
          graceSource: event.graceSource,
        },
        context,
      });
      const current = await this.repository.lockBooking(id, tx);
      if (!current) throw serviceOperationNotFound();
      const attendance = await attendanceSnapshot(tx, current);
      await recheck();
      return jsonSafe({ event, performedByUserId: actor.userId, attendance });
    });
  }

  private async transitionLockedBooking(
    transaction: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    booking: NonNullable<Awaited<ReturnType<ServiceOperationsRepository["lockBooking"]>>>,
    input: BookingTransitionInput,
    context: RequestSecurityContext,
    verifiedAbsence = false,
  ) {
    if (input.status === "NO_SHOW" && !verifiedAbsence)
      throw serviceOperationConflict(
        "Use Check attendance to record a staff absence verification",
      );
    const id = booking.id;
    if (!bookingTransitions[booking.status].includes(input.status))
      throw invalidServiceTransition();
    if (input.status === "CONFIRMED") {
      await assertCapability(transaction, actor, "BOOKING_CONFIRM");
      if (!booking.service)
        throw serviceOperationConflict(
          "Choose the service for this concern before confirmation",
        );
      const timing = await captureBookingTiming(transaction, booking, actor.userId);
      const occupied = timingWindow(booking.scheduledAt, timing);
      await assertBookingCapacity(
        transaction,
        {
          ...booking,
          service: { ...booking.service, durationMinutes: timing.durationMinutes },
        },
        input.resourceReviewNote,
        timing,
      );

      if (booking.assignedStaffId === null || timing.durationMinutes === null)
        throw serviceOperationConflict(
          "Assign an available staff member before confirmation",
        );
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${booking.assignedStaffId}`}, 0))`;
      const end = occupied.endsAt;
      if (
        await this.repository.hasScheduleConflict(
          booking.assignedStaffId,
          occupied.startsAt,
          end,
          booking.id,
          transaction,
        )
      )
        throw scheduleConflict();
    }
    if (input.status === "CANCELLED" && input.reason === undefined)
      throw serviceOperationConflict("A cancellation reason is required");
    if (input.status === "IN_PROGRESS" || input.status === "COMPLETED")
      await assertAgreedWorkCanProceed(transaction, id, input.status === "COMPLETED");
    const now = new Date();
    const timestamps: Prisma.BookingUncheckedUpdateManyInput = {
      status: input.status,
      ...(input.staffNotes === undefined ? {} : { staffNotes: input.staffNotes }),
      ...(input.status === "CONFIRMED" ? { confirmedAt: now } : {}),
      ...(input.status === "IN_PROGRESS" ? { startedAt: booking.startedAt ?? now } : {}),
      ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
      ...(input.status === "CANCELLED"
        ? { cancelledAt: now, cancellationReason: input.reason! }
        : {}),
    };
    const result = await this.repository.updateBooking(
      id,
      input.expectedVersion,
      timestamps,
      transaction,
    );
    if (result.count !== 1) throw staleServiceOperation();
    if (["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(input.status))
      await transaction.bookingRescheduleRequest.updateMany({
        where: { bookingId: id, status: "PENDING" },
        data: {
          status: "SUPERSEDED",
          decidedByUserId: actor.userId,
          decidedAt: new Date(),
          decisionReason:
            input.status === "IN_PROGRESS"
              ? "Work started on the original appointment"
              : input.status === "COMPLETED"
                ? "The original work was completed"
                : input.status === "CANCELLED"
                  ? "The original appointment was cancelled"
                  : "Staff recorded the original appointment as missed",
        },
      });
    const updated = await this.repository.staffBooking(
      id,
      actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
      transaction,
    );
    if (updated === null) throw serviceOperationNotFound();
    if (input.status === "CONFIRMED" || input.status === "IN_PROGRESS")
      await allocateBookingResources(
        transaction,
        actor,
        id,
        input.resourceReviewNote ??
          "Authorised work start; resource availability rechecked",
      );
    if (input.status === "CONFIRMED") await scheduleReminders(transaction, updated);
    if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(input.status))
      await cancelPendingReminders(transaction, id);
    if (input.status === "NO_SHOW") {
      const customer = await transaction.customerProfile.findUniqueOrThrow({
        where: { id: booking.customerId },
        select: { userId: true },
      });
      await enqueueNotification(transaction, {
        userId: customer.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Missed appointment",
        message:
          "The workshop checked attendance and recorded this appointment as missed. You can request another appointment. No automatic fee or forfeiture has been applied.",
        resourceType: "BOOKING",
        resourceId: id,
        deduplicationKey: `booking:${id}:schedule:${booking.scheduleVersion}:missed`,
        channels: ["EMAIL"],
      });
    }
    await this.auditBooking(transaction, actor, booking, updated, context);
    return updated;
  }

  async reportBusinessDisruption(
    actor: AuthenticatedActor,
    id: string,
    input: BookingDisruptionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockAuthorizedStaffBooking(actor, id, transaction);
      if (
        booking.status !== "CONFIRMED" ||
        booking.bookingSlotId === null ||
        booking.disruptionResolution === "PENDING"
      )
        throw invalidServiceTransition();
      const now = new Date();
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {
          disruptionRequestedAt: now,
          disruptionReason: input.reason,
          disruptionResolution: "PENDING",
        },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      await cancelPendingReminders(transaction, id);
      const updated = await this.repository.staffBooking(
        id,
        actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
        transaction,
      );
      if (updated === null) throw serviceOperationNotFound();
      const customer = await transaction.customerProfile.findUniqueOrThrow({
        where: { id: booking.customerId },
        select: { userId: true },
      });
      await enqueueNotification(transaction, {
        userId: customer.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Action required: booking disruption",
        message:
          "Allied AutoTech cannot fulfil this appointment. Request another published slot without using your customer reschedule, or cancel free. Any historical deposit is reviewed for refund.",
        resourceType: "BOOKING",
        resourceId: id,
        deduplicationKey: `booking:${id}:business-disruption:${updated.version}`,
        channels: ["EMAIL"],
      });
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe(updated);
    });
  }

  async resolveBusinessDisruption(
    actor: AuthenticatedActor,
    id: string,
    input: BookingDisruptionResolutionInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    const scope = `booking-disruption:${actor.userId}:${id}`;
    const keyHash = hashToken("booking-idempotency", `${scope}:${rawKey}`);
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-disruption:${keyHash}`}, 0))`;
      const prior = await this.repository.idempotency(scope, keyHash, transaction);
      if (prior !== null) {
        if (prior.status !== "COMPLETED" || prior.requestHash !== requestHash)
          throw serviceOperationConflict(
            "The idempotency key was already used for another request",
          );
        const replay = await this.repository.customerBooking(id, transaction);
        if (replay === null) throw serviceOperationNotFound();
        return jsonSafe({ booking: customerSafeBooking(replay), replayed: true });
      }
      const booking = await this.lockOwnedCustomerBooking(actor.userId, id, transaction);
      if (
        booking.version !== input.expectedVersion ||
        booking.status !== "CONFIRMED" ||
        booking.disruptionResolution !== "PENDING"
      )
        throw invalidServiceTransition();
      await this.repository.createIdempotency(
        actor.userId,
        scope,
        keyHash,
        requestHash,
        transaction,
      );
      if (input.resolution === "TRANSFER") {
        if (booking.bookingSlotId === null || input.slotId === booking.bookingSlotId)
          throw serviceOperationConflict("Choose a different booking slot");
        const slotIds = [booking.bookingSlotId, input.slotId].sort();
        for (const slotId of slotIds) {
          await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-slot:${slotId}`}, 0))`;
          await transaction.$queryRaw`SELECT "id" FROM "BookingSlot" WHERE "id" = ${slotId}::uuid FOR UPDATE`;
        }
        const replacement = await this.repository.bookingSlot(input.slotId, transaction);
        if (
          replacement === null ||
          replacement.status !== "OPEN" ||
          replacement.serviceId !== booking.serviceId ||
          replacement.branch.isActive !== true
        )
          throw serviceOperationNotFound();
        const originalTiming = await captureBookingTiming(
          transaction,
          booking,
          actor.userId,
          true,
        );
        await this.reviewOfferedSlot(transaction, replacement, booking.id);
        const replacementJobEnd = timingWindow(
          replacement.startsAt,
          originalTiming,
        ).jobEndsAt;
        assertWithinBookingWindow(replacement.startsAt);
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${booking.customerId}`}, 0))`;
        if (
          await this.repository.hasCustomerScheduleConflict(
            booking.customerId,
            replacement.startsAt,
            replacementJobEnd,
            booking.id,
            transaction,
          )
        )
          throw scheduleConflict();
        const changed = await this.repository.updateBooking(
          id,
          input.expectedVersion,
          {
            bookingSlotId: replacement.id,
            branchId: replacement.branchId,
            assignedStaffId: replacement.staffId,
            scheduledAt: replacement.startsAt,
            disruptionResolution: "TRANSFERRED",
            status: "REQUESTED",
            confirmedAt: null,
            attendanceConfirmedAt: null,
            capacityPolicyVersionId: null,
            resourceReviewNote: null,
            scheduleVersion: { increment: 1 },
          },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
        await carryBookingTiming(
          transaction,
          booking,
          {
            scheduleVersion: booking.scheduleVersion + 1,
            scheduledAt: replacement.startsAt,
          },
          actor.userId,
        );
        const updated = await this.repository.customerBooking(id, transaction);
        if (updated === null) throw serviceOperationNotFound();
        await cancelPendingReminders(transaction, id);
        await enqueueNotification(transaction, {
          userId: actor.userId,
          type: "BOOKING",
          category: "TRANSACTIONAL",
          title: "Booking transferred",
          message: `Your replacement appointment request for ${updated.scheduledAt.toISOString()} awaits staff confirmation. This did not use your customer reschedule.`,
          resourceType: "BOOKING",
          resourceId: id,
          deduplicationKey: `booking:${id}:disruption-transferred:${updated.scheduleVersion}`,
          channels: ["EMAIL"],
        });
      } else {
        if (!booking.depositPayment?.settledAttemptId)
          throw serviceOperationConflict("Deposit settlement is unavailable");
        await transaction.$queryRaw`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${booking.depositPayment.settledAttemptId}::uuid FOR UPDATE`;
        const attempt = await transaction.paymentAttempt.findUnique({
          where: { id: booking.depositPayment.settledAttemptId },
          select: { id: true, amountKobo: true, status: true, verificationStatus: true },
        });
        if (attempt === null)
          throw serviceOperationConflict("Deposit settlement is unavailable");
        if (attempt.status !== "SUCCESSFUL" || attempt.verificationStatus !== "VERIFIED")
          throw serviceOperationConflict("A verified captured deposit is required");
        const committed =
          (
            await transaction.refund.aggregate({
              where: {
                paymentAttemptId: attempt.id,
                status: { notIn: ["FAILED", "CANCELLED"] },
              },
              _sum: { amountKobo: true },
            })
          )._sum.amountKobo ?? 0n;
        if (
          committed + booking.depositAmountKobo! > attempt.amountKobo ||
          (await transaction.paymentDispute.count({
            where: { paymentAttemptId: attempt.id, status: { not: "WON" } },
          }))
        )
          throw serviceOperationConflict(
            "Reconcile existing refunds or disputes before requesting this deposit refund",
          );
        const refundPolicy = await approvedPolicy(transaction, "manual-refund");
        const refund = await transaction.refund.create({
          data: {
            policyVersionId: refundPolicy.id,
            policySnapshot: policySnapshot(refundPolicy),
            paymentAttemptId: attempt.id,
            requestedByUserId: actor.userId,
            refundNumber: refundNumber(),
            idempotencyKeyHash: hashToken(
              "refund-idempotency",
              `${attempt.id}:${rawKey}`,
            ),
            amountKobo: booking.depositAmountKobo!,
            currency: "NGN",
            reason: "Allied AutoTech booking disruption deposit refund",
          },
          select: { id: true },
        });
        const now = new Date();
        const changed = await this.repository.updateBooking(
          id,
          input.expectedVersion,
          {
            status: "CANCELLED",
            cancelledAt: now,
            cancellationReason: "Allied AutoTech booking disruption",
            disruptionResolution: "REFUND_REQUESTED",
          },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
        await appendAuditEvent(transaction, {
          actorUserId: actor.userId,
          action: "REFUND_REQUESTED",
          entityType: "REFUND",
          entityId: refund.id,
          newValues: {
            bookingId: id,
            amountKobo: booking.depositAmountKobo!.toString(),
          },
          context,
        });
        await enqueueNotification(transaction, {
          userId: actor.userId,
          type: "REFUND",
          category: "TRANSACTIONAL",
          title: "Deposit refund requested",
          message:
            "Your full booking deposit refund was requested and is awaiting independent approval. We will notify you when its status changes.",
          resourceType: "BOOKING",
          resourceId: id,
          deduplicationKey: `booking:${id}:disruption-refund-requested`,
          channels: ["EMAIL"],
        });
      }
      await this.repository.completeIdempotency(scope, keyHash, id, transaction, 200);
      const updated = await this.repository.customerBooking(id, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe({ booking: customerSafeBooking(updated), replayed: false });
    });
  }

  async createQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    input: QuoteCreateInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockAuthorizedStaffBooking(
        actor,
        bookingId,
        transaction,
      );
      if (!activeBookingStatuses.includes(booking.status))
        throw invalidServiceTransition();
      const staff = await this.repository.staffProfile(actor.userId, transaction);
      if (staff === null) throw serviceOperationForbidden();
      const expiresAt = this.futureExpiry(input.expiresAt);
      const lines = await this.priceLines(input.items, transaction);
      const latest = await this.repository.latestQuoteVersion(bookingId, transaction);
      const quote = await this.repository.createQuote(
        bookingId,
        staff.id,
        reference("Q"),
        (latest._max.version ?? 0) + 1,
        lines,
        basisPoints(
          lines.reduce((total, line) => total + line.subtotalKobo, 0n),
          750,
        ),
        input.notes,
        expiresAt,
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "QUOTE",
        entityId: quote.id,
        newValues: {
          bookingId,
          version: quote.version,
          revision: quote.revision,
          totalKobo: quote.totalKobo.toString(),
        },
        context,
      });
      return jsonSafe(quote);
    });
  }

  async replaceQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteReplaceInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await this.lockAuthorizedStaffBooking(actor, bookingId, transaction);
      const quote = await this.repository.quote(quoteId, bookingId, transaction);
      if (quote === null) throw serviceOperationNotFound();
      if (quote.status !== "DRAFT") throw invalidServiceTransition();
      const staff = await this.repository.staffProfile(actor.userId, transaction);
      if (staff === null) throw serviceOperationForbidden();
      const lines = await this.priceLines(input.items, transaction);
      const latest = await this.repository.latestQuoteVersion(bookingId, transaction);
      const updated = await this.repository.reviseQuote(
        quoteId,
        input.expectedRevision,
        bookingId,
        staff.id,
        reference("Q"),
        (latest._max.version ?? quote.version) + 1,
        lines,
        basisPoints(
          lines.reduce((total, line) => total + line.subtotalKobo, 0n),
          750,
        ),
        input.notes,
        this.futureExpiry(input.expiresAt),
        transaction,
      );
      if (updated === null) throw staleServiceOperation();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "QUOTE",
        entityId: updated.id,
        oldValues: { supersededQuoteId: quote.id, version: quote.version },
        newValues: {
          version: updated.version,
          revision: updated.revision,
          totalKobo: updated.totalKobo.toString(),
        },
        context,
      });
      return jsonSafe(updated);
    });
  }

  async issueQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await this.lockAuthorizedStaffBooking(actor, bookingId, transaction);
      const quote = await this.repository.quote(quoteId, bookingId, transaction);
      if (quote === null) throw serviceOperationNotFound();
      if (
        quote.status !== "DRAFT" ||
        quote.items.length === 0 ||
        quote.expiresAt === null ||
        quote.expiresAt <= new Date()
      )
        throw invalidServiceTransition();
      const finance = await assertFinanceGate(transaction);
      const now = new Date();
      const terms = await quotationTerms(transaction, now);
      await this.repository.voidOtherIssuedQuotes(bookingId, quoteId, now, transaction);
      const result = await this.repository.transitionQuote(
        quoteId,
        input.expectedRevision,
        ["DRAFT"],
        {
          status: "ISSUED",
          issuedAt: now,
          expiresAt: terms.expiresAt,
          policySnapshot: { ...policySnapshot(finance), quotation: terms.snapshot },
        },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.quote(quoteId, bookingId, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditQuote(transaction, actor, quote, updated, context);
      return jsonSafe(updated);
    });
  }

  async voidQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.staffQuoteTransition(actor, bookingId, quoteId, input, "VOID", context);
  }

  async expireQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.staffQuoteTransition(
      actor,
      bookingId,
      quoteId,
      input,
      "EXPIRED",
      context,
    );
  }

  async acceptQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    return this.customerQuoteTransition(
      actor,
      bookingId,
      quoteId,
      input,
      "ACCEPTED",
      context,
    );
  }

  async rejectQuote(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    context: RequestSecurityContext,
  ) {
    return this.customerQuoteTransition(
      actor,
      bookingId,
      quoteId,
      input,
      "REJECTED",
      context,
    );
  }

  async createWorkOrder(
    actor: AuthenticatedActor,
    bookingId: string,
    input: WorkOrderCreateInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockAuthorizedStaffBooking(
        actor,
        bookingId,
        transaction,
      );
      if (booking.status !== "CONFIRMED" || booking.workOrder !== null)
        throw invalidServiceTransition();
      if (booking.version !== input.expectedBookingVersion) throw staleServiceOperation();
      const agreement = await agreedServiceWork(transaction, bookingId);
      const lines = agreement
        ? priceAgreedWorkInputs(agreement.lines, input.items)
        : await this.priceLines(input.items, transaction);
      if (agreement && lines.length) assertAgreedWorkScope(agreement.lines, lines);
      const workOrder = await this.repository.createWorkOrder(
        bookingId,
        reference("WO"),
        input.diagnosis,
        input.internalNotes,
        lines,
        transaction,
      );
      if (input.diagnosis || input.internalNotes)
        await recordWorkContributor(transaction, workOrder.id, actor.userId);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "WORK_ORDER",
        entityId: workOrder.id,
        newValues: {
          bookingId,
          status: workOrder.status,
          itemCount: workOrder.items.length,
        },
        context,
      });
      return jsonSafe(workOrder);
    });
  }

  async updateWorkOrder(
    actor: AuthenticatedActor,
    bookingId: string,
    workOrderId: string,
    input: WorkOrderUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await this.lockAuthorizedStaffBooking(actor, bookingId, transaction);
      const existing = await this.repository.workOrder(
        workOrderId,
        bookingId,
        transaction,
      );
      if (existing === null) throw serviceOperationNotFound();
      if (existing.status === "COMPLETED" || existing.status === "CANCELLED")
        throw invalidServiceTransition();
      const agreement = input.addItems
        ? await agreedServiceWork(transaction, bookingId)
        : null;
      const lines =
        input.addItems === undefined
          ? undefined
          : agreement
            ? priceAgreedWorkInputs(agreement.lines, input.addItems)
            : await this.priceLines(input.addItems, transaction);
      if (agreement && lines) {
        const proposed = [...existing.items, ...lines];
        assertAgreedWorkScope(agreement.lines, proposed);
        if (existing.startedAt !== null)
          await assertAgreedMaterialsReady(transaction, agreement, proposed);
      }
      const updated = await this.repository.updateWorkOrder(
        workOrderId,
        input.expectedVersion,
        input.diagnosis,
        input.internalNotes,
        lines,
        transaction,
      );
      if (updated === null) throw staleServiceOperation();
      if (input.diagnosis !== undefined || input.internalNotes !== undefined)
        await recordWorkContributor(transaction, workOrderId, actor.userId);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "WORK_ORDER",
        entityId: workOrderId,
        oldValues: { version: existing.version },
        newValues: { version: updated.version, itemCount: updated.items.length },
        context,
      });
      return jsonSafe(updated);
    });
  }

  async transitionWorkOrder(
    actor: AuthenticatedActor,
    bookingId: string,
    workOrderId: string,
    input: WorkOrderTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertPrivilegedActor(actor);
    return this.database.$transaction(async (transaction) => {
      await lockWorkforce(transaction);
      const booking = await this.lockAuthorizedStaffBooking(
        actor,
        bookingId,
        transaction,
      );
      const workOrder = await this.repository.workOrder(
        workOrderId,
        bookingId,
        transaction,
      );
      if (workOrder === null) throw serviceOperationNotFound();
      if (!workTransitions[workOrder.status].includes(input.status))
        throw invalidServiceTransition();
      if (input.status === "APPROVED" && booking.status !== "CONFIRMED")
        throw invalidServiceTransition();
      if (["IN_PROGRESS", "QUALITY_CHECK", "COMPLETED"].includes(input.status))
        await assertAgreedWorkCanProceed(
          transaction,
          bookingId,
          input.status === "COMPLETED",
        );
      const now = new Date();
      const result = await this.repository.transitionWorkOrder(
        workOrderId,
        input.expectedVersion,
        [workOrder.status],
        {
          status: input.status,
          ...(input.status === "APPROVED" ? { openedAt: now } : {}),
          ...(input.status === "IN_PROGRESS" && workOrder.startedAt === null
            ? { startedAt: now }
            : {}),
          ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
          ...(input.status === "CANCELLED" ? { cancelledAt: now } : {}),
        },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      if (["IN_PROGRESS", "AWAITING_PARTS", "QUALITY_CHECK"].includes(input.status))
        await recordWorkContributor(transaction, workOrderId, actor.userId);
      if (input.status === "IN_PROGRESS" && booking.status === "CONFIRMED") {
        const changed = await this.repository.updateBooking(
          booking.id,
          booking.version,
          { status: "IN_PROGRESS", startedAt: booking.startedAt ?? now },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
        await allocateBookingResources(
          transaction,
          actor,
          booking.id,
          "Work-order start reviewed against current workshop resources",
        );
      }
      if (input.status === "COMPLETED" && booking.status === "IN_PROGRESS") {
        const changed = await this.repository.updateBooking(
          booking.id,
          booking.version,
          { status: "COMPLETED", completedAt: now },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
      }
      const updated = await this.repository.workOrder(
        workOrderId,
        bookingId,
        transaction,
      );
      if (updated === null) throw serviceOperationNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "WORK_ORDER",
        entityId: workOrderId,
        oldValues: { status: workOrder.status, version: workOrder.version },
        newValues: { status: updated.status, version: updated.version },
        context,
      });
      return jsonSafe(updated);
    });
  }

  private async ownedCustomerBooking(userId: string, id: string) {
    const [profile, booking] = await Promise.all([
      this.repository.customerProfile(userId),
      this.repository.customerBooking(id),
    ]);
    if (profile === null || booking === null || booking.customerId !== profile.id)
      throw serviceOperationNotFound();
    return booking;
  }

  private async lockOwnedCustomerBooking(
    userId: string,
    id: string,
    transaction: Prisma.TransactionClient,
  ) {
    const profile = await this.repository.customerProfile(userId, transaction);
    const booking = await this.repository.lockBooking(id, transaction);
    if (profile === null || booking === null || booking.customerId !== profile.id)
      throw serviceOperationNotFound();
    return booking;
  }

  private async authorizedStaffBooking(actor: AuthenticatedActor, id: string) {
    assertPrivilegedActor(actor);
    const [profile, booking] = await Promise.all([
      this.repository.staffProfile(actor.userId),
      this.repository.staffBooking(
        id,
        actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
      ),
    ]);
    if (booking === null) throw serviceOperationNotFound();
    if (
      actor.role === "STAFF" &&
      (profile === null ||
        profile.branchId === null ||
        profile.branch?.isActive !== true ||
        booking.branchId === null ||
        profile.branchId !== booking.branchId)
    )
      throw serviceOperationForbidden();
    return booking;
  }

  private async lockAuthorizedStaffBooking(
    actor: AuthenticatedActor,
    id: string,
    transaction: Prisma.TransactionClient,
    requireAssignment = true,
  ) {
    assertPrivilegedActor(actor);
    const profile = await this.repository.staffProfile(actor.userId, transaction);
    const booking = await this.repository.lockBooking(id, transaction);
    if (booking === null) throw serviceOperationNotFound();
    if (
      actor.role === "STAFF" &&
      (profile === null ||
        profile.branchId === null ||
        profile.branch?.isActive !== true ||
        booking.branchId === null ||
        profile.branchId !== booking.branchId)
    )
      throw serviceOperationForbidden();
    if (
      actor.role === "STAFF" &&
      requireAssignment &&
      booking.assignedStaffId !== profile!.id
    )
      throw serviceOperationForbidden();
    return booking;
  }

  private async priceLines(
    inputs: readonly ServiceLineItemInput[],
    transaction: Prisma.TransactionClient,
  ): Promise<PricedLine[]> {
    const productIds = [
      ...new Set(
        inputs.flatMap((line) => (line.type === "PART" ? [line.productId] : [])),
      ),
    ].sort();
    const products = await this.repository.products(productIds, transaction);
    if (products.length !== productIds.length) throw serviceOperationNotFound();
    const byId = new Map(products.map((product) => [product.id, product]));
    return inputs.map((line) => {
      const product = line.type === "PART" ? byId.get(line.productId) : undefined;
      if (line.type === "PART" && product === undefined) throw serviceOperationNotFound();
      const unitPriceKobo =
        line.type === "PART" ? product!.priceKobo : BigInt(line.unitPriceKobo);
      return {
        type: line.type,
        productId: line.type === "PART" ? line.productId : null,
        description:
          line.type === "PART" ? (line.description ?? product!.name) : line.description,
        quantity: line.quantity,
        unitPriceKobo,
        subtotalKobo: unitPriceKobo * BigInt(line.quantity),
      };
    });
  }

  private futureExpiry(value: string): Date {
    const expiresAt = new Date(value);
    if (expiresAt.getTime() <= Date.now())
      throw serviceOperationConflict("Quote expiry must be in the future");
    return expiresAt;
  }

  private async staffQuoteTransition(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    target: "VOID" | "EXPIRED",
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction(async (transaction) => {
      await this.lockAuthorizedStaffBooking(actor, bookingId, transaction);
      const quote = await this.repository.quote(quoteId, bookingId, transaction);
      if (quote === null) throw serviceOperationNotFound();
      if (
        target === "EXPIRED" &&
        (quote.expiresAt === null || quote.expiresAt > new Date())
      )
        throw invalidServiceTransition();
      const from =
        target === "VOID"
          ? quote.status === "DRAFT"
            ? (["DRAFT"] as const)
            : (["ISSUED"] as const)
          : (["ISSUED"] as const);
      if (!from.includes(quote.status as never)) throw invalidServiceTransition();
      const result = await this.repository.transitionQuote(
        quoteId,
        input.expectedRevision,
        from,
        target === "VOID" ? { status: target, voidedAt: new Date() } : { status: target },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.quote(quoteId, bookingId, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditQuote(transaction, actor, quote, updated, context);
      return jsonSafe(updated);
    });
  }

  private async customerQuoteTransition(
    actor: AuthenticatedActor,
    bookingId: string,
    quoteId: string,
    input: QuoteTransitionInput,
    target: "ACCEPTED" | "REJECTED",
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockOwnedCustomerBooking(
        actor.userId,
        bookingId,
        transaction,
      );
      const quote = await this.repository.quote(quoteId, bookingId, transaction);
      if (quote === null) throw serviceOperationNotFound();
      if (
        quote.status !== "ISSUED" ||
        quote.expiresAt === null ||
        quote.expiresAt <= new Date()
      )
        throw invalidServiceTransition();
      const now = new Date();
      const result = await this.repository.transitionQuote(
        quoteId,
        input.expectedRevision,
        ["ISSUED"],
        target === "ACCEPTED"
          ? { status: target, acceptedAt: now }
          : { status: target, rejectedAt: now },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      if (target === "ACCEPTED") {
        const changed = await this.repository.updateBooking(
          bookingId,
          booking.version,
          { quotedPriceKobo: quote.totalKobo },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
      }
      const updated = await this.repository.quote(quoteId, bookingId, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await this.auditQuote(transaction, actor, quote, updated, context);
      return jsonSafe(updated);
    });
  }

  private async auditBooking(
    transaction: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    oldBooking: {
      id: string;
      status: BookingStatus;
      version: number;
      assignedStaffId: string | null;
      scheduledAt: Date;
    },
    updated: {
      status: BookingStatus;
      version: number;
      assignedStaffId: string | null;
      scheduledAt: Date;
    },
    context: RequestSecurityContext,
  ) {
    await appendAuditEvent(transaction, {
      actorUserId: actor.userId,
      action: oldBooking.status === updated.status ? "UPDATE" : "STATUS_CHANGE",
      entityType: "BOOKING",
      entityId: oldBooking.id,
      oldValues: {
        status: oldBooking.status,
        version: oldBooking.version,
        assignedStaffId: oldBooking.assignedStaffId,
        scheduledAt: oldBooking.scheduledAt.toISOString(),
      },
      newValues: {
        status: updated.status,
        version: updated.version,
        assignedStaffId: updated.assignedStaffId,
        scheduledAt: updated.scheduledAt.toISOString(),
      },
      context,
    });
  }

  private async auditQuote(
    transaction: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    oldQuote: { id: string; status: string; revision: number },
    updated: { status: string; revision: number },
    context: RequestSecurityContext,
  ) {
    await appendAuditEvent(transaction, {
      actorUserId: actor.userId,
      action: "STATUS_CHANGE",
      entityType: "QUOTE",
      entityId: oldQuote.id,
      oldValues: { status: oldQuote.status, revision: oldQuote.revision },
      newValues: { status: updated.status, revision: updated.revision },
      context,
    });
  }
}

export const serviceOperationsService = new ServiceOperationsService();
