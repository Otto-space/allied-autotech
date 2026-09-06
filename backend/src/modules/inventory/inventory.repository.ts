import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  InventoryCreateInput,
  InventoryHistoryQuery,
  InventoryListQuery,
  InventoryReservationListQuery,
} from "./inventory.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export const inventorySelect = {
  id: true,
  quantity: true,
  reserved: true,
  reorderLevel: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      priceKobo: true,
      currency: true,
      isActive: true,
      category: { select: { id: true, name: true, isActive: true } },
    },
  },
  branch: { select: { id: true, code: true, name: true, isActive: true } },
} satisfies Prisma.InventorySelect;

const transactionSelect = {
  id: true,
  type: true,
  quantityDelta: true,
  reservedDelta: true,
  quantityBefore: true,
  quantityAfter: true,
  reservedBefore: true,
  reservedAfter: true,
  referenceType: true,
  referenceId: true,
  note: true,
  createdAt: true,
  performedBy: { select: { id: true, role: true } },
} satisfies Prisma.InventoryTransactionSelect;

const reservationSelect = {
  id: true,
  quantity: true,
  status: true,
  expiresAt: true,
  releasedAt: true,
  consumedAt: true,
  expiredAt: true,
  referenceType: true,
  referenceId: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true } },
} satisfies Prisma.InventoryReservationSelect;

export class InventoryRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  staffBranch(userId: string, client: DatabaseClient = this.database) {
    return client.staffProfile.findUnique({
      where: { userId },
      select: { branchId: true, branch: { select: { isActive: true } } },
    });
  }

  async list(
    query: InventoryListQuery,
    allowedBranchId: string | null,
    client: DatabaseClient = this.database,
  ) {
    const branchId = allowedBranchId ?? query.branchId;
    const ids = await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Inventory"
      WHERE (${branchId ?? null}::uuid IS NULL OR "branchId" = ${branchId ?? null}::uuid)
        AND (${query.productId ?? null}::uuid IS NULL OR "productId" = ${query.productId ?? null}::uuid)
        AND (${query.lowStock ?? null}::boolean IS NULL OR ${query.lowStock ?? null}::boolean = false OR ("quantity" - "reserved") <= "reorderLevel")
        AND (${query.cursor ?? null}::uuid IS NULL OR "id" > ${query.cursor ?? null}::uuid)
      ORDER BY "id" ASC
      LIMIT ${query.limit + 1}
    `);
    if (ids.length === 0) return [];
    const items = await client.inventory.findMany({
      where: { id: { in: ids.map(({ id }) => id) } },
      select: inventorySelect,
    });
    const positions = new Map(ids.map(({ id }, index) => [id, index]));
    return items.sort(
      (left, right) => (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0),
    );
  }

  inventory(id: string, client: DatabaseClient = this.database) {
    return client.inventory.findUnique({ where: { id }, select: inventorySelect });
  }

  async lockInventory(id: string, client: Prisma.TransactionClient) {
    const rows = await client.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Inventory" WHERE "id" = ${id}::uuid FOR UPDATE`;
    if (rows.length === 0) return null;
    return this.inventory(id, client);
  }

  create(input: InventoryCreateInput, client: DatabaseClient) {
    return client.inventory.create({
      data: {
        productId: input.productId,
        branchId: input.branchId,
        reorderLevel: input.reorderLevel,
      },
      select: inventorySelect,
    });
  }

  updateReorderLevel(
    id: string,
    expectedVersion: number,
    reorderLevel: number,
    client: DatabaseClient,
  ) {
    return client.inventory.updateMany({
      where: { id, version: expectedVersion },
      data: { reorderLevel, version: { increment: 1 } },
    });
  }

  updateBalances(
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

  transactionByKey(idempotencyKey: string, client: DatabaseClient) {
    return client.inventoryTransaction.findUnique({
      where: { idempotencyKey },
      select: { requestHash: true, ...transactionSelect },
    });
  }

  createTransaction(
    data: Prisma.InventoryTransactionUncheckedCreateInput,
    client: DatabaseClient,
  ) {
    return client.inventoryTransaction.create({ data, select: transactionSelect });
  }

  history(
    inventoryId: string,
    query: InventoryHistoryQuery,
    client: DatabaseClient = this.database,
  ) {
    return client.inventoryTransaction.findMany({
      where: { inventoryId, ...(query.type === undefined ? {} : { type: query.type }) },
      select: transactionSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  reservationByKey(idempotencyKey: string, client: DatabaseClient) {
    return client.inventoryReservation.findUnique({
      where: { idempotencyKey },
      select: { requestHash: true, inventoryId: true, ...reservationSelect },
    });
  }

  reservation(id: string, inventoryId: string, client: DatabaseClient) {
    return client.inventoryReservation.findFirst({
      where: { id, inventoryId },
      select: reservationSelect,
    });
  }

  createReservation(
    data: Prisma.InventoryReservationUncheckedCreateInput,
    client: DatabaseClient,
  ) {
    return client.inventoryReservation.create({ data, select: reservationSelect });
  }

  transitionReservation(
    id: string,
    status: "RELEASED" | "CONSUMED" | "EXPIRED",
    now: Date,
    client: DatabaseClient,
  ) {
    return client.inventoryReservation.updateMany({
      where: { id, status: "ACTIVE" },
      data: {
        status,
        ...(status === "RELEASED" ? { releasedAt: now } : {}),
        ...(status === "CONSUMED" ? { consumedAt: now } : {}),
        ...(status === "EXPIRED" ? { expiredAt: now } : {}),
      },
    });
  }

  reservations(
    inventoryId: string,
    query: InventoryReservationListQuery,
    client: DatabaseClient = this.database,
  ) {
    return client.inventoryReservation.findMany({
      where: {
        inventoryId,
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      select: reservationSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
}
