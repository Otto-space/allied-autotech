import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { CustomerOrderListQuery, StaffOrderListQuery } from "./orders.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
export const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  fulfillmentMethod: true,
  currency: true,
  subtotalKobo: true,
  discountAmountKobo: true,
  taxKobo: true,
  deliveryFeeKobo: true,
  totalKobo: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  deliveryName: true,
  deliveryPhone: true,
  deliveryAddress: true,
  deliveryCity: true,
  deliveryState: true,
  deliveryCountry: true,
  cancellationReason: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  paymentDueAt: true,
  confirmedAt: true,
  paidAt: true,
  processingAt: true,
  readyAt: true,
  cancelledAt: true,
  completedAt: true,
  fulfillmentEvidenceAt: true,
  fulfillmentEvidenceReference: true,
  branch: { select: { id: true, code: true, name: true } },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      sku: true,
      unitPriceKobo: true,
      quantity: true,
      subtotalKobo: true,
    },
    orderBy: { id: "asc" as const },
  },
  promotionUsage: {
    select: {
      promotionCodeSnapshot: true,
      discountTypeSnapshot: true,
      percentageBasisPointsSnapshot: true,
      fixedAmountKoboSnapshot: true,
      discountAmountKobo: true,
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      currency: true,
      subtotalKobo: true,
      taxKobo: true,
      totalKobo: true,
      issuedAt: true,
      dueAt: true,
      paidAt: true,
      voidedAt: true,
      version: true,
    },
  },
} satisfies Prisma.OrderSelect;

const inventoryCheckoutSelect = {
  id: true,
  productId: true,
  branchId: true,
  quantity: true,
  reserved: true,
  version: true,
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      priceKobo: true,
      currency: true,
      isActive: true,
      category: { select: { isActive: true } },
    },
  },
  branch: { select: { isActive: true } },
} satisfies Prisma.InventorySelect;

const lockedOrderSelect = {
  paidAt: true,
  id: true,
  branchId: true,
  customerName: true,
  status: true,
  version: true,
  paymentDueAt: true,
} satisfies Prisma.OrderSelect;

