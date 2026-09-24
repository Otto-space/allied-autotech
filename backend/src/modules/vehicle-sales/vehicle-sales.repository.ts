import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type {
  CustomerInspectionListQuery,
  CustomerTransactionListQuery,
  StaffInspectionListQuery,
  StaffTransactionListQuery,
} from "./vehicle-sales.schemas.js";
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export const inspectionSelect = {
  id: true,
  customerId: true,
  vehicleListingId: true,
  assignedStaffId: true,
  customerName: true,
  preferredStartAt: true,
  preferredEndAt: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  status: true,
  notes: true,
  cancellationReason: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  confirmedAt: true,
  completedAt: true,
  cancelledAt: true,
  vehicleListing: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      branchId: true,
      vehicle: { select: { make: true, model: true, year: true, stockNumber: true } },
    },
  },
  assignedStaff: { select: { id: true, firstName: true, lastName: true } },
  conditionReport: {
    select: {
      id: true,
      odometerKm: true,
      conditionScore: true,
      summary: true,
      findings: true,
      inspectedAt: true,
    },
  },
} satisfies Prisma.InspectionRequestSelect;

export const transactionSelect = {
  id: true,
  vehicleListingId: true,
  customerId: true,
  sourceInspectionId: true,
  transactionNumber: true,
  customerName: true,
  askingPriceKobo: true,
  agreedPriceKobo: true,
  reservationRequiredKobo: true,
  currency: true,
  status: true,
  reservationExpiresAt: true,
  paidHoldStartsAt: true,
  paidHoldExpiresAt: true,
  termsVersion: true,
  termsAcceptedAt: true,
  cancellationReason: true,
  version: true,
  paidAt: true,
  handoverPendingAt: true,
  completedAt: true,
  cancelledAt: true,
  expiredAt: true,
  createdAt: true,
  updatedAt: true,
  vehicleListing: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      branchId: true,
      priceKobo: true,
      vehicle: {
        select: {
          id: true,
          stockNumber: true,
          make: true,
          model: true,
          year: true,
          images: {
            select: { id: true, url: true, altText: true, isPrimary: true },
            orderBy: { sortOrder: "asc" as const },
          },
        },
      },
    },
  },
  statusHistory: {
    select: { id: true, fromStatus: true, toStatus: true, reason: true, createdAt: true },
    orderBy: { createdAt: "asc" as const },
  },
  handover: {
    select: {
      id: true,
      status: true,
      recipientName: true,
      recipientPhone: true,
      odometerKm: true,
      keysDelivered: true,
      readyAt: true,
      completedAt: true,
      cancelledAt: true,
      version: true,
      createdAt: true,
    },
  },
} satisfies Prisma.VehicleTransactionSelect;

export class VehicleSalesRepository {
  constructor(private readonly database: PrismaClient = prisma) {}
  customer(userId: string, client: DatabaseClient = this.database) {
    return client.customerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        user: { select: { email: true } },
      },
    });
  }
  staff(userId: string, client: DatabaseClient = this.database) {
    return client.staffProfile.findUnique({
      where: { userId },
      select: { id: true, branchId: true, branch: { select: { isActive: true } } },
    });
  }
  publicListing(id: string, client: DatabaseClient = this.database) {
    return client.vehicleListing.findFirst({
      where: { id, status: "AVAILABLE", branch: { isActive: true } },
      select: {
        id: true,
        branchId: true,
        vehicleId: true,
        title: true,
        priceKobo: true,
        currency: true,
        status: true,
      },
    });
  }
  listCustomerInspections(customerId: string, query: CustomerInspectionListQuery) {
    return this.database.inspectionRequest.findMany({
      where: {
        customerId,
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      select: inspectionSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  listStaffInspections(query: StaffInspectionListQuery, branchId: string | null) {
    const effectiveBranch = branchId ?? query.branchId;
    return this.database.inspectionRequest.findMany({
      where: {
        vehicleListing:
          effectiveBranch === undefined ? {} : { branchId: effectiveBranch },
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      select: inspectionSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  inspection(id: string, client: DatabaseClient = this.database) {
    return client.inspectionRequest.findUnique({
      where: { id },
      select: inspectionSelect,
    });
  }
  async lockInspection(id: string, client: Prisma.TransactionClient) {
    await client.$queryRaw`SELECT "id" FROM "InspectionRequest" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return this.inspection(id, client);
  }
  listCustomerTransactions(customerId: string, query: CustomerTransactionListQuery) {
    return this.database.vehicleTransaction.findMany({
      where: {
        customerId,
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      select: transactionSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  listStaffTransactions(query: StaffTransactionListQuery, branchId: string | null) {
    const effectiveBranch = branchId ?? query.branchId;
    return this.database.vehicleTransaction.findMany({
      where: {
        vehicleListing:
          effectiveBranch === undefined ? {} : { branchId: effectiveBranch },
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      select: transactionSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  transaction(id: string, client: DatabaseClient = this.database) {
    return client.vehicleTransaction.findUnique({
      where: { id },
      select: transactionSelect,
    });
  }
  async lockListing(id: string, client: Prisma.TransactionClient) {
    await client.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return client.vehicleListing.findUnique({
      where: { id },
      select: {
        id: true,
        branchId: true,
        vehicleId: true,
        status: true,
        priceKobo: true,
        version: true,
      },
    });
  }
  async lockTransaction(id: string, client: Prisma.TransactionClient) {
    await client.$queryRaw`SELECT "id" FROM "VehicleTransaction" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return this.transaction(id, client);
  }
  async updateTransaction(
    id: string,
    expectedVersion: number,
    status: string,
    data: Prisma.VehicleTransactionUncheckedUpdateManyInput,
    client: DatabaseClient,
  ) {
    const result = await client.vehicleTransaction.updateMany({
      where: { id, version: expectedVersion, status: status as never },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count === 1 ? this.transaction(id, client) : null;
  }
  history(
    id: string,
    userId: string | null,
    fromStatus: Prisma.VehicleTransactionStatusHistoryUncheckedCreateInput["fromStatus"],
    toStatus: Prisma.VehicleTransactionStatusHistoryUncheckedCreateInput["toStatus"],
    reason: string | undefined,
    client: DatabaseClient,
  ) {
    return client.vehicleTransactionStatusHistory.create({
      data: {
        vehicleTransactionId: id,
        changedByUserId: userId,
        fromStatus: fromStatus ?? null,
        toStatus,
        reason: reason ?? null,
      },
      select: { id: true },
    });
  }
  idempotency(scope: string, keyHash: string, client: DatabaseClient) {
    return client.idempotencyRecord.findUnique({
      where: { scope_keyHash: { scope, keyHash } },
      select: { status: true, requestHash: true, responseBody: true },
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
        expiresAt: new Date(Date.now() + 86_400_000),
      },
      select: { id: true },
    });
  }
  completeIdempotency(
    scope: string,
    keyHash: string,
    transactionId: string,
    client: DatabaseClient,
  ) {
    return client.idempotencyRecord.update({
      where: { scope_keyHash: { scope, keyHash } },
      data: {
        status: "COMPLETED",
        responseStatus: 200,
        responseBody: { transactionId },
        completedAt: new Date(),
      },
      select: { id: true },
    });
  }
}
