import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { PaymentListQuery, StaffPaymentListQuery } from "./payments.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
export const paymentSelect = {
  id: true,
  paymentNumber: true,
  purpose: true,
  amountKobo: true,
  currency: true,
  status: true,
  orderId: true,
  invoiceId: true,
  vehicleTransactionId: true,
  bookingId: true,
  expiresAt: true,
  succeededAt: true,
  cancelledAt: true,
  expiredAt: true,
  createdAt: true,
  attempts: {
    select: {
      id: true,
      attemptNumber: true,
      provider: true,
      method: true,
      status: true,
      verificationStatus: true,
      amountKobo: true,
      currency: true,
      initiatedAt: true,
      paidAt: true,
      verifiedAt: true,
      manualReview: {
        select: {
          status: true,
          bankReference: true,
          payerName: true,
          transferredAt: true,
          evidenceSha256: true,
          submittedAt: true,
          reviewedAt: true,
        },
      },
    },
    orderBy: { attemptNumber: "desc" as const },
  },
} satisfies Prisma.PaymentSelect;

export class PaymentsRepository {
  constructor(private readonly database: PrismaClient = prisma) {}
  customerProfile(userId: string, client: DatabaseClient = this.database) {
    return client.customerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: { select: { email: true } },
      },
    });
  }
  staffProfile(userId: string, client: DatabaseClient = this.database) {
    return client.staffProfile.findUnique({
      where: { userId },
      select: { branchId: true, branch: { select: { isActive: true } } },
    });
  }
  order(id: string, customerId: string, client: DatabaseClient) {
    return client.order.findFirst({
      where: { id, customerId },
      select: {
        id: true,
        customerId: true,
        status: true,
        totalKobo: true,
        currency: true,
        paymentDueAt: true,
      },
    });
  }
  invoice(id: string, customerId: string, client: DatabaseClient) {
    return client.invoice.findFirst({
      where: { id, customerId },
      select: {
        id: true,
        customerId: true,
        status: true,
        totalKobo: true,
        currency: true,
        dueAt: true,
        bookingId: true,
      },
    });
  }
  vehicleTransaction(id: string, customerId: string, client: DatabaseClient) {
    return client.vehicleTransaction.findFirst({
      where: { id, customerId },
      select: {
        id: true,
        customerId: true,
        status: true,
        agreedPriceKobo: true,
        reservationRequiredKobo: true,
        currency: true,
        reservationExpiresAt: true,
      },
    });
  }
  settledVehicleAmount(id: string, client: DatabaseClient) {
    return client.payment.aggregate({
      where: { vehicleTransactionId: id, status: "SUCCEEDED" },
      _sum: { amountKobo: true },
    });
  }
  byIdempotency(hash: string, customerId: string, client: DatabaseClient) {
    return client.payment.findUnique({
      where: { idempotencyKeyHash: hash, customerId },
      select: paymentSelect,
    });
  }
  create(data: Prisma.PaymentUncheckedCreateInput, client: DatabaseClient) {
    return client.payment.create({ data, select: paymentSelect });
  }
  get(id: string, client: DatabaseClient = this.database) {
    return client.payment.findUnique({
      where: { id },
      select: { ...paymentSelect, customerId: true },
    });
  }
  owned(id: string, customerId: string, client: DatabaseClient = this.database) {
    return client.payment.findFirst({ where: { id, customerId }, select: paymentSelect });
  }
  listCustomer(customerId: string, query: PaymentListQuery) {
    return this.database.payment.findMany({
      where: { customerId, ...(query.status ? { status: query.status } : {}) },
      select: paymentSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }
  listStaff(query: StaffPaymentListQuery, branchId: string | null) {
    return this.database.payment.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.provider ? { attempts: { some: { provider: query.provider } } } : {}),
        ...(branchId
          ? {
              OR: [
                { order: { branchId } },
                {
                  invoice: {
                    OR: [
                      { order: { branchId } },
                      { booking: { branchId } },
                      { vehicleTransaction: { vehicleListing: { branchId } } },
                    ],
                  },
                },
                { vehicleTransaction: { vehicleListing: { branchId } } },
                { booking: { branchId } },
              ],
            }
          : {}),
      },
      select: paymentSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }
  paymentBranch(id: string, client: DatabaseClient = this.database) {
    return client.payment.findUnique({
      where: { id },
      select: {
        order: { select: { branchId: true } },
        invoice: {
          select: {
            order: { select: { branchId: true } },
            booking: { select: { branchId: true } },
            vehicleTransaction: {
              select: { vehicleListing: { select: { branchId: true } } },
            },
          },
        },
        vehicleTransaction: {
          select: { vehicleListing: { select: { branchId: true } } },
        },
        booking: { select: { branchId: true } },
      },
    });
  }
  async lockPayment(id: string, client: Prisma.TransactionClient) {
    const rows = await client.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Payment" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return rows.length ? this.get(id, client) : null;
  }
  attempt(id: string, client: DatabaseClient = this.database) {
    return client.paymentAttempt.findUnique({
      where: { id },
      include: { payment: true, manualReview: true },
    });
  }
  attemptByReference(reference: string, client: DatabaseClient = this.database) {
    return client.paymentAttempt.findUnique({
      where: { internalReference: reference },
      include: { payment: true },
    });
  }
  createAttempt(data: Prisma.PaymentAttemptUncheckedCreateInput, client: DatabaseClient) {
    return client.paymentAttempt.create({ data });
  }
}
