import { createHash, randomUUID } from "node:crypto";

import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
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
  T extends {
    staffNotes: unknown;
    workOrder: null | { internalNotes: unknown };
    depositPayment: null | { settledAttemptId: unknown };
  },
>(booking: T) {
  const { staffNotes: _staffNotes, workOrder, depositPayment, ...safe } = booking;
  return {
    ...safe,
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
  version: "booking-deposit-v1",
  minimumAdvanceHours: 168,
  maximumAdvanceHours: 336,
  paymentHoldMinutes: 30,
  depositBasisPoints: 3000,
  depositRefundableForCustomerCancellation: false,
  customerRescheduleLimit: 1,
  customerRescheduleCutoffHours: 24,
  reminderHoursBeforeAppointment: [168, 72, 48, 24] as const,
});

const paymentNumber = () =>
  `PAY-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
const refundNumber = () =>
  `REF-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;

function bookingFingerprint(input: BookingCreateInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        slotId: input.slotId,
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

function formatNgn(amountKobo: bigint): string {
  const naira = amountKobo / 100n;
  const kobo = (amountKobo % 100n).toString().padStart(2, "0");
  return `NGN ${naira.toString()}.${kobo}`;
}

async function cancelPendingReminders(
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

export async function scheduleReminders(
  transaction: Prisma.TransactionClient,
  booking: { id: string; scheduledAt: Date; scheduleVersion: number },
): Promise<void> {
  const definitions = [
    ["SEVEN_DAYS", 168],
    ["THREE_DAYS", 72],
    ["TWO_DAYS", 48],
    ["ONE_DAY", 24],
  ] as const;
  await transaction.bookingReminder.createMany({
    data: definitions.map(([kind, hours]) => ({
      bookingId: booking.id,
      kind,
      scheduledFor: new Date(booking.scheduledAt.getTime() - hours * 3_600_000),
      scheduleVersion: booking.scheduleVersion,
    })),
    skipDuplicates: true,
  });
}

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
    return jsonSafe(service);
  }

  publicBookingPolicy() {
    return bookingPolicy;
  }

  async publicBookingSlots(serviceId: string, query: PublicBookingSlotListQuery) {
    const service = await this.repository.service(serviceId, true);
    if (
      service === null ||
      service.pricingType !== "FIXED" ||
      service.priceKobo === null ||
      service.durationMinutes === null
    )
      throw serviceOperationNotFound();
    const allowed = bookingWindow();
    const requestedFrom = query.from === undefined ? allowed.from : new Date(query.from);
    const requestedTo = query.to === undefined ? allowed.to : new Date(query.to);
    const from = requestedFrom > allowed.from ? requestedFrom : allowed.from;
    const to = requestedTo < allowed.to ? requestedTo : allowed.to;
    if (to < from) return { items: [] };
    return jsonSafe(
      page(
        await this.repository.publicBookingSlots(serviceId, {
          ...query,
          from: from.toISOString(),
          to: to.toISOString(),
        }),
        query.limit,
      ),
    );
  }

  async staffBookingSlots(actor: AuthenticatedActor, query: StaffBookingSlotListQuery) {
    assertPrivilegedActor(actor);
    const profile = await this.repository.staffProfile(actor.userId);
    if (profile === null) throw serviceOperationForbidden();
    if (
      actor.role === "STAFF" &&
      (profile.branchId === null || profile.branch?.isActive !== true)
    )
      throw serviceOperationForbidden();
    return jsonSafe(
      page(
        await this.repository.listBookingSlots(
          query,
          actor.role === "STAFF" ? profile.branchId : null,
        ),
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
      const [actorProfile, targetStaff, service, branch] = await Promise.all([
        this.repository.staffProfile(actor.userId, transaction),
        this.repository.assignableStaff(input.staffId, transaction),
        this.repository.service(input.serviceId, true, transaction),
        this.repository.branch(input.branchId, transaction),
      ]);
      if (
        actorProfile === null ||
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
        (actorProfile.id !== targetStaff.id || actorProfile.branchId !== input.branchId)
      )
        throw serviceOperationForbidden();
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-slot-staff:${input.staffId}`}, 0))`;
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      const conflict = await transaction.bookingSlot.count({
        where: {
          staffId: input.staffId,
          status: "OPEN",
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (conflict > 0) throw scheduleConflict();
      const slot = await this.repository.createBookingSlot(
        {
          branchId: input.branchId,
          serviceId: input.serviceId,
          staffId: input.staffId,
          startsAt,
          endsAt,
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
      const [profile, slot] = await Promise.all([
        this.repository.staffProfile(actor.userId, transaction),
        this.repository.lockBookingSlot(id, transaction),
      ]);
      if (profile === null || slot === null) throw serviceOperationNotFound();
      if (
        actor.role === "STAFF" &&
        (profile.id !== slot.staffId || profile.branchId !== slot.branchId)
      )
        throw serviceOperationForbidden();
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
        oldValues: { status: slot.status, version: slot.version },
        newValues: { status: result.status, version: result.version },
        context,
      });
      return jsonSafe(result);
    });
  }

  async adminServices(actor: AuthenticatedActor, query: AdminServiceListQuery) {
    assertServiceAdministrator(actor);
    return jsonSafe(page(await this.repository.listServices(query, false), query.limit));
  }

  async createService(
    actor: AuthenticatedActor,
    input: ServiceCreateInput,
    context: RequestSecurityContext,
  ) {
    assertServiceAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
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
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`service:${id}`}, 0))`;
      const existing = await this.repository.service(id, false, transaction);
      if (existing === null) throw serviceOperationNotFound();
      const nextPricing = input.pricingType ?? existing.pricingType;
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
      const updated = await this.repository.updateService(id, input, transaction);
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
            ? await this.repository.booking(bookingId, transaction)
            : null;
        if (replay === null) throw serviceOperationNotFound();
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
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-slot:${input.slotId}`}, 0))`;
      const slot = await this.repository.lockBookingSlot(input.slotId, transaction);
      if (
        slot === null ||
        slot.status !== "OPEN" ||
        slot.branch.isActive !== true ||
        slot.service.isActive !== true ||
        slot.service.pricingType !== "FIXED" ||
        slot.service.priceKobo === null ||
        slot.service.durationMinutes === null
      )
        throw serviceOperationNotFound();
      assertWithinBookingWindow(slot.startsAt);
      if (
        input.vehicleId !== undefined &&
        (await this.repository.ownedVehicle(profile.id, input.vehicleId, transaction)) ===
          null
      )
        throw serviceOperationNotFound();
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${profile.id}`}, 0))`;
      if (
        await this.repository.hasCustomerScheduleConflict(
          profile.id,
          slot.startsAt,
          slot.endsAt,
          null,
          transaction,
        )
      )
        throw scheduleConflict();
      const now = new Date();
      const holdExpiresAt = new Date(
        now.getTime() + bookingPolicy.paymentHoldMinutes * 60_000,
      );
      const depositAmountKobo =
        (slot.service.priceKobo * BigInt(bookingPolicy.depositBasisPoints) + 5000n) /
        10000n;
      const booking = await this.repository.createBooking(
        {
          customerId: profile.id,
          branchId: slot.branchId,
          serviceId: slot.serviceId,
          assignedStaffId: slot.staffId,
          bookingSlotId: slot.id,
          scheduledAt: slot.startsAt,
          status: "AWAITING_DEPOSIT",
          quotedPriceKobo: slot.service.priceKobo,
          currency: "NGN",
          paymentHoldExpiresAt: holdExpiresAt,
          depositBaseKobo: slot.service.priceKobo,
          depositBasisPoints: bookingPolicy.depositBasisPoints,
          depositAmountKobo,
          depositPolicyVersion: bookingPolicy.version,
          depositTermsAcceptedAt: now,
          ...(input.vehicleId === undefined ? {} : { vehicleId: input.vehicleId }),
          ...(input.customerNotes === undefined
            ? {}
            : { customerNotes: input.customerNotes }),
        },
        transaction,
      );
      const payment = await transaction.payment.create({
        data: {
          customerId: profile.id,
          bookingId: booking.id,
          paymentNumber: paymentNumber(),
          purpose: "BOOKING_DEPOSIT",
          amountKobo: depositAmountKobo,
          currency: "NGN",
          status: "REQUIRES_PAYMENT",
          idempotencyKeyHash: hashToken(
            "payment-intent-idempotency",
            `booking-deposit:${booking.id}`,
          ),
          expiresAt: holdExpiresAt,
          description: "Non-refundable service booking deposit",
        },
        select: { id: true },
      });
      const formattedAmount = formatNgn(depositAmountKobo);
      await enqueueNotification(transaction, {
        userId: actor.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Booking held for deposit payment",
        message: `Your booking is held for 30 minutes. Pay the non-refundable 30% deposit of ${formattedAmount} by ${holdExpiresAt.toISOString()} to confirm it.`,
        resourceType: "BOOKING",
        resourceId: booking.id,
        deduplicationKey: `booking:${booking.id}:deposit-required`,
        channels: ["EMAIL"],
        expiresAt: holdExpiresAt,
      });
      await this.repository.completeIdempotency(scope, keyHash, booking.id, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "BOOKING",
        entityId: booking.id,
        newValues: {
          branchId: booking.branchId,
          serviceId: booking.serviceId,
          status: booking.status,
          scheduledAt: booking.scheduledAt.toISOString(),
          depositAmountKobo: depositAmountKobo.toString(),
          paymentId: payment.id,
          policyVersion: bookingPolicy.version,
        },
        context,
      });
      const result = await this.repository.booking(booking.id, transaction);
      if (result === null) throw serviceOperationNotFound();
      return jsonSafe({ booking: customerSafeBooking(result), replayed: false });
    });
  }

  async rescheduleBooking(
    actor: AuthenticatedActor,
    id: string,
    input: BookingRescheduleInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (transaction) => {
      const booking = await this.lockOwnedCustomerBooking(actor.userId, id, transaction);
      if (
        booking.status !== "CONFIRMED" ||
        booking.bookingSlotId === null ||
        booking.depositPaidAt === null ||
        booking.customerRescheduleCount >= bookingPolicy.customerRescheduleLimit ||
        booking.scheduledAt.getTime() - Date.now() <
          bookingPolicy.customerRescheduleCutoffHours * 3_600_000
      )
        throw invalidServiceTransition();
      if (input.slotId === booking.bookingSlotId)
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
      assertWithinBookingWindow(replacement.startsAt);
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${booking.customerId}`}, 0))`;
      if (
        await this.repository.hasCustomerScheduleConflict(
          booking.customerId,
          replacement.startsAt,
          replacement.endsAt,
          booking.id,
          transaction,
        )
      )
        throw scheduleConflict();
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {
          bookingSlotId: replacement.id,
          branchId: replacement.branchId,
          assignedStaffId: replacement.staffId,
          scheduledAt: replacement.startsAt,
          customerRescheduleCount: { increment: 1 },
          scheduleVersion: { increment: 1 },
        },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const rescheduled = await this.repository.booking(id, transaction);
      if (rescheduled === null) throw serviceOperationNotFound();
      await cancelPendingReminders(transaction, id);
      await scheduleReminders(transaction, rescheduled);
      const updated = await this.repository.booking(id, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await enqueueNotification(transaction, {
        userId: actor.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Booking rescheduled",
        message: `Your booking has been moved to ${updated.scheduledAt.toISOString()}. Your existing deposit remains applied. Please reschedule at least 24 hours ahead if your plans change.`,
        resourceType: "BOOKING",
        resourceId: id,
        deduplicationKey: `booking:${id}:rescheduled:${updated.scheduleVersion}`,
        channels: ["EMAIL"],
      });
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe(customerSafeBooking(updated));
    });
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
      if (!bookingTransitions[booking.status].includes("CANCELLED"))
        throw invalidServiceTransition();
      const now = new Date();
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        {
          status: "CANCELLED",
          cancellationReason: input.reason,
          cancelledAt: now,
          ...(booking.depositPaidAt === null ? {} : { depositForfeitedAt: now }),
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
      const updated = await this.repository.booking(id, transaction);
      if (updated === null) throw serviceOperationNotFound();
      await enqueueNotification(transaction, {
        userId: actor.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Booking cancelled",
        message:
          booking.depositPaidAt === null
            ? "Your booking was cancelled and the unpaid slot hold was released."
            : "Your booking was cancelled. As accepted when booking, the 30% deposit is non-refundable and cannot be applied to the final balance.",
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
    if (profile === null) throw serviceOperationForbidden();
    if (
      actor.role === "STAFF" &&
      (profile.branchId === null || profile.branch?.isActive !== true)
    )
      throw serviceOperationForbidden();
    return jsonSafe(
      page(
        await this.repository.listStaffBookings(
          query,
          actor.role === "STAFF" ? profile.branchId : null,
        ),
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
      const duration = booking.service.durationMinutes;
      if (duration === null)
        throw serviceOperationConflict(
          "Service duration must be configured before assignment",
        );
      const end = new Date(booking.scheduledAt.getTime() + duration * 60_000);
      if (
        await this.repository.hasScheduleConflict(
          target.id,
          booking.scheduledAt,
          end,
          booking.id,
          transaction,
        )
      )
        throw scheduleConflict();
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        { assignedStaffId: target.id },
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.booking(id, transaction);
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
      const booking = await this.lockAuthorizedStaffBooking(actor, id, transaction);
      if (!bookingTransitions[booking.status].includes(input.status))
        throw invalidServiceTransition();
      if (
        booking.bookingSlotId !== null &&
        (input.status === "CONFIRMED" || input.status === "CANCELLED")
      )
        throw serviceOperationConflict(
          input.status === "CONFIRMED"
            ? "Deposit-backed bookings are confirmed only by verified payment"
            : "Use the business disruption workflow for a provider-caused cancellation",
        );
      if (input.status === "CONFIRMED") {
        if (booking.assignedStaffId === null || booking.service.durationMinutes === null)
          throw serviceOperationConflict(
            "Assign an available staff member before confirmation",
          );
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff-schedule:${booking.assignedStaffId}`}, 0))`;
        const end = new Date(
          booking.scheduledAt.getTime() + booking.service.durationMinutes * 60_000,
        );
        if (
          await this.repository.hasScheduleConflict(
            booking.assignedStaffId,
            booking.scheduledAt,
            end,
            booking.id,
            transaction,
          )
        )
          throw scheduleConflict();
      }
      if (input.status === "CANCELLED" && input.reason === undefined)
        throw serviceOperationConflict("A cancellation reason is required");
      const now = new Date();
      const timestamps: Prisma.BookingUncheckedUpdateManyInput = {
        status: input.status,
        ...(input.staffNotes === undefined ? {} : { staffNotes: input.staffNotes }),
        ...(input.status === "CONFIRMED" ? { confirmedAt: now } : {}),
        ...(input.status === "IN_PROGRESS" ? { startedAt: now } : {}),
        ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
        ...(input.status === "CANCELLED"
          ? { cancelledAt: now, cancellationReason: input.reason! }
          : {}),
        ...(input.status === "NO_SHOW" && booking.depositPaidAt !== null
          ? { depositForfeitedAt: now }
          : {}),
      };
      const result = await this.repository.updateBooking(
        id,
        input.expectedVersion,
        timestamps,
        transaction,
      );
      if (result.count !== 1) throw staleServiceOperation();
      const updated = await this.repository.booking(id, transaction);
      if (updated === null) throw serviceOperationNotFound();
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
          title: "Booking marked as no-show",
          message:
            "This appointment was marked as a no-show. The accepted deposit is non-refundable. Please create a new booking and deposit to reschedule.",
          resourceType: "BOOKING",
          resourceId: id,
          deduplicationKey: `booking:${id}:no-show`,
          channels: ["EMAIL"],
        });
      }
      await this.auditBooking(transaction, actor, booking, updated, context);
      return jsonSafe(updated);
    });
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
        booking.depositPaidAt === null ||
        booking.disruptionRequestedAt !== null
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
      const updated = await this.repository.booking(id, transaction);
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
          "Allied AutoTech cannot fulfil this appointment. Choose another published slot without using your customer reschedule, or request a full deposit refund.",
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
        const replay = await this.repository.booking(id, transaction);
        if (replay === null) throw serviceOperationNotFound();
        return jsonSafe({ booking: customerSafeBooking(replay), replayed: true });
      }
      const booking = await this.lockOwnedCustomerBooking(actor.userId, id, transaction);
      if (
        booking.version !== input.expectedVersion ||
        booking.status !== "CONFIRMED" ||
        booking.disruptionResolution !== "PENDING" ||
        booking.depositPaidAt === null ||
        booking.depositPayment?.status !== "SUCCEEDED"
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
        assertWithinBookingWindow(replacement.startsAt);
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-schedule:${booking.customerId}`}, 0))`;
        if (
          await this.repository.hasCustomerScheduleConflict(
            booking.customerId,
            replacement.startsAt,
            replacement.endsAt,
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
            scheduleVersion: { increment: 1 },
          },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
        const updated = await this.repository.booking(id, transaction);
        if (updated === null) throw serviceOperationNotFound();
        await scheduleReminders(transaction, updated);
        await enqueueNotification(transaction, {
          userId: actor.userId,
          type: "BOOKING",
          category: "TRANSACTIONAL",
          title: "Booking transferred",
          message: `Your booking and deposit were transferred to ${updated.scheduledAt.toISOString()}. This did not use your customer reschedule.`,
          resourceType: "BOOKING",
          resourceId: id,
          deduplicationKey: `booking:${id}:disruption-transferred:${updated.scheduleVersion}`,
          channels: ["EMAIL"],
        });
      } else {
        if (booking.depositPayment.settledAttemptId === null)
          throw serviceOperationConflict("Deposit settlement is unavailable");
        const attempt = await transaction.paymentAttempt.findUnique({
          where: { id: booking.depositPayment.settledAttemptId },
          select: { id: true },
        });
        if (attempt === null)
          throw serviceOperationConflict("Deposit settlement is unavailable");
        const refund = await transaction.refund.create({
          data: {
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
      const updated = await this.repository.booking(id, transaction);
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
        BigInt(input.taxKobo),
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
        BigInt(input.taxKobo),
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
      const now = new Date();
      await this.repository.voidOtherIssuedQuotes(bookingId, quoteId, now, transaction);
      const result = await this.repository.transitionQuote(
        quoteId,
        input.expectedRevision,
        ["DRAFT"],
        { status: "ISSUED", issuedAt: now },
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
      const lines = await this.priceLines(input.items, transaction);
      const workOrder = await this.repository.createWorkOrder(
        bookingId,
        reference("WO"),
        input.diagnosis,
        input.internalNotes,
        lines,
        transaction,
      );
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
      const lines =
        input.addItems === undefined
          ? undefined
          : await this.priceLines(input.addItems, transaction);
      const updated = await this.repository.updateWorkOrder(
        workOrderId,
        input.expectedVersion,
        input.diagnosis,
        input.internalNotes,
        lines,
        transaction,
      );
      if (updated === null) throw staleServiceOperation();
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
      if (input.status === "IN_PROGRESS" && booking.status === "CONFIRMED") {
        const changed = await this.repository.updateBooking(
          booking.id,
          booking.version,
          { status: "IN_PROGRESS", startedAt: now },
          transaction,
        );
        if (changed.count !== 1) throw staleServiceOperation();
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
      this.repository.booking(id),
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
      this.repository.booking(id),
    ]);
    if (profile === null || booking === null) throw serviceOperationNotFound();
    if (
      actor.role === "STAFF" &&
      (profile.branchId === null ||
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
    const profile = await this.repository.staffProfile(actor.userId, transaction);
    const booking = await this.repository.lockBooking(id, transaction);
    if (profile === null || booking === null) throw serviceOperationNotFound();
    if (
      actor.role === "STAFF" &&
      (profile.branchId === null ||
        booking.branchId === null ||
        profile.branchId !== booking.branchId)
    )
      throw serviceOperationForbidden();
    if (
      actor.role === "STAFF" &&
      requireAssignment &&
      booking.assignedStaffId !== profile.id
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
