import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { readVehicleAssetTicket } from "../../common/security/asset-tickets.js";
import { hashToken } from "../../common/security/session-tokens.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { ObjectStoragePort } from "../../providers/storage/object-storage.port.js";
import { objectStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { VehicleSalesRepository } from "./vehicle-sales.repository.js";
import type {
  CustomerInspectionListQuery,
  CustomerTransactionListQuery,
  ExpireReservationsInput,
  HandoverCreateInput,
  HandoverTransitionInput,
  InspectionCreateInput,
  InspectionTransitionInput,
  NegotiationInput,
  ReservationInput,
  StaffInspectionListQuery,
  StaffTransactionListQuery,
  TransactionCreateInput,
  TransactionTransitionInput,
} from "./vehicle-sales.schemas.js";
import {
  assertVehicleSaleCustomer,
  assertVehicleSaleOperator,
} from "./vehicle-sales.policy.js";
import {
  vehicleReservationConflict,
  vehicleSaleConflict,
  vehicleSaleForbidden,
  vehicleSaleNotFound,
  vehicleSaleStale,
} from "./vehicle-sales.errors.js";
import {
  salesPage,
  vehicleSaleFingerprint,
  vehicleSaleJson,
} from "./vehicle-sales.types.js";

const inspectionTransitions = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "RESCHEDULED", "CANCELLED", "NO_SHOW"],
  RESCHEDULED: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
} as const;
const transactionTransitions = {
  ENQUIRY: ["INSPECTION_SCHEDULED", "NEGOTIATING", "CANCELLED"],
  INSPECTION_SCHEDULED: ["INSPECTION_COMPLETED", "NEGOTIATING", "CANCELLED"],
  INSPECTION_COMPLETED: ["NEGOTIATING", "CANCELLED"],
  NEGOTIATING: ["CANCELLED"],
  PAYMENT_PENDING: ["RESERVED", "CANCELLED", "EXPIRED"],
  RESERVED: ["PAYMENT_PENDING", "CANCELLED", "EXPIRED"],
  PARTIALLY_PAID: [],
  PAID: ["HANDOVER_PENDING"],
  HANDOVER_PENDING: [],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
} as const;
const reference = () =>
  `VTX-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;

export class VehicleSalesService {
  private readonly repository: VehicleSalesRepository;
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly storage: ObjectStoragePort = objectStorage,
  ) {
    this.repository = new VehicleSalesRepository(database);
  }
  async customerInspections(
    actor: AuthenticatedActor,
    query: CustomerInspectionListQuery,
  ) {
    assertVehicleSaleCustomer(actor);
    const customer = await this.repository.customer(actor.userId);
    if (customer === null) throw vehicleSaleNotFound();
    return vehicleSaleJson(
      salesPage(
        await this.repository.listCustomerInspections(customer.id, query),
        query.limit,
      ),
    );
  }
  async requestInspection(
    actor: AuthenticatedActor,
    input: InspectionCreateInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleCustomer(actor);
    if (new Date(input.preferredStartAt) <= new Date())
      throw vehicleSaleConflict("Inspection must be requested for a future time");
    return this.database.$transaction(async (transaction) => {
      const customer = await this.repository.customer(actor.userId, transaction);
      const listing = await this.repository.publicListing(
        input.vehicleListingId,
        transaction,
      );
      if (customer === null || listing === null) throw vehicleSaleNotFound();
      const inspection = await transaction.inspectionRequest.create({
        data: {
          customerId: customer.id,
          vehicleListingId: listing.id,
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerPhone: customer.phone,
          customerEmail: customer.user.email,
          preferredStartAt: new Date(input.preferredStartAt),
          preferredEndAt:
            input.preferredEndAt === undefined ? null : new Date(input.preferredEndAt),
          notes: input.notes ?? null,
        },
        select: { id: true },
      });
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "INSPECTION",
        entityId: inspection.id,
        newValues: { vehicleListingId: listing.id },
        context,
      });
      return vehicleSaleJson(
        await this.repository.inspection(inspection.id, transaction),
      );
    });
  }
  async staffInspections(actor: AuthenticatedActor, query: StaffInspectionListQuery) {
    assertVehicleSaleOperator(actor);
    const branchId = await this.allowedBranch(actor);
    if (
      actor.role === "STAFF" &&
      query.branchId !== undefined &&
      query.branchId !== branchId
    )
      throw vehicleSaleForbidden();
    return vehicleSaleJson(
      salesPage(await this.repository.listStaffInspections(query, branchId), query.limit),
    );
  }
  async transitionInspection(
    actor: AuthenticatedActor,
    id: string,
    input: InspectionTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const existing = await this.repository.lockInspection(id, transaction);
      if (existing === null) throw vehicleSaleNotFound();
      await this.assertBranch(actor, existing.vehicleListing.branchId, transaction);
      if (
        !(inspectionTransitions[existing.status] as readonly string[]).includes(
          input.status,
        )
      )
        throw vehicleSaleConflict("Invalid inspection lifecycle transition");
      const ownStaff = await this.repository.staff(actor.userId, transaction);
      if (ownStaff === null) throw vehicleSaleForbidden();
      const assignedStaffId =
        actor.role === "STAFF"
          ? ownStaff.id
          : (input.assignedStaffId ?? existing.assignedStaffId);
      if (["CONFIRMED", "RESCHEDULED"].includes(input.status) && assignedStaffId == null)
        throw vehicleSaleConflict("An assigned staff member is required");
      if (assignedStaffId !== null && assignedStaffId !== undefined) {
        const assignee = await transaction.staffProfile.findFirst({
          where: {
            id: assignedStaffId,
            branchId: existing.vehicleListing.branchId,
            user: { status: "ACTIVE", role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] } },
          },
          select: { id: true },
        });
        if (assignee === null) throw vehicleSaleNotFound();
      }
      const now = new Date();
      const result = await transaction.inspectionRequest.updateMany({
        where: { id, version: input.expectedVersion, status: existing.status },
        data: {
          status: input.status,
          assignedStaffId,
          ...(input.scheduledStartAt === undefined
            ? {}
            : { scheduledStartAt: new Date(input.scheduledStartAt) }),
          ...(input.scheduledEndAt === undefined
            ? {}
            : { scheduledEndAt: new Date(input.scheduledEndAt) }),
          ...(input.status === "CONFIRMED" ? { confirmedAt: now } : {}),
          ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
          ...(input.status === "CANCELLED"
            ? { cancelledAt: now, cancellationReason: input.reason ?? null }
            : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw vehicleSaleStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "INSPECTION",
        entityId: id,
        oldValues: { status: existing.status, version: existing.version },
        newValues: { status: input.status, assignedStaffId },
        context,
      });
      return vehicleSaleJson(await this.repository.inspection(id, transaction));
    });
  }
  async customerTransactions(
    actor: AuthenticatedActor,
    query: CustomerTransactionListQuery,
  ) {
    assertVehicleSaleCustomer(actor);
    const customer = await this.repository.customer(actor.userId);
    if (customer === null) throw vehicleSaleNotFound();
    return vehicleSaleJson(
      salesPage(
        await this.repository.listCustomerTransactions(customer.id, query),
        query.limit,
      ),
    );
  }
  async customerTransaction(actor: AuthenticatedActor, id: string) {
    assertVehicleSaleCustomer(actor);
    const customer = await this.repository.customer(actor.userId);
    const transaction = await this.repository.transaction(id);
    if (
      customer === null ||
      transaction === null ||
      transaction.customerId !== customer.id
    )
      throw vehicleSaleNotFound();
    return vehicleSaleJson(transaction);
  }
  async createTransaction(
    actor: AuthenticatedActor,
    input: TransactionCreateInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleCustomer(actor);
    return this.database.$transaction(async (transaction) => {
      const customer = await this.repository.customer(actor.userId, transaction);
      const listing = await this.repository.publicListing(
        input.vehicleListingId,
        transaction,
      );
      if (customer === null || listing === null) throw vehicleSaleNotFound();
      if (input.sourceInspectionId !== undefined) {
        const inspection = await this.repository.inspection(
          input.sourceInspectionId,
          transaction,
        );
        if (
          inspection === null ||
          inspection.customerId !== customer.id ||
          inspection.vehicleListingId !== listing.id ||
          inspection.status !== "COMPLETED"
        )
          throw vehicleSaleNotFound();
      }
      const created = await transaction.vehicleTransaction.create({
        data: {
          vehicleListingId: listing.id,
          customerId: customer.id,
          ...(input.sourceInspectionId === undefined
            ? {}
            : { sourceInspectionId: input.sourceInspectionId }),
          transactionNumber: reference(),
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerPhone: customer.phone,
          customerEmail: customer.user.email,
          askingPriceKobo: listing.priceKobo,
          currency: "NGN",
          status:
            input.sourceInspectionId === undefined ? "ENQUIRY" : "INSPECTION_COMPLETED",
          statusHistory: {
            create: {
              changedByUserId: actor.userId,
              toStatus:
                input.sourceInspectionId === undefined
                  ? "ENQUIRY"
                  : "INSPECTION_COMPLETED",
            },
          },
        },
        select: { id: true },
      });
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "VEHICLE_TRANSACTION",
        entityId: created.id,
        newValues: {
          vehicleListingId: listing.id,
          status:
            input.sourceInspectionId === undefined ? "ENQUIRY" : "INSPECTION_COMPLETED",
        },
        context,
      });
      return vehicleSaleJson(await this.repository.transaction(created.id, transaction));
    });
  }
  async staffTransactions(actor: AuthenticatedActor, query: StaffTransactionListQuery) {
    assertVehicleSaleOperator(actor);
    const branchId = await this.allowedBranch(actor);
    if (
      actor.role === "STAFF" &&
      query.branchId !== undefined &&
      query.branchId !== branchId
    )
      throw vehicleSaleForbidden();
    return vehicleSaleJson(
      salesPage(
        await this.repository.listStaffTransactions(query, branchId),
        query.limit,
      ),
    );
  }
  async staffTransaction(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleOperator(actor);
    const sale = await this.repository.transaction(id);
    if (sale === null) throw vehicleSaleNotFound();
    await this.assertBranch(actor, sale.vehicleListing.branchId);
    await this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "VEHICLE_TRANSACTION",
        entityId: id,
        newValues: { privilegedRead: true },
        context,
      }),
    );
    return vehicleSaleJson(sale);
  }
  async negotiate(
    actor: AuthenticatedActor,
    id: string,
    input: NegotiationInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const initial = await this.repository.transaction(id, transaction);
      if (initial === null) throw vehicleSaleNotFound();
      const listing = await this.repository.lockListing(
        initial.vehicleListingId,
        transaction,
      );
      const sale = await this.repository.lockTransaction(id, transaction);
      if (listing === null || sale === null) throw vehicleSaleNotFound();
      await this.assertBranch(actor, listing.branchId, transaction);
      if (!["ENQUIRY", "INSPECTION_COMPLETED", "NEGOTIATING"].includes(sale.status))
        throw vehicleSaleConflict("Negotiation is closed");
      if (
        await transaction.paymentAttempt.count({
          where: { payment: { vehicleTransactionId: id } },
        })
      )
        throw vehicleSaleConflict("Price is frozen after payment activity");
      const updated = await this.repository.updateTransaction(
        id,
        input.expectedVersion,
        sale.status,
        {
          status: "NEGOTIATING",
          agreedPriceKobo: BigInt(input.agreedPriceKobo),
          reservationRequiredKobo:
            input.reservationRequiredKobo == null
              ? null
              : BigInt(input.reservationRequiredKobo),
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
        transaction,
      );
      if (updated === null) throw vehicleSaleStale();
      await this.repository.history(
        id,
        actor.userId,
        sale.status,
        "NEGOTIATING",
        input.notes,
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "VEHICLE_TRANSACTION",
        entityId: id,
        oldValues: { status: sale.status, version: sale.version },
        newValues: {
          status: "NEGOTIATING",
          version: updated.version,
          agreedPriceKobo: input.agreedPriceKobo,
        },
        context,
      });
      return vehicleSaleJson(updated);
    });
  }
  async reserve(
    actor: AuthenticatedActor,
    id: string,
    input: ReservationInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleCustomer(actor);
    const scope = `vehicle-reservation:${actor.userId}`;
    const keyHash = hashToken("vehicle-reservation-idempotency", rawKey);
    const requestHash = vehicleSaleFingerprint({ id, ...input });
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`vehicle-reservation:${keyHash}`}, 0))`;
      const prior = await this.repository.idempotency(scope, keyHash, transaction);
      if (prior !== null) {
        if (prior.requestHash !== requestHash || prior.status !== "COMPLETED")
          throw vehicleSaleConflict("Idempotency key conflicts with another request");
        const transactionId =
          prior.responseBody !== null &&
          typeof prior.responseBody === "object" &&
          !Array.isArray(prior.responseBody)
            ? (prior.responseBody as { transactionId?: unknown }).transactionId
            : undefined;
        const replay =
          typeof transactionId === "string"
            ? await this.repository.transaction(transactionId, transaction)
            : null;
        if (replay === null) throw vehicleSaleNotFound();
        return vehicleSaleJson({ transaction: replay, replayed: true });
      }
      await this.repository.createIdempotency(
        actor.userId,
        scope,
        keyHash,
        requestHash,
        transaction,
      );
      const customer = await this.repository.customer(actor.userId, transaction);
      const initial = await this.repository.transaction(id, transaction);
      if (customer === null || initial === null || initial.customerId !== customer.id)
        throw vehicleSaleNotFound();
      const listing = await this.repository.lockListing(
        initial.vehicleListingId,
        transaction,
      );
      const sale = await this.repository.lockTransaction(id, transaction);
      if (
        listing === null ||
        sale === null ||
        listing.status !== "AVAILABLE" ||
        sale.status !== "NEGOTIATING" ||
        sale.agreedPriceKobo === null
      )
        throw vehicleReservationConflict();
      const expiresAt = new Date(Date.now() + 30 * 60_000);
      const listingUpdate = await transaction.vehicleListing.updateMany({
        where: { id: listing.id, version: listing.version, status: "AVAILABLE" },
        data: { status: "RESERVED", reservedAt: new Date(), version: { increment: 1 } },
      });
      if (listingUpdate.count !== 1) throw vehicleReservationConflict();
      const updated = await this.repository.updateTransaction(
        id,
        input.expectedVersion,
        sale.status,
        {
          status: "RESERVED",
          reservationExpiresAt: expiresAt,
          termsVersion: input.termsVersion,
          termsAcceptedAt: new Date(),
        },
        transaction,
      );
      if (updated === null) throw vehicleSaleStale();
      await this.repository.history(
        id,
        actor.userId,
        sale.status,
        "RESERVED",
        undefined,
        transaction,
      );
      await this.repository.completeIdempotency(scope, keyHash, id, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "VEHICLE_RESERVED",
        entityType: "VEHICLE_TRANSACTION",
        entityId: id,
        oldValues: { status: sale.status },
        newValues: { status: "RESERVED", reservationExpiresAt: expiresAt.toISOString() },
        context,
      });
      return vehicleSaleJson({ transaction: updated, replayed: false });
    });
  }
  async transition(
    actor: AuthenticatedActor,
    id: string,
    input: TransactionTransitionInput,
    context: RequestSecurityContext,
    internalExpiry = false,
  ) {
    assertVehicleSaleOperator(actor);
    if (
      ["RESERVED", "HANDOVER_PENDING", "COMPLETED", "EXPIRED"].includes(input.status) &&
      !(internalExpiry && input.status === "EXPIRED")
    )
      throw vehicleSaleConflict("This transition requires its dedicated workflow");
    return this.database.$transaction(async (transaction) => {
      const initial = await this.repository.transaction(id, transaction);
      if (initial === null) throw vehicleSaleNotFound();
      const listing = await this.repository.lockListing(
        initial.vehicleListingId,
        transaction,
      );
      const sale = await this.repository.lockTransaction(id, transaction);
      if (listing === null || sale === null) throw vehicleSaleNotFound();
      await this.assertBranch(actor, listing.branchId, transaction);
      if (
        !(transactionTransitions[sale.status] as readonly string[]).includes(input.status)
      )
        throw vehicleSaleConflict("Invalid vehicle transaction lifecycle transition");
      if (
        (input.status === "CANCELLED" || input.status === "EXPIRED") &&
        input.reason === undefined
      )
        throw vehicleSaleConflict("A reason is required");
      if (input.status === "PAYMENT_PENDING" && sale.agreedPriceKobo === null)
        throw vehicleSaleConflict("An agreed price is required before payment");
      const now = new Date();
      if (input.status === "PAYMENT_PENDING" && listing.status === "AVAILABLE") {
        const listingUpdate = await transaction.vehicleListing.updateMany({
          where: { id: listing.id, version: listing.version, status: "AVAILABLE" },
          data: {
            status: "RESERVED",
            reservedAt: now,
            version: { increment: 1 },
          },
        });
        if (listingUpdate.count !== 1) throw vehicleReservationConflict();
      }
      const updated = await this.repository.updateTransaction(
        id,
        input.expectedVersion,
        sale.status,
        {
          status: input.status,
          ...(input.status === "CANCELLED"
            ? { cancelledAt: now, cancellationReason: input.reason ?? null }
            : {}),
          ...(input.status === "EXPIRED"
            ? { expiredAt: now, cancellationReason: input.reason ?? null }
            : {}),
          ...(input.status === "PAYMENT_PENDING" && sale.reservationExpiresAt === null
            ? { reservationExpiresAt: new Date(now.getTime() + 30 * 60_000) }
            : {}),
        },
        transaction,
      );
      if (updated === null) throw vehicleSaleStale();
      if (
        ["CANCELLED", "EXPIRED"].includes(input.status) &&
        listing.status === "RESERVED"
      )
        await transaction.vehicleListing.update({
          where: { id: listing.id },
          data: { status: "AVAILABLE", reservedAt: null, version: { increment: 1 } },
        });
      await this.repository.history(
        id,
        actor.userId,
        sale.status,
        input.status,
        input.reason,
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action:
          input.status === "CANCELLED" || input.status === "EXPIRED"
            ? "VEHICLE_RELEASED"
            : "STATUS_CHANGE",
        entityType: "VEHICLE_TRANSACTION",
        entityId: id,
        oldValues: { status: sale.status, version: sale.version },
        newValues: { status: input.status, version: updated.version },
        context,
      });
      return vehicleSaleJson(updated);
    });
  }
  async expire(
    actor: AuthenticatedActor,
    input: ExpireReservationsInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleOperator(actor);
    if (actor.role === "STAFF") throw vehicleSaleForbidden();
    const candidates = await this.database.vehicleTransaction.findMany({
      where: {
        status: { in: ["PAYMENT_PENDING", "RESERVED"] },
        reservationExpiresAt: { lt: new Date() },
      },
      select: { id: true },
      orderBy: [{ reservationExpiresAt: "asc" }, { id: "asc" }],
      take: input.limit,
    });
    let expired = 0;
    for (const candidate of candidates) {
      const current = await this.repository.transaction(candidate.id);
      if (current === null) continue;
      await this.transition(
        actor,
        candidate.id,
        {
          expectedVersion: current.version,
          status: "EXPIRED",
          reason: "RESERVATION_EXPIRED",
        },
        context,
        true,
      );
      expired += 1;
    }
    return { expired };
  }

  async expireSystem(limit: number) {
    const candidates = await this.database.vehicleTransaction.findMany({
      where: {
        status: { in: ["PAYMENT_PENDING", "RESERVED"] },
        reservationExpiresAt: { lt: new Date() },
      },
      select: { id: true },
      orderBy: [{ reservationExpiresAt: "asc" }, { id: "asc" }],
      take: Math.max(1, Math.min(limit, 100)),
    });
    let expired = 0;
    for (const candidate of candidates) {
      await this.database.$transaction(async (transaction) => {
        const initial = await this.repository.transaction(candidate.id, transaction);
        if (initial === null) return;
        const listing = await this.repository.lockListing(
          initial.vehicleListingId,
          transaction,
        );
        const sale = await this.repository.lockTransaction(candidate.id, transaction);
        if (
          listing === null ||
          sale === null ||
          !["PAYMENT_PENDING", "RESERVED"].includes(sale.status) ||
          sale.reservationExpiresAt === null ||
          sale.reservationExpiresAt > new Date()
        )
          return;
        const inFlightPayment = await transaction.payment.findFirst({
          where: {
            vehicleTransactionId: sale.id,
            OR: [
              { status: { in: ["SUCCEEDED", "REQUIRES_REVIEW"] } },
              { attempts: { some: { status: { in: ["PROCESSING", "SUCCESSFUL"] } } } },
            ],
          },
          select: { id: true },
        });
        if (inFlightPayment !== null) return;
        const updated = await this.repository.updateTransaction(
          sale.id,
          sale.version,
          sale.status,
          {
            status: "EXPIRED",
            expiredAt: new Date(),
            cancellationReason: "RESERVATION_EXPIRED",
          },
          transaction,
        );
        if (updated === null) return;
        if (listing.status === "RESERVED")
          await transaction.vehicleListing.updateMany({
            where: { id: listing.id, status: "RESERVED", version: listing.version },
            data: { status: "AVAILABLE", reservedAt: null, version: { increment: 1 } },
          });
        await this.repository.history(
          sale.id,
          null,
          sale.status,
          "EXPIRED",
          "RESERVATION_EXPIRED",
          transaction,
        );
        await appendAuditEvent(transaction, {
          actorUserId: null,
          action: "VEHICLE_RELEASED",
          entityType: "VEHICLE_TRANSACTION",
          entityId: sale.id,
          oldValues: { status: sale.status, version: sale.version },
          newValues: { status: "EXPIRED", version: updated.version },
          context: {
            requestId: `worker:vehicle-expiry:${sale.id}`,
            ipAddress: null,
            userAgent: null,
          },
        });
        expired += 1;
      });
    }
    return { expired };
  }
  async createHandover(
    actor: AuthenticatedActor,
    id: string,
    input: HandoverCreateInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleOperator(actor);
    const initialAssetSale = await this.repository.transaction(id);
    if (initialAssetSale === null) throw vehicleSaleNotFound();
    let verifiedAsset: ReturnType<typeof readVehicleAssetTicket> | null = null;
    if (input.assetToken !== undefined) {
      try {
        verifiedAsset = readVehicleAssetTicket(input.assetToken);
        if (
          verifiedAsset.actorUserId !== actor.userId ||
          verifiedAsset.vehicleId !== initialAssetSale.vehicleListing.vehicle.id ||
          verifiedAsset.kind !== "HANDOVER" ||
          verifiedAsset.expiresAt < Date.now() ||
          !(await this.storage.verifyObject({
            key: verifiedAsset.objectKey,
            mimeType: verifiedAsset.mimeType,
            sizeBytes: verifiedAsset.sizeBytes,
            checksumSha256: verifiedAsset.checksumSha256,
          }))
        )
          throw new Error("Invalid handover asset");
      } catch {
        throw vehicleSaleConflict("Signed handover asset is invalid or expired");
      }
    }
    return this.database.$transaction(async (transaction) => {
      const initial = await this.repository.transaction(id, transaction);
      if (initial === null) throw vehicleSaleNotFound();
      const listing = await this.repository.lockListing(
        initial.vehicleListingId,
        transaction,
      );
      const sale = await this.repository.lockTransaction(id, transaction);
      if (listing === null || sale === null || sale.status !== "PAID")
        throw vehicleSaleConflict("Only a paid transaction can enter handover");
      await this.assertBranch(actor, listing.branchId, transaction);
      const staff = await this.repository.staff(actor.userId, transaction);
      if (staff === null) throw vehicleSaleForbidden();
      const handover = await transaction.vehicleHandover.create({
        data: {
          vehicleTransactionId: id,
          handledByStaffId: staff.id,
          recipientName: input.recipientName,
          recipientPhone: input.recipientPhone,
          odometerKm: input.odometerKm,
          keysDelivered: input.keysDelivered,
          signedDocumentObjectKey: verifiedAsset?.objectKey ?? null,
          signedDocumentSha256: verifiedAsset?.checksumSha256 ?? null,
        },
        select: { id: true },
      });
      const updated = await this.repository.updateTransaction(
        id,
        sale.version,
        "PAID",
        { status: "HANDOVER_PENDING", handoverPendingAt: new Date() },
        transaction,
      );
      if (updated === null) throw vehicleSaleStale();
      await this.repository.history(
        id,
        actor.userId,
        "PAID",
        "HANDOVER_PENDING",
        undefined,
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "VEHICLE_TRANSACTION",
        entityId: id,
        newValues: {
          handoverId: handover.id,
          signedEvidence: verifiedAsset !== null,
        },
        context,
      });
      return vehicleSaleJson(await this.repository.transaction(id, transaction));
    });
  }
  async transitionHandover(
    actor: AuthenticatedActor,
    transactionId: string,
    handoverId: string,
    input: HandoverTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const initial = await this.repository.transaction(transactionId, transaction);
      if (initial === null) throw vehicleSaleNotFound();
      const listing = await this.repository.lockListing(
        initial.vehicleListingId,
        transaction,
      );
      const sale = await this.repository.lockTransaction(transactionId, transaction);
      if (listing === null || sale === null) throw vehicleSaleNotFound();
      await this.assertBranch(actor, listing.branchId, transaction);
      await transaction.$queryRaw`SELECT "id" FROM "VehicleHandover" WHERE "id" = ${handoverId}::uuid FOR UPDATE`;
      const handover = await transaction.vehicleHandover.findFirst({
        where: { id: handoverId, vehicleTransactionId: transactionId },
        select: { id: true, status: true, version: true },
      });
      if (handover === null) throw vehicleSaleNotFound();
      const allowed =
        handover.status === "PENDING"
          ? ["READY", "CANCELLED"]
          : handover.status === "READY"
            ? ["COMPLETED", "CANCELLED"]
            : [];
      if (!allowed.includes(input.status))
        throw vehicleSaleConflict("Invalid handover lifecycle transition");
      const now = new Date();
      const result = await transaction.vehicleHandover.updateMany({
        where: {
          id: handoverId,
          version: input.expectedVersion,
          status: handover.status,
        },
        data: {
          status: input.status,
          ...(input.status === "READY" ? { readyAt: now } : {}),
          ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
          ...(input.status === "CANCELLED" ? { cancelledAt: now } : {}),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw vehicleSaleStale();
      if (input.status === "COMPLETED") {
        const updated = await this.repository.updateTransaction(
          transactionId,
          sale.version,
          "HANDOVER_PENDING",
          { status: "COMPLETED", completedAt: now },
          transaction,
        );
        if (updated === null) throw vehicleSaleStale();
        await transaction.vehicleListing.update({
          where: { id: listing.id },
          data: { status: "SOLD", soldAt: now, version: { increment: 1 } },
        });
        await this.repository.history(
          transactionId,
          actor.userId,
          "HANDOVER_PENDING",
          "COMPLETED",
          undefined,
          transaction,
        );
      }
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "VEHICLE_TRANSACTION",
        entityId: transactionId,
        oldValues: { handoverStatus: handover.status },
        newValues: { handoverStatus: input.status },
        context,
      });
      return vehicleSaleJson(
        await this.repository.transaction(transactionId, transaction),
      );
    });
  }
  async handoverAccess(
    actor: AuthenticatedActor,
    transactionId: string,
    handoverId: string,
    context: RequestSecurityContext,
  ) {
    assertVehicleSaleOperator(actor);
    const sale = await this.repository.transaction(transactionId);
    if (sale === null) throw vehicleSaleNotFound();
    await this.assertBranch(actor, sale.vehicleListing.branchId);
    const handover = await this.database.vehicleHandover.findFirst({
      where: { id: handoverId, vehicleTransactionId: transactionId },
      select: { id: true, signedDocumentObjectKey: true },
    });
    if (handover?.signedDocumentObjectKey == null) throw vehicleSaleNotFound();
    await this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "VEHICLE_TRANSACTION",
        entityId: transactionId,
        newValues: { privateHandoverId: handoverId },
        context,
      }),
    );
    return {
      url: await this.storage.createDownload(
        handover.signedDocumentObjectKey,
        `vehicle-handover-${handover.id}.pdf`,
      ),
      expiresInSeconds: env.ASSET_DOWNLOAD_TTL_SECONDS,
    };
  }
  private async allowedBranch(
    actor: AuthenticatedActor,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    if (actor.role !== "STAFF") return null;
    const staff = await this.repository.staff(actor.userId, client);
    if (staff?.branchId == null || staff.branch?.isActive !== true)
      throw vehicleSaleForbidden();
    return staff.branchId;
  }
  private async assertBranch(
    actor: AuthenticatedActor,
    branchId: string,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    const allowed = await this.allowedBranch(actor, client);
    if (actor.role === "STAFF" && allowed !== branchId) throw vehicleSaleForbidden();
  }
}
export const vehicleSalesService = new VehicleSalesService();
