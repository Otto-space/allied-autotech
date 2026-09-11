import { createHash } from "node:crypto";
import { prisma } from "../config/database.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { appendAuditEvent } from "../modules/audit/audit.service.js";
import { enqueueNotification } from "../modules/notifications/notifications.service.js";
import { ordersService, type OrdersService } from "../modules/orders/orders.service.js";
import {
  vehicleSalesService,
  type VehicleSalesService,
} from "../modules/vehicle-sales/vehicle-sales.service.js";

export interface ExpirationResult {
  bookingHolds: number;
  orders: number;
  vehicleReservations: number;
  quotes: number;
  inventoryReservations: number;
  idempotencyRecords: number;
}

export class ExpirationWorker {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly orderService: OrdersService = ordersService,
    private readonly vehicleService: VehicleSalesService = vehicleSalesService,
  ) {}

  async runOnce(batchSize = 25): Promise<ExpirationResult> {
    const limit = Math.max(1, Math.min(batchSize, 100));
    const orders = (await this.orderService.expireDueSystem(limit)).expired;
    const bookingHolds = await this.expireBookingHolds(limit);
    const vehicleReservations = (await this.vehicleService.expireSystem(limit)).expired;
    const quotes = await this.expireQuotes(limit);
    const inventoryReservations = await this.expireStandaloneInventory(limit);
    const idempotencyRecords = await this.cleanupExpiredIdempotency(limit * 4);
    return {
      bookingHolds,
      orders,
      vehicleReservations,
      quotes,
      inventoryReservations,
      idempotencyRecords,
    };
  }

  private async expireBookingHolds(limit: number): Promise<number> {
    const candidates = await this.database.booking.findMany({
      where: {
        status: "AWAITING_DEPOSIT",
        paymentHoldExpiresAt: { lte: new Date() },
      },
      select: { id: true },
      orderBy: [{ paymentHoldExpiresAt: "asc" }, { id: "asc" }],
      take: limit,
    });
    let changed = 0;
    for (const candidate of candidates) {
      await this.database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${candidate.id}::uuid FOR UPDATE`;
        const booking = await transaction.booking.findUnique({
          where: { id: candidate.id },
          select: {
            id: true,
            status: true,
            version: true,
            paymentHoldExpiresAt: true,
            customer: { select: { userId: true } },
            depositPayment: { select: { id: true } },
          },
        });
        const now = new Date();
        if (
          booking?.status !== "AWAITING_DEPOSIT" ||
          booking.paymentHoldExpiresAt === null ||
          booking.paymentHoldExpiresAt > now
        )
          return;
        if (booking.depositPayment !== null) {
          await transaction.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${booking.depositPayment.id}::uuid FOR UPDATE`;
          await transaction.payment.updateMany({
            where: {
              id: booking.depositPayment.id,
              status: { in: ["REQUIRES_PAYMENT", "PROCESSING", "REQUIRES_REVIEW"] },
            },
            data: { status: "EXPIRED", expiredAt: now },
          });
        }
        const result = await transaction.booking.updateMany({
          where: { id: booking.id, status: "AWAITING_DEPOSIT", version: booking.version },
          data: { status: "EXPIRED", version: { increment: 1 } },
        });
        if (result.count !== 1) return;
        await enqueueNotification(transaction, {
          userId: booking.customer.userId,
          type: "BOOKING",
          category: "TRANSACTIONAL",
          title: "Booking hold expired",
          message:
            "The 30-minute deposit payment window ended, so this booking slot was released. Select an available slot to create a new booking.",
          resourceType: "BOOKING",
          resourceId: booking.id,
          deduplicationKey: `booking:${booking.id}:hold-expired`,
          channels: ["EMAIL"],
        });
        await appendAuditEvent(transaction, {
          actorUserId: null,
          action: "STATUS_CHANGE",
          entityType: "BOOKING",
          entityId: booking.id,
          oldValues: { status: "AWAITING_DEPOSIT", version: booking.version },
          newValues: { status: "EXPIRED", version: booking.version + 1 },
          context: {
            requestId: `worker:booking-hold-expiry:${booking.id}`,
            ipAddress: null,
            userAgent: null,
          },
        });
        changed += 1;
      });
    }
    return changed;
  }

  private async expireQuotes(limit: number): Promise<number> {
    const candidates = await this.database.serviceQuote.findMany({
      where: { status: "ISSUED", expiresAt: { lt: new Date() } },
      select: { id: true },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: limit,
    });
    let changed = 0;
    for (const candidate of candidates) {
      await this.database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "ServiceQuote" WHERE "id" = ${candidate.id}::uuid FOR UPDATE`;
        const quote = await transaction.serviceQuote.findUnique({
          where: { id: candidate.id },
          select: { status: true, expiresAt: true, version: true },
        });
        if (
          quote?.status !== "ISSUED" ||
          quote.expiresAt === null ||
          quote.expiresAt >= new Date()
        )
          return;
        const result = await transaction.serviceQuote.updateMany({
          where: { id: candidate.id, status: "ISSUED", version: quote.version },
          data: { status: "EXPIRED", version: { increment: 1 } },
        });
        if (result.count !== 1) return;
        await appendAuditEvent(transaction, {
          actorUserId: null,
          action: "STATUS_CHANGE",
          entityType: "QUOTE",
          entityId: candidate.id,
          oldValues: { status: "ISSUED", version: quote.version },
          newValues: { status: "EXPIRED", version: quote.version + 1 },
          context: {
            requestId: `worker:quote-expiry:${candidate.id}`,
            ipAddress: null,
            userAgent: null,
          },
        });
        changed += 1;
      });
    }
    return changed;
  }

  private async expireStandaloneInventory(limit: number): Promise<number> {
    const ids = await this.database.inventoryReservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: new Date() },
        NOT: { referenceType: "ORDER" },
      },
      select: { id: true },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      take: limit,
    });
    let changed = 0;
    for (const { id } of ids) {
      await this.database.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`SELECT "id" FROM "InventoryReservation" WHERE "id" = ${id}::uuid FOR UPDATE`;
          const reservation = await transaction.inventoryReservation.findUnique({
            where: { id },
            select: {
              id: true,
              inventoryId: true,
              quantity: true,
              status: true,
              expiresAt: true,
            },
          });
          if (reservation?.status !== "ACTIVE" || reservation.expiresAt >= new Date())
            return;
          await transaction.$queryRaw`SELECT "id" FROM "Inventory" WHERE "id" = ${reservation.inventoryId}::uuid FOR UPDATE`;
          const inventory = await transaction.inventory.findUniqueOrThrow({
            where: { id: reservation.inventoryId },
            select: { id: true, quantity: true, reserved: true, version: true },
          });
          const reservedAfter = inventory.reserved - reservation.quantity;
          if (reservedAfter < 0)
            throw new Error("Inventory reservation invariant failed");
          const inventoryChanged = await transaction.inventory.updateMany({
            where: {
              id: inventory.id,
              version: inventory.version,
              reserved: inventory.reserved,
            },
            data: { reserved: reservedAfter, version: { increment: 1 } },
          });
          const reservationChanged = await transaction.inventoryReservation.updateMany({
            where: { id, status: "ACTIVE" },
            data: { status: "RELEASED", expiredAt: new Date(), releasedAt: new Date() },
          });
          if (inventoryChanged.count !== 1 || reservationChanged.count !== 1)
            throw new Error("Concurrent inventory reservation update");
          await transaction.inventoryTransaction.create({
            data: {
              inventoryId: inventory.id,
              performedById: null,
              type: "RESERVATION_RELEASE",
              quantityDelta: 0,
              reservedDelta: -reservation.quantity,
              quantityBefore: inventory.quantity,
              quantityAfter: inventory.quantity,
              reservedBefore: inventory.reserved,
              reservedAfter,
              idempotencyKey: createHash("sha256").update(`expiry:${id}`).digest("hex"),
              requestHash: createHash("sha256")
                .update(`reservation-expiry:${id}`)
                .digest("hex"),
              referenceType: "INVENTORY_RESERVATION",
              referenceId: id,
            },
          });
          changed += 1;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    }
    return changed;
  }

  private cleanupExpiredIdempotency(limit: number): Promise<number> {
    return this.database.$executeRaw`
      DELETE FROM "IdempotencyRecord"
      WHERE "id" IN (
        SELECT "id" FROM "IdempotencyRecord"
        WHERE "expiresAt" <= CURRENT_TIMESTAMP
        ORDER BY "expiresAt" ASC
        LIMIT ${limit}
      )
    `;
  }
}
