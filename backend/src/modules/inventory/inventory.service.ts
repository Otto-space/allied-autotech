import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { hashToken } from "../../common/security/session-tokens.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  idempotencyConflict,
  insufficientStock,
  inventoryConflict,
  inventoryNotFound,
} from "./inventory.errors.js";
import {
  assertInventoryAccess,
  assertInventoryAdministrator,
  assertInventoryOperator,
} from "./inventory.policy.js";
import { InventoryRepository } from "./inventory.repository.js";
import type {
  InventoryCreateInput,
  InventoryHistoryQuery,
  InventoryListQuery,
  InventoryMovementInput,
  InventoryReleaseInput,
  InventoryReservationInput,
  InventoryReservationListQuery,
  InventoryUpdateInput,
} from "./inventory.schemas.js";
import { page, requestFingerprint } from "./inventory.types.js";

function inventoryView<
  T extends { quantity: number; reserved: number; product: { priceKobo: bigint } },
>(inventory: T) {
  return {
    ...inventory,
    available: inventory.quantity - inventory.reserved,
    product: { ...inventory.product, priceKobo: inventory.product.priceKobo.toString() },
  };
}

export class InventoryService {
  private readonly repository: InventoryRepository;
  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new InventoryRepository(database);
  }

  private async allowedBranch(
    actor: AuthenticatedActor,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ): Promise<string | null> {
    assertInventoryOperator(actor);
    if (actor.role !== "STAFF") return null;
    const profile = await this.repository.staffBranch(actor.userId, client);
    const branchId = profile?.branch?.isActive === true ? profile.branchId : null;
    assertInventoryAccess(actor, branchId, branchId ?? "");
    return branchId;
  }

  private async authorize(
    actor: AuthenticatedActor,
    branchId: string,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ): Promise<void> {
    const allowedBranchId = await this.allowedBranch(actor, client);
    assertInventoryAccess(actor, allowedBranchId, branchId);
  }

  private async lockActorAuthority(
    actor: AuthenticatedActor,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    if (actor.role === "STAFF") {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`staff:${actor.userId}`}, 0))`;
    }
  }

  async list(actor: AuthenticatedActor, query: InventoryListQuery) {
    const allowedBranchId = await this.allowedBranch(actor);
    const result = page(await this.repository.list(query, allowedBranchId), query.limit);
    return { ...result, items: result.items.map(inventoryView) };
  }

  async get(actor: AuthenticatedActor, id: string) {
    const inventory = await this.repository.inventory(id);
    if (inventory === null) throw inventoryNotFound();
    await this.authorize(actor, inventory.branch.id);
    return inventoryView(inventory);
  }

  async create(
    actor: AuthenticatedActor,
    input: InventoryCreateInput,
    context: RequestSecurityContext,
  ) {
    assertInventoryAdministrator(actor);
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${input.productId}`}, 0))`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inventory:${input.branchId}:${input.productId}`}, 0))`;
      const product = await transaction.product.findFirst({
        where: { id: input.productId, isActive: true, category: { isActive: true } },
        select: { id: true },
      });
      const branch = await transaction.branch.findFirst({
        where: { id: input.branchId, isActive: true },
        select: { id: true },
      });
      if (product === null || branch === null) throw inventoryNotFound();
      const inventory = await this.repository.create(input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "INVENTORY",
        entityId: inventory.id,
        newValues: {
          productId: input.productId,
          branchId: input.branchId,
          reorderLevel: input.reorderLevel,
        },
        context,
      });
      return inventoryView(inventory);
    });
  }

  async update(
    actor: AuthenticatedActor,
    id: string,
    input: InventoryUpdateInput,
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction(async (transaction) => {
      const preliminary = await this.repository.inventory(id, transaction);
      if (preliminary === null) throw inventoryNotFound();
      await this.lockActorAuthority(actor, transaction);
      await this.authorize(actor, preliminary.branch.id, transaction);
      const inventory = await this.repository.lockInventory(id, transaction);
      if (inventory === null) throw inventoryNotFound();
      if (
        (
          await this.repository.updateReorderLevel(
            id,
            input.expectedVersion,
            input.reorderLevel,
            transaction,
          )
        ).count !== 1
      )
        throw inventoryConflict();
      const updated = await this.repository.inventory(id, transaction);
      if (updated === null) throw inventoryNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "INVENTORY_ADJUSTED",
        entityType: "INVENTORY",
        entityId: id,
        oldValues: { reorderLevel: inventory.reorderLevel, version: inventory.version },
        newValues: { reorderLevel: input.reorderLevel, version: updated.version },
        context,
      });
      return inventoryView(updated);
    });
  }

  async movement(
    actor: AuthenticatedActor,
    id: string,
    input: InventoryMovementInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    const keyHash = hashToken("inventory-idempotency", rawKey);
    const fingerprint = requestFingerprint({
      operation: "movement",
      inventoryId: id,
      input,
    });
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inventory-idempotency:${keyHash}`}, 0))`;
      const existingTransaction = await this.repository.transactionByKey(
        keyHash,
        transaction,
      );
      const preliminary = await this.repository.inventory(id, transaction);
      if (preliminary === null) throw inventoryNotFound();
      await this.lockActorAuthority(actor, transaction);
      await this.authorize(actor, preliminary.branch.id, transaction);
      if (existingTransaction !== null) {
        if (existingTransaction.requestHash !== fingerprint) throw idempotencyConflict();
        const { requestHash: _requestHash, ...safeTransaction } = existingTransaction;
        return {
          inventory: inventoryView(preliminary),
          transaction: safeTransaction,
          replayed: true,
        };
      }
      const inventory = await this.repository.lockInventory(id, transaction);
      if (inventory === null) throw inventoryNotFound();
      let quantityDelta = 0;
      let reservedDelta = 0;
      let reservationId: string | undefined;
      if (input.type === "ADJUSTMENT") {
        quantityDelta = input.targetQuantity - inventory.quantity;
        if (quantityDelta === 0)
          throw inventoryConflict("Adjustment would not change inventory");
      } else if (input.type === "DAMAGE") {
        quantityDelta = -input.quantity;
      } else if (input.type === "SALE") {
        quantityDelta = -input.quantity;
        reservationId = input.reservationId;
        if (reservationId !== undefined) {
          const reservation = await this.repository.reservation(
            reservationId,
            id,
            transaction,
          );
          if (
            reservation === null ||
            reservation.status !== "ACTIVE" ||
            reservation.expiresAt <= new Date() ||
            reservation.quantity !== input.quantity
          ) {
            throw inventoryConflict("Reservation cannot be consumed");
          }
          reservedDelta = -input.quantity;
          if (
            (
              await this.repository.transitionReservation(
                reservationId,
                "CONSUMED",
                new Date(),
                transaction,
              )
            ).count !== 1
          )
            throw inventoryConflict();
        }
      } else {
        quantityDelta = input.quantity;
      }
      const nextQuantity = inventory.quantity + quantityDelta;
      const nextReserved = inventory.reserved + reservedDelta;
      if (
        nextQuantity < nextReserved ||
        nextQuantity < 0 ||
        (quantityDelta < 0 &&
          reservedDelta === 0 &&
          inventory.quantity - inventory.reserved < -quantityDelta)
      )
        throw insufficientStock();
      if (
        (
          await this.repository.updateBalances(
            id,
            inventory.version,
            nextQuantity,
            nextReserved,
            transaction,
          )
        ).count !== 1
      )
        throw inventoryConflict();
      const transactionRecord = await this.repository.createTransaction(
        {
          inventoryId: id,
          performedById: actor.userId,
          type: input.type,
          quantityDelta,
          reservedDelta,
          quantityBefore: inventory.quantity,
          quantityAfter: nextQuantity,
          reservedBefore: inventory.reserved,
          reservedAfter: nextReserved,
          idempotencyKey: keyHash,
          requestHash: fingerprint,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? reservationId ?? null,
          note: input.note ?? null,
        },
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "INVENTORY_ADJUSTED",
        entityType: "INVENTORY",
        entityId: id,
        oldValues: {
          quantity: inventory.quantity,
          reserved: inventory.reserved,
          version: inventory.version,
        },
        newValues: {
          type: input.type,
          quantity: nextQuantity,
          reserved: nextReserved,
          version: inventory.version + 1,
        },
        context,
      });
      const updated = await this.repository.inventory(id, transaction);
      if (updated === null) throw inventoryNotFound();
      return {
        inventory: inventoryView(updated),
        transaction: transactionRecord,
        replayed: false,
      };
    });
  }

  async reserve(
    actor: AuthenticatedActor,
    id: string,
    input: InventoryReservationInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    const keyHash = hashToken("inventory-idempotency", rawKey);
    const fingerprint = requestFingerprint({
      operation: "reservation",
      inventoryId: id,
      input,
    });
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inventory-idempotency:${keyHash}`}, 0))`;
      const preliminary = await this.repository.inventory(id, transaction);
      if (preliminary === null) throw inventoryNotFound();
      await this.lockActorAuthority(actor, transaction);
      await this.authorize(actor, preliminary.branch.id, transaction);
      const replay = await this.repository.reservationByKey(keyHash, transaction);
      if (replay !== null) {
        if (replay.requestHash !== fingerprint || replay.inventoryId !== id)
          throw idempotencyConflict();
        const {
          requestHash: _requestHash,
          inventoryId: _inventoryId,
          ...safeReservation
        } = replay;
        return {
          inventory: inventoryView(preliminary),
          reservation: safeReservation,
          replayed: true,
        };
      }
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${preliminary.product.id}`}, 0))`;
      const inventory = await this.repository.lockInventory(id, transaction);
      if (inventory === null) throw inventoryNotFound();
      if (
        !inventory.product.isActive ||
        !inventory.branch.isActive ||
        inventory.quantity - inventory.reserved < input.quantity
      )
        throw insufficientStock();
      if (
        input.customerId !== undefined &&
        (await transaction.customerProfile.findUnique({
          where: { id: input.customerId },
          select: { id: true },
        })) === null
      )
        throw inventoryNotFound();
      const nextReserved = inventory.reserved + input.quantity;
      if (
        (
          await this.repository.updateBalances(
            id,
            inventory.version,
            inventory.quantity,
            nextReserved,
            transaction,
          )
        ).count !== 1
      )
        throw inventoryConflict();
      const reservation = await this.repository.createReservation(
        {
          inventoryId: id,
          customerId: input.customerId ?? null,
          quantity: input.quantity,
          expiresAt: new Date(input.expiresAt),
          idempotencyKey: keyHash,
          requestHash: fingerprint,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
        },
        transaction,
      );
      await this.repository.createTransaction(
        {
          inventoryId: id,
          performedById: actor.userId,
          type: "RESERVATION",
          quantityDelta: 0,
          reservedDelta: input.quantity,
          quantityBefore: inventory.quantity,
          quantityAfter: inventory.quantity,
          reservedBefore: inventory.reserved,
          reservedAfter: nextReserved,
          idempotencyKey: keyHash,
          requestHash: fingerprint,
          referenceType: "INVENTORY_RESERVATION",
          referenceId: reservation.id,
          note: null,
        },
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "INVENTORY_ADJUSTED",
        entityType: "INVENTORY",
        entityId: id,
        newValues: {
          type: "RESERVATION",
          reservationId: reservation.id,
          quantity: input.quantity,
          reserved: nextReserved,
        },
        context,
      });
      const updated = await this.repository.inventory(id, transaction);
      if (updated === null) throw inventoryNotFound();
      return { inventory: inventoryView(updated), reservation, replayed: false };
    });
  }

  async release(
    actor: AuthenticatedActor,
    inventoryId: string,
    reservationId: string,
    input: InventoryReleaseInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    const keyHash = hashToken("inventory-idempotency", rawKey);
    const fingerprint = requestFingerprint({
      operation: "release",
      inventoryId,
      reservationId,
      input,
    });
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`inventory-idempotency:${keyHash}`}, 0))`;
      const preliminary = await this.repository.inventory(inventoryId, transaction);
      if (preliminary === null) throw inventoryNotFound();
      await this.lockActorAuthority(actor, transaction);
      await this.authorize(actor, preliminary.branch.id, transaction);
      const replay = await this.repository.transactionByKey(keyHash, transaction);
      if (replay !== null) {
        if (replay.requestHash !== fingerprint || replay.referenceId !== reservationId)
          throw idempotencyConflict();
        const reservation = await this.repository.reservation(
          reservationId,
          inventoryId,
          transaction,
        );
        const { requestHash: _requestHash, ...safeTransaction } = replay;
        return {
          inventory: inventoryView(preliminary),
          reservation,
          transaction: safeTransaction,
          replayed: true,
        };
      }
      const inventory = await this.repository.lockInventory(inventoryId, transaction);
      const reservation = await this.repository.reservation(
        reservationId,
        inventoryId,
        transaction,
      );
      if (inventory === null || reservation === null) throw inventoryNotFound();
      if (reservation.status !== "ACTIVE")
        throw inventoryConflict("Reservation is no longer active");
      const now = new Date();
      const status = reservation.expiresAt <= now ? "EXPIRED" : "RELEASED";
      if (
        (
          await this.repository.transitionReservation(
            reservationId,
            status,
            now,
            transaction,
          )
        ).count !== 1
      )
        throw inventoryConflict();
      const nextReserved = inventory.reserved - reservation.quantity;
      if (
        nextReserved < 0 ||
        (
          await this.repository.updateBalances(
            inventoryId,
            inventory.version,
            inventory.quantity,
            nextReserved,
            transaction,
          )
        ).count !== 1
      )
        throw inventoryConflict();
      const transactionRecord = await this.repository.createTransaction(
        {
          inventoryId,
          performedById: actor.userId,
          type: "RESERVATION_RELEASE",
          quantityDelta: 0,
          reservedDelta: -reservation.quantity,
          quantityBefore: inventory.quantity,
          quantityAfter: inventory.quantity,
          reservedBefore: inventory.reserved,
          reservedAfter: nextReserved,
          idempotencyKey: keyHash,
          requestHash: fingerprint,
          referenceType: "INVENTORY_RESERVATION",
          referenceId: reservationId,
          note: input.note ?? null,
        },
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "INVENTORY_ADJUSTED",
        entityType: "INVENTORY",
        entityId: inventoryId,
        newValues: {
          type: "RESERVATION_RELEASE",
          reservationId,
          reservationStatus: status,
          reserved: nextReserved,
        },
        context,
      });
      const updated = await this.repository.inventory(inventoryId, transaction);
      const updatedReservation = await this.repository.reservation(
        reservationId,
        inventoryId,
        transaction,
      );
      if (updated === null || updatedReservation === null) throw inventoryNotFound();
      return {
        inventory: inventoryView(updated),
        reservation: updatedReservation,
        transaction: transactionRecord,
        replayed: false,
      };
    });
  }

  async history(actor: AuthenticatedActor, id: string, query: InventoryHistoryQuery) {
    await this.get(actor, id);
    return page(await this.repository.history(id, query), query.limit);
  }
  async reservations(
    actor: AuthenticatedActor,
    id: string,
    query: InventoryReservationListQuery,
  ) {
    await this.get(actor, id);
    return page(await this.repository.reservations(id, query), query.limit);
  }
}

export const inventoryService = new InventoryService();