export class OrdersRepository {
  constructor(private readonly database: PrismaClient = prisma) {}
  customerProfile(userId: string, client: DatabaseClient = this.database) {
    return client.customerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        user: { select: { email: true } },
        cart: {
          select: {
            id: true,
            items: {
              select: { productId: true, quantity: true },
              orderBy: { productId: "asc" },
            },
          },
        },
      },
    });
  }
  branch(id: string, client: DatabaseClient) {
    return client.branch.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
  }
  async lockCart(id: string, client: Prisma.TransactionClient) {
    await client.$queryRaw`SELECT "id" FROM "Cart" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }
  async lockInventories(
    branchId: string,
    productIds: string[],
    client: Prisma.TransactionClient,
  ) {
    const productIdValues = productIds.map((id) => Prisma.sql`${id}::uuid`);
    const ids = await client.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Inventory" WHERE "branchId" = ${branchId}::uuid AND "productId" IN (${Prisma.join(productIdValues)}) ORDER BY "productId", "id" FOR UPDATE`,
    );
    if (ids.length === 0) return [];
    const rows = await client.inventory.findMany({
      where: { id: { in: ids.map(({ id }) => id) } },
      select: inventoryCheckoutSelect,
    });
    const positions = new Map(ids.map(({ id }, index) => [id, index]));
    return rows.sort(
      (left, right) => (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0),
    );
  }
  async lockInventoryIds(inventoryIds: string[], client: Prisma.TransactionClient) {
    if (inventoryIds.length === 0) return [];
    const inventoryIdValues = inventoryIds.map((id) => Prisma.sql`${id}::uuid`);
    const ids = await client.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Inventory" WHERE "id" IN (${Prisma.join(inventoryIdValues)}) ORDER BY "id" FOR UPDATE`,
    );
    const rows = await client.inventory.findMany({
      where: { id: { in: ids.map(({ id }) => id) } },
      select: inventoryCheckoutSelect,
    });
    const positions = new Map(ids.map(({ id }, index) => [id, index]));
    return rows.sort(
      (left, right) => (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0),
    );
  }
  async lockInventoryBalances(inventoryIds: string[], client: Prisma.TransactionClient) {
    if (inventoryIds.length === 0) return [];
    const values = inventoryIds.map((id) => Prisma.sql`${id}::uuid`);
    return client.$queryRaw<
      Array<{ id: string; quantity: number; reserved: number; version: number }>
    >(
      Prisma.sql`SELECT "id", "quantity", "reserved", "version" FROM "Inventory" WHERE "id" IN (${Prisma.join(values)}) ORDER BY "id" FOR UPDATE`,
    );
  }
  createOrder(data: Prisma.OrderUncheckedCreateInput, client: DatabaseClient) {
    return client.order.create({ data, select: orderSelect });
  }
  order(id: string, client: DatabaseClient = this.database) {
    return client.order.findUnique({ where: { id }, select: orderSelect });
  }
  staffOrder(id: string, includeInvoice: boolean) {
    return this.database.order.findUnique({
      where: { id },
      select: { ...orderSelect, invoice: includeInvoice ? orderSelect.invoice : false },
    });
  }
  ownedOrder(id: string, customerId: string, client: DatabaseClient = this.database) {
    return client.order.findFirst({ where: { id, customerId }, select: orderSelect });
  }
  async lockOrder(id: string, client: Prisma.TransactionClient) {
    const rows = await client.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Order" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return rows.length === 0
      ? null
      : await client.order.findUnique({ where: { id }, select: lockedOrderSelect });
  }
  listCustomer(customerId: string, query: CustomerOrderListQuery) {
    return this.database.order.findMany({
      where: {
        customerId,
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      select: orderSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  listStaff(
    query: StaffOrderListQuery,
    branchId: string | null,
    includeInvoice: boolean,
  ) {
    const branchFilter: { branchId?: string } = {};
    if (branchId !== null) {
      branchFilter.branchId = branchId;
    } else if (query.branchId !== undefined) {
      branchFilter.branchId = query.branchId;
    }
    return this.database.order.findMany({
      where: {
        ...branchFilter,
        ...(query.customerId === undefined ? {} : { customerId: query.customerId }),
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      select: { ...orderSelect, invoice: includeInvoice ? orderSelect.invoice : false },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  staffBranch(userId: string, client: DatabaseClient = this.database) {
    return client.staffProfile.findUnique({
      where: { userId },
      select: { branchId: true, branch: { select: { isActive: true } } },
    });
  }
  updateInventory(
    id: string,
    version: number,
    quantity: number,
    reserved: number,
    client: DatabaseClient,
  ) {
    return client.inventory.updateMany({
      where: { id, version },
      data: { quantity, reserved, version: { increment: 1 } },
    });
  }
  reservations(
    orderId: string,
    statuses: Array<"ACTIVE" | "CONSUMED">,
    client: DatabaseClient,
  ) {
    return client.inventoryReservation.findMany({
      where: { referenceType: "ORDER", referenceId: orderId, status: { in: statuses } },
      select: { id: true, inventoryId: true, quantity: true, status: true },
      orderBy: [{ inventoryId: "asc" }, { id: "asc" }],
    });
  }
  transitionReservation(
    id: string,
    from: "ACTIVE",
    status: "RELEASED" | "CONSUMED",
    now: Date,
    client: DatabaseClient,
  ) {
    return client.inventoryReservation.updateMany({
      where: { id, status: from },
      data: {
        status,
        ...(status === "RELEASED" ? { releasedAt: now } : { consumedAt: now }),
      },
    });
  }
  updateOrder(
    id: string,
    expectedVersion: number,
    from: string[],
    data: Prisma.OrderUpdateManyMutationInput,
    client: DatabaseClient,
  ) {
    return client.order.updateMany({
      where: { id, version: expectedVersion, status: { in: from as never[] } },
      data: { ...data, version: { increment: 1 } },
    });
  }
  idempotency(scope: string, keyHash: string, client: DatabaseClient) {
    return client.idempotencyRecord.findUnique({
      where: { scope_keyHash: { scope, keyHash } },
      select: { requestHash: true, status: true, responseBody: true },
    });
  }
  createIdempotency(
    userId: string,
    scope: string,
    keyHash: string,
    requestHash: string,
    client: DatabaseClient,
  ) {
    return client.idempotencyRecord.create({
      data: {
        userId,
        scope,
        keyHash,
        requestHash,
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    });
  }
  completeIdempotency(
    scope: string,
    keyHash: string,
    orderId: string,
    client: DatabaseClient,
  ) {
    return client.idempotencyRecord.update({
      where: { scope_keyHash: { scope, keyHash } },
      data: {
        status: "COMPLETED",
        responseStatus: 201,
        responseBody: { orderId },
        completedAt: new Date(),
      },
    });
  }
  dueOrderIds(limit: number) {
    return this.database.order.findMany({
      where: { status: "PENDING", paidAt: null, paymentDueAt: { lte: new Date() } },
      select: { id: true, version: true },
      orderBy: [{ paymentDueAt: "asc" }, { id: "asc" }],
      take: limit,
    });
  }
}
