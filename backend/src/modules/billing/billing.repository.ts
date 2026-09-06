import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  CustomerInvoiceListQuery,
  StaffInvoiceListQuery,
} from "./billing.schemas.js";
type DatabaseClient = PrismaClient | Prisma.TransactionClient;
export const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  currency: true,
  subtotalKobo: true,
  taxKobo: true,
  totalKobo: true,
  status: true,
  version: true,
  issuedAt: true,
  dueAt: true,
  paidAt: true,
  voidedAt: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      branch: { select: { id: true, code: true, name: true } },
    },
  },
  booking: {
    select: {
      id: true,
      status: true,
      branch: { select: { id: true, code: true, name: true } },
    },
  },
  vehicleTransaction: {
    select: {
      id: true,
      transactionNumber: true,
      status: true,
      vehicleListing: {
        select: { branch: { select: { id: true, code: true, name: true } } },
      },
    },
  },
  payments: {
    select: {
      id: true,
      paymentNumber: true,
      status: true,
      amountKobo: true,
      currency: true,
      succeededAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.InvoiceSelect;

export class BillingRepository {
  constructor(private readonly database: PrismaClient = prisma) {}
  customerProfile(userId: string, client: DatabaseClient = this.database) {
    return client.customerProfile.findUnique({ where: { userId }, select: { id: true } });
  }
  staffBranch(userId: string, client: DatabaseClient = this.database) {
    return client.staffProfile.findUnique({
      where: { userId },
      select: { branchId: true, branch: { select: { isActive: true } } },
    });
  }
  listCustomer(customerId: string, query: CustomerInvoiceListQuery) {
    return this.database.invoice.findMany({
      where: { customerId, status: query.status ?? { not: "DRAFT" } },
      select: invoiceSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  listStaff(query: StaffInvoiceListQuery, allowedBranchId: string | null) {
    const branchId = allowedBranchId ?? query.branchId;
    return this.database.invoice.findMany({
      where: {
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.customerId === undefined ? {} : { customerId: query.customerId }),
        ...(branchId === undefined || branchId === null
          ? {}
          : {
              OR: [
                { order: { branchId } },
                { booking: { branchId } },
                { vehicleTransaction: { vehicleListing: { branchId } } },
              ],
            }),
      },
      select: invoiceSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  invoice(id: string, client: DatabaseClient = this.database) {
    return client.invoice.findUnique({ where: { id }, select: invoiceSelect });
  }
  ownedInvoice(id: string, customerId: string) {
    return this.database.invoice.findFirst({
      where: { id, customerId, status: { not: "DRAFT" } },
      select: invoiceSelect,
    });
  }
  async lockInvoice(id: string, client: Prisma.TransactionClient) {
    const rows = await client.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Invoice" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return rows.length === 0 ? null : this.invoice(id, client);
  }
  orderSource(id: string, client: DatabaseClient) {
    return client.order.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        branchId: true,
        status: true,
        currency: true,
        totalKobo: true,
        invoice: { select: { id: true } },
      },
    });
  }
  bookingSource(id: string, client: DatabaseClient) {
    return client.booking.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        branchId: true,
        status: true,
        invoice: { select: { id: true } },
        quotes: {
          where: { status: "ACCEPTED" },
          select: { subtotalKobo: true, taxKobo: true, totalKobo: true, currency: true },
          take: 1,
        },
      },
    });
  }
  vehicleSource(id: string, client: DatabaseClient) {
    return client.vehicleTransaction.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        status: true,
        agreedPriceKobo: true,
        currency: true,
        invoice: { select: { id: true } },
        vehicleListing: { select: { branchId: true } },
      },
    });
  }
  create(data: Prisma.InvoiceUncheckedCreateInput, client: DatabaseClient) {
    return client.invoice.create({ data, select: invoiceSelect });
  }
  transition(
    id: string,
    expectedVersion: number,
    from: Array<"DRAFT" | "ISSUED">,
    data: Prisma.InvoiceUpdateManyMutationInput,
    client: DatabaseClient,
  ) {
    return client.invoice.updateMany({
      where: { id, version: expectedVersion, status: { in: from } },
      data: { ...data, version: { increment: 1 } },
    });
  }
}
