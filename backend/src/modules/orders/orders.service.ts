import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { hashToken } from "../../common/security/session-tokens.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  promotionsService,
  type PromotionsService,
} from "../promotions/promotions.service.js";
import {
  checkoutIdempotencyConflict,
  checkoutStockUnavailable,
  invalidOrderTransition,
  orderConflict,
  orderForbidden,
  orderNotFound,
  orderStale,
} from "./orders.errors.js";
import { assertCustomer, assertOrderOperator } from "./orders.policy.js";
import { OrdersRepository } from "./orders.repository.js";
import type {
  CheckoutInput,
  CustomerOrderCancelInput,
  CustomerOrderListQuery,
  ExpireOrdersInput,
  OrderTransitionInput,
  StaffOrderListQuery,
} from "./orders.schemas.js";
import { jsonSafe, orderFingerprint, page } from "./orders.types.js";

const transitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
} as const;
const MAX_MONEY_KOBO = 9_000_000_000_000_000_000n;
const reference = (prefix: "ORD" | "INV") =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
function customerOrderView<T extends { invoice: null | { status: string } }>(order: T) {
  return { ...order, invoice: order.invoice?.status === "DRAFT" ? null : order.invoice };
}

export class OrdersService {
  private readonly repository: OrdersRepository;
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly promotions: PromotionsService = promotionsService,
  ) {
    this.repository = new OrdersRepository(database);
  }

  async checkout(
    actor: AuthenticatedActor,
    input: CheckoutInput,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    assertCustomer(actor);
    if (input.fulfillmentMethod === "DELIVERY")
      throw orderConflict(
        "Delivery checkout is unavailable until delivery areas and fees are approved",
      );
    const scope = `order-checkout:${actor.userId}`;
    const keyHash = hashToken("order-checkout-idempotency", rawKey);
    const requestHash = orderFingerprint(input);
    return this.database.$transaction(async (transaction) => {
      const checkoutLockKey = `checkout:${keyHash}`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${checkoutLockKey}, 0))`;
      const existing = await this.repository.idempotency(scope, keyHash, transaction);
      if (existing !== null) {
        if (existing.requestHash !== requestHash) throw checkoutIdempotencyConflict();
        const orderId =
          existing.responseBody !== null &&
          typeof existing.responseBody === "object" &&
          !Array.isArray(existing.responseBody)
            ? (existing.responseBody as { orderId?: unknown }).orderId
            : undefined;
        if (existing.status !== "COMPLETED" || typeof orderId !== "string")
          throw orderConflict("Checkout is already in progress");
        const order = await this.repository.order(orderId, transaction);
        if (order === null) throw orderNotFound();
        return jsonSafe({ order: customerOrderView(order), replayed: true });
      }
      await this.repository.createIdempotency(
        actor.userId,
        scope,
        keyHash,
        requestHash,
        transaction,
      );
      let profile = await this.repository.customerProfile(actor.userId, transaction);
      if (profile?.cart === null || profile === null)
        throw orderConflict("Cart is empty");
      await this.repository.lockCart(profile.cart.id, transaction);
      profile = await this.repository.customerProfile(actor.userId, transaction);
      if (profile?.cart === null || profile === null || profile.cart.items.length === 0)
        throw orderConflict("Cart is empty");
      if ((await this.repository.branch(input.branchId, transaction)) === null)
        throw orderNotFound();
      const productIds = [
        ...new Set(profile.cart.items.map(({ productId }) => productId)),
      ].sort((a, b) => a.localeCompare(b));
      const inventories = await this.repository.lockInventories(
        input.branchId,
        productIds,
        transaction,
      );
      if (inventories.length !== productIds.length) throw checkoutStockUnavailable();
      const cartByProduct = new Map(
        profile.cart.items.map((item) => [item.productId, item.quantity]),
      );
      for (const inventory of inventories) {
        const quantity = cartByProduct.get(inventory.productId);
        if (
          quantity === undefined ||
          !inventory.product.isActive ||
          !inventory.product.category.isActive ||
          !inventory.branch.isActive ||
          inventory.product.currency !== "NGN" ||
          inventory.quantity - inventory.reserved < quantity
        )
          throw checkoutStockUnavailable();
      }
      const items = inventories.map((inventory) => {
        const quantity = cartByProduct.get(inventory.productId)!;
        return {
          productId: inventory.productId,
          productName: inventory.product.name,
          sku: inventory.product.sku,
          unitPriceKobo: inventory.product.priceKobo,
          quantity,
          subtotalKobo: inventory.product.priceKobo * BigInt(quantity),
        };
      });
      if (items.some((item) => item.subtotalKobo > MAX_MONEY_KOBO))
        throw orderConflict("Order amount exceeds the supported limit");
      const subtotalKobo = items.reduce((sum, item) => sum + item.subtotalKobo, 0n);
      if (subtotalKobo > MAX_MONEY_KOBO)
        throw orderConflict("Order amount exceeds the supported limit");
      const evaluation =
        input.promotionCode === undefined
          ? null
          : await this.promotions.lockAndEvaluate(
              profile.id,
              input.promotionCode,
              subtotalKobo,
              transaction,
            );
      const discountAmountKobo = evaluation?.discountAmountKobo ?? 0n;
      const deliveryFeeKobo = 0n;
      const totalKobo = subtotalKobo - discountAmountKobo + deliveryFeeKobo;
      const orderId = randomUUID();
      const now = new Date();
      const paymentDueAt = new Date(now.getTime() + 30 * 60_000);
      await this.repository.createOrder(
        {
          id: orderId,
          customerId: profile.id,
          branchId: input.branchId,
          orderNumber: reference("ORD"),
          fulfillmentMethod: input.fulfillmentMethod,
          currency: "NGN",
          subtotalKobo,
          discountAmountKobo,
          deliveryFeeKobo,
          totalKobo,
          customerName: `${profile.firstName} ${profile.lastName}`,
          customerEmail: profile.user.email,
          customerPhone: profile.phone,
          ...(input.delivery === undefined
            ? {}
            : {
                deliveryName: input.delivery.name,
                deliveryPhone: input.delivery.phone,
                deliveryAddress: input.delivery.address,
                deliveryCity: input.delivery.city,
                deliveryState: input.delivery.state,
                deliveryCountry: input.delivery.country,
              }),
          paymentDueAt,
          items: { createMany: { data: items } },
        },
        transaction,
      );
      if (evaluation !== null)
        await this.promotions.repository.createUsage(evaluation, orderId, transaction);
      await transaction.invoice.create({
        data: {
          invoiceNumber: reference("INV"),
          customerId: profile.id,
          orderId,
          currency: "NGN",
          subtotalKobo: totalKobo,
          taxKobo: 0n,
          totalKobo,
        },
        select: { id: true },
      });
      for (const inventory of inventories) {
        const quantity = cartByProduct.get(inventory.productId)!;
        const nextReserved = inventory.reserved + quantity;
        if (
          (
            await this.repository.updateInventory(
              inventory.id,
              inventory.version,
              inventory.quantity,
              nextReserved,
              transaction,
            )
          ).count !== 1
        )
          throw orderStale();
        const reservationId = randomUUID();
        const lineKey = hashToken("order-reservation", `${keyHash}:${inventory.id}`);
        await transaction.inventoryReservation.create({
          data: {
            id: reservationId,
            inventoryId: inventory.id,
            customerId: profile.id,
            quantity,
            expiresAt: paymentDueAt,
            idempotencyKey: lineKey,
            requestHash,
            referenceType: "ORDER",
            referenceId: orderId,
          },
        });
        await transaction.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            performedById: actor.userId,
            type: "RESERVATION",
            quantityDelta: 0,
            reservedDelta: quantity,
            quantityBefore: inventory.quantity,
            quantityAfter: inventory.quantity,
            reservedBefore: inventory.reserved,
            reservedAfter: nextReserved,
            idempotencyKey: hashToken("order-inventory", `${lineKey}:reserve`),
            requestHash,
            referenceType: "ORDER",
            referenceId: orderId,
          },
        });
      }
      await transaction.cartItem.deleteMany({ where: { cartId: profile.cart.id } });
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "ORDER",
        entityId: orderId,
        newValues: {
          status: "PENDING",
          branchId: input.branchId,
          itemCount: items.length,
          totalKobo: totalKobo.toString(),
          promotionId: evaluation?.promotion.id ?? null,
        },
        context,
      });
      await this.repository.completeIdempotency(scope, keyHash, orderId, transaction);
      const order = await this.repository.order(orderId, transaction);
      if (order === null) throw orderNotFound();
      return jsonSafe({ order: customerOrderView(order), replayed: false });
    });
  }

  async customerOrders(actor: AuthenticatedActor, query: CustomerOrderListQuery) {
    assertCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (profile === null) throw orderNotFound();
    const result = page(
      await this.repository.listCustomer(profile.id, query),
      query.limit,
    );
    return jsonSafe({ ...result, items: result.items.map(customerOrderView) });
  }
  async customerOrder(actor: AuthenticatedActor, id: string) {
    assertCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (profile === null) throw orderNotFound();
    const order = await this.repository.ownedOrder(id, profile.id);
    if (order === null) throw orderNotFound();
    return jsonSafe(customerOrderView(order));
  }
  async staffOrders(actor: AuthenticatedActor, query: StaffOrderListQuery) {
    assertOrderOperator(actor);
    const branchId = await this.allowedBranch(actor);
    return jsonSafe(
      page(
        await this.repository.listStaff(
          query,
          branchId,
          actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
        ),
        query.limit,
      ),
    );
  }
  async staffOrder(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
  ) {
    assertOrderOperator(actor);
    const order = await this.repository.staffOrder(
      id,
      actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
    );
    if (order === null) throw orderNotFound();
    await this.assertBranch(actor, order.branch?.id ?? null);
    await this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "ORDER",
        entityId: id,
        newValues: { privilegedRead: true },
        context,
      }),
    );
    return jsonSafe(order);
  }
  async customerCancel(
    actor: AuthenticatedActor,
    id: string,
    input: CustomerOrderCancelInput,
    context: RequestSecurityContext,
  ) {
    assertCustomer(actor);
    await this.database.$transaction(async (transaction) => {
      const profile = await transaction.customerProfile.findUnique({
        where: { userId: actor.userId },
        select: { id: true },
      });
      const order = await this.repository.lockOrder(id, transaction);
      if (
        profile === null ||
        order === null ||
        (await transaction.order.count({ where: { id, customerId: profile.id } })) !== 1
      )
        throw orderNotFound();
      if (order.status !== "PENDING") throw invalidOrderTransition();
      await this.cancelLocked(
        actor,
        order,
        input.expectedVersion,
        input.reason,
        transaction,
        context,
      );
    });
    const updated = await this.repository.order(id);
    if (updated === null) throw orderNotFound();
    return jsonSafe(updated);
  }
  async transition(
    actor: AuthenticatedActor,
    id: string,
    input: OrderTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertOrderOperator(actor);
    await this.database.$transaction(async (transaction) => {
      const order = await this.repository.lockOrder(id, transaction);
      if (order === null) throw orderNotFound();
      await this.assertBranch(actor, order.branchId, transaction);
      if (!(transitions[order.status] as readonly string[]).includes(input.status))
        throw invalidOrderTransition();
      if (input.status === "CANCELLED") {
        if (input.reason === undefined)
          throw orderConflict("A cancellation reason is required");
        await this.cancelLocked(
          actor,
          order,
          input.expectedVersion,
          input.reason,
          transaction,
          context,
        );
        return;
      }
      if (
        input.status === "CONFIRMED" &&
        (order.paymentDueAt === null || order.paymentDueAt <= new Date())
      )
        throw orderConflict("The checkout reservation has expired");
      if (input.status === "CONFIRMED")
        await this.consumeReservations(actor.userId, order.id, transaction);
      const now = new Date();
      const result = await this.repository.updateOrder(
        id,
        input.expectedVersion,
        [order.status],
        {
          status: input.status,
          ...(input.status === "CONFIRMED" ? { confirmedAt: now } : {}),
          ...(input.status === "PROCESSING" ? { processingAt: now } : {}),
          ...(input.status === "READY" ? { readyAt: now } : {}),
          ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
        },
        transaction,
      );
      if (result.count !== 1) throw orderStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "ORDER",
        entityId: id,
        oldValues: { status: order.status, version: order.version },
        newValues: { status: input.status, version: input.expectedVersion + 1 },
        context,
      });
    });
    const updated = await this.repository.staffOrder(
      id,
      actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
    );
    if (updated === null) throw orderNotFound();
    return jsonSafe(updated);
  }
  async expireDue(
    actor: AuthenticatedActor,
    input: ExpireOrdersInput,
    context: RequestSecurityContext,
  ) {
    assertOrderOperator(actor);
    if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") throw orderForbidden();
    return this.expireEligibleOrders(input.limit, actor, context);
  }

  async expireDueSystem(limit: number) {
    return this.expireEligibleOrders(limit, null);
  }

  private async expireEligibleOrders(
    limit: number,
    actor: AuthenticatedActor | null,
    context?: RequestSecurityContext,
  ) {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const candidates = await this.repository.dueOrderIds(boundedLimit);
    let expired = 0;
    for (const candidate of candidates) {
      await this.database.$transaction(async (transaction) => {
        const order = await this.repository.lockOrder(candidate.id, transaction);
        if (
          order?.status !== "PENDING" ||
          order.paymentDueAt === null ||
          order.paymentDueAt > new Date()
        )
          return;
        const inFlightPayment = await transaction.payment.findFirst({
          where: {
            orderId: order.id,
            OR: [
              { status: { in: ["SUCCEEDED", "REQUIRES_REVIEW"] } },
              { attempts: { some: { status: { in: ["PROCESSING", "SUCCESSFUL"] } } } },
            ],
          },
          select: { id: true },
        });
        if (inFlightPayment !== null) return;
        await this.cancelLocked(
          actor,
          order,
          order.version,
          "PAYMENT_WINDOW_EXPIRED",
          transaction,
          context ?? {
            requestId: `worker:order-expiry:${order.id}`,
            ipAddress: null,
            userAgent: null,
          },
        );
        expired += 1;
      });
    }
    return { expired };
  }

  private async allowedBranch(
    actor: AuthenticatedActor,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    if (actor.role !== "STAFF") return null;
    const profile = await this.repository.staffBranch(actor.userId, client);
    if (profile?.branchId == null || profile.branch?.isActive !== true)
      throw orderForbidden();
    return profile.branchId;
  }
  private async assertBranch(
    actor: AuthenticatedActor,
    branchId: string | null,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    const allowed = await this.allowedBranch(actor, client);
    if (actor.role === "STAFF" && (allowed === null || branchId !== allowed))
      throw orderForbidden();
  }
  private async consumeReservations(
    userId: string,
    orderId: string,
    transaction: Prisma.TransactionClient,
  ) {
    const reservations = await this.repository.reservations(
      orderId,
      ["ACTIVE"],
      transaction,
    );
    if (reservations.length === 0) throw checkoutStockUnavailable();
    const inventories = await this.repository.lockInventoryIds(
      reservations.map(({ inventoryId }) => inventoryId),
      transaction,
    );
    const inventoryById = new Map(inventories.map((item) => [item.id, item]));
    const now = new Date();
    for (const reservation of reservations) {
      const inventory = inventoryById.get(reservation.inventoryId);
      if (
        inventory === undefined ||
        inventory.quantity < reservation.quantity ||
        inventory.reserved < reservation.quantity
      )
        throw checkoutStockUnavailable();
      const nextQuantity = inventory.quantity - reservation.quantity;
      const nextReserved = inventory.reserved - reservation.quantity;
      if (
        (
          await this.repository.updateInventory(
            inventory.id,
            inventory.version,
            nextQuantity,
            nextReserved,
            transaction,
          )
        ).count !== 1 ||
        (
          await this.repository.transitionReservation(
            reservation.id,
            "ACTIVE",
            "CONSUMED",
            now,
            transaction,
          )
        ).count !== 1
      )
        throw orderStale();
      await transaction.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          performedById: userId,
          type: "SALE",
          quantityDelta: -reservation.quantity,
          reservedDelta: -reservation.quantity,
          quantityBefore: inventory.quantity,
          quantityAfter: nextQuantity,
          reservedBefore: inventory.reserved,
          reservedAfter: nextReserved,
          idempotencyKey: hashToken(
            "order-inventory",
            `${orderId}:${reservation.id}:consume`,
          ),
          requestHash: orderFingerprint({
            orderId,
            reservationId: reservation.id,
            operation: "consume",
          }),
          referenceType: "ORDER",
          referenceId: orderId,
        },
      });
    }
  }
  private async releaseOrRestock(
    userId: string | null,
    orderId: string,
    orderStatus: string,
    transaction: Prisma.TransactionClient,
  ) {
    const statuses: Array<"ACTIVE" | "CONSUMED"> =
      orderStatus === "PENDING" ? ["ACTIVE"] : ["CONSUMED"];
    const reservations = await this.repository.reservations(
      orderId,
      statuses,
      transaction,
    );
    const inventories = await this.repository.lockInventoryBalances(
      reservations.map(({ inventoryId }) => inventoryId),
      transaction,
    );
    const inventoryById = new Map(inventories.map((item) => [item.id, item]));
    const now = new Date();
    for (const reservation of reservations) {
      const inventory = inventoryById.get(reservation.inventoryId);
      if (inventory === undefined) throw orderNotFound();
      if (reservation.status === "ACTIVE") {
        const nextReserved = inventory.reserved - reservation.quantity;
        if (
          nextReserved < 0 ||
          (
            await this.repository.updateInventory(
              inventory.id,
              inventory.version,
              inventory.quantity,
              nextReserved,
              transaction,
            )
          ).count !== 1 ||
          (
            await this.repository.transitionReservation(
              reservation.id,
              "ACTIVE",
              "RELEASED",
              now,
              transaction,
            )
          ).count !== 1
        )
          throw orderStale();
        await transaction.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            performedById: userId,
            type: "RESERVATION_RELEASE",
            quantityDelta: 0,
            reservedDelta: -reservation.quantity,
            quantityBefore: inventory.quantity,
            quantityAfter: inventory.quantity,
            reservedBefore: inventory.reserved,
            reservedAfter: nextReserved,
            idempotencyKey: hashToken(
              "order-inventory",
              `${orderId}:${reservation.id}:release`,
            ),
            requestHash: orderFingerprint({
              orderId,
              reservationId: reservation.id,
              operation: "release",
            }),
            referenceType: "ORDER",
            referenceId: orderId,
          },
        });
      } else {
        const nextQuantity = inventory.quantity + reservation.quantity;
        if (
          (
            await this.repository.updateInventory(
              inventory.id,
              inventory.version,
              nextQuantity,
              inventory.reserved,
              transaction,
            )
          ).count !== 1
        )
          throw orderStale();
        await transaction.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            performedById: userId,
            type: "RESTOCK",
            quantityDelta: reservation.quantity,
            reservedDelta: 0,
            quantityBefore: inventory.quantity,
            quantityAfter: nextQuantity,
            reservedBefore: inventory.reserved,
            reservedAfter: inventory.reserved,
            idempotencyKey: hashToken(
              "order-inventory",
              `${orderId}:${reservation.id}:restock`,
            ),
            requestHash: orderFingerprint({
              orderId,
              reservationId: reservation.id,
              operation: "restock",
            }),
            referenceType: "ORDER",
            referenceId: orderId,
          },
        });
      }
    }
  }
  private async cancelLocked(
    actor: AuthenticatedActor | null,
    order: NonNullable<Awaited<ReturnType<OrdersRepository["lockOrder"]>>>,
    expectedVersion: number,
    reason: string,
    transaction: Prisma.TransactionClient,
    context: RequestSecurityContext,
  ) {
    if (!(["PENDING", "CONFIRMED", "PROCESSING"] as string[]).includes(order.status))
      throw invalidOrderTransition();
    await this.releaseOrRestock(
      actor?.userId ?? null,
      order.id,
      order.status,
      transaction,
    );
    const now = new Date();
    const result = await this.repository.updateOrder(
      order.id,
      expectedVersion,
      [order.status],
      { status: "CANCELLED", cancellationReason: reason, cancelledAt: now },
      transaction,
    );
    if (result.count !== 1) throw orderStale();
    await transaction.invoice.updateMany({
      where: { orderId: order.id, status: { in: ["DRAFT", "ISSUED"] } },
      data: { status: "VOID", voidedAt: now, version: { increment: 1 } },
    });
    await appendAuditEvent(transaction, {
      actorUserId: actor?.userId ?? null,
      action: "STATUS_CHANGE",
      entityType: "ORDER",
      entityId: order.id,
      oldValues: { status: order.status, version: order.version },
      newValues: { status: "CANCELLED", version: expectedVersion + 1, reason },
      context,
    });
  }
}

export const ordersService = new OrdersService();
