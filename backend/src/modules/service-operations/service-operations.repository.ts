import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import type {
  AdminServiceListQuery,
  CustomerBookingListQuery,
  PublicBookingSlotListQuery,
  ServiceCreateInput,
  ServiceUpdateInput,
  StaffBookingSlotListQuery,
  StaffBookingListQuery,
} from "./service-operations.schemas.js";
import type { PricedLine } from "./service-operations.types.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export const serviceSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  shortDescription: true,
  pricingType: true,
  priceKobo: true,
  currency: true,
  durationMinutes: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ServiceSelect;

const lineSelect = {
  id: true,
  productId: true,
  type: true,
  description: true,
  quantity: true,
  unitPriceKobo: true,
  subtotalKobo: true,
  createdAt: true,
} satisfies Prisma.QuoteItemSelect;

const workLineSelect = {
  id: true,
  productId: true,
  type: true,
  description: true,
  quantity: true,
  unitPriceKobo: true,
  subtotalKobo: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkOrderItemSelect;

export const quoteSelect = {
  id: true,
  bookingId: true,
  quoteNumber: true,
  version: true,
  revision: true,
  status: true,
  currency: true,
  subtotalKobo: true,
  taxKobo: true,
  totalKobo: true,
  notes: true,
  expiresAt: true,
  issuedAt: true,
  acceptedAt: true,
  rejectedAt: true,
  voidedAt: true,
  createdAt: true,
  updatedAt: true,
  createdByStaff: { select: { id: true, firstName: true, lastName: true } },
  items: { select: lineSelect, orderBy: { id: "asc" as const } },
} satisfies Prisma.ServiceQuoteSelect;

export const workOrderSelect = {
  id: true,
  bookingId: true,
  workOrderNumber: true,
  status: true,
  diagnosis: true,
  internalNotes: true,
  openedAt: true,
  startedAt: true,
  completedAt: true,
  cancelledAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  items: { select: workLineSelect, orderBy: { id: "asc" as const } },
} satisfies Prisma.WorkOrderSelect;

export const bookingSlotSelect = {
  id: true,
  branchId: true,
  serviceId: true,
  staffId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, code: true, name: true, isActive: true } },
  service: { select: serviceSelect },
  staff: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.BookingSlotSelect;

const publicBookingSlotSelect = {
  id: true,
  branchId: true,
  serviceId: true,
  startsAt: true,
  endsAt: true,
  version: true,
  branch: { select: { id: true, code: true, name: true } },
  service: {
    select: {
      id: true,
      name: true,
      priceKobo: true,
      currency: true,
      durationMinutes: true,
    },
  },
} satisfies Prisma.BookingSlotSelect;

export const bookingSelect = {
  id: true,
  customerId: true,
  branchId: true,
  serviceId: true,
  vehicleId: true,
  assignedStaffId: true,
  bookingSlotId: true,
  scheduledAt: true,
  status: true,
  quotedPriceKobo: true,
  currency: true,
  customerNotes: true,
  staffNotes: true,
  cancellationReason: true,
  confirmedAt: true,
  startedAt: true,
  completedAt: true,
  cancelledAt: true,
  paymentHoldExpiresAt: true,
  depositBaseKobo: true,
  depositBasisPoints: true,
  depositAmountKobo: true,
  depositPolicyVersion: true,
  depositTermsAcceptedAt: true,
  depositPaidAt: true,
  depositForfeitedAt: true,
  customerRescheduleCount: true,
  scheduleVersion: true,
  disruptionRequestedAt: true,
  disruptionReason: true,
  disruptionResolution: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  service: { select: serviceSelect },
  branch: { select: { id: true, code: true, name: true, isActive: true } },
  vehicle: {
    select: { id: true, make: true, model: true, year: true, registrationNumber: true },
  },
  assignedStaff: { select: { id: true, firstName: true, lastName: true } },
  bookingSlot: { select: bookingSlotSelect },
  depositPayment: {
    select: {
      id: true,
      paymentNumber: true,
      amountKobo: true,
      currency: true,
      status: true,
      settledAttemptId: true,
      expiresAt: true,
      succeededAt: true,
    },
  },
  reminders: {
    select: {
      id: true,
      kind: true,
      scheduledFor: true,
      scheduleVersion: true,
      status: true,
      sentAt: true,
    },
    orderBy: [{ scheduledFor: "asc" as const }, { id: "asc" as const }],
  },
  quotes: { select: quoteSelect, orderBy: { version: "desc" as const } },
  workOrder: { select: workOrderSelect },
} satisfies Prisma.BookingSelect;

export class ServiceOperationsRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  listServices(query: AdminServiceListQuery, activeOnly: boolean) {
    return this.database.service.findMany({
      where: {
        ...(activeOnly
          ? { isActive: true }
          : query.isActive === undefined
            ? {}
            : { isActive: query.isActive }),
        ...(query.pricingType === undefined ? {} : { pricingType: query.pricingType }),
      },
      select: serviceSelect,
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  service(id: string, activeOnly: boolean, client: DatabaseClient = this.database) {
    return client.service.findFirst({
      where: { id, ...(activeOnly ? { isActive: true } : {}) },
      select: serviceSelect,
    });
  }

  createService(input: ServiceCreateInput, client: DatabaseClient) {
    return client.service.create({
      data: {
        name: input.name,
        slug: input.slug,
        pricingType: input.pricingType,
        priceKobo: input.priceKobo === null ? null : BigInt(input.priceKobo),
        currency: input.currency,
        durationMinutes: input.durationMinutes,
        isActive: input.isActive,
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.shortDescription === undefined
          ? {}
          : { shortDescription: input.shortDescription }),
      },
      select: serviceSelect,
    });
  }

  updateService(id: string, input: ServiceUpdateInput, client: DatabaseClient) {
    return client.service.updateMany({
      where: { id, version: input.expectedVersion },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.slug === undefined ? {} : { slug: input.slug }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.shortDescription === undefined
          ? {}
          : { shortDescription: input.shortDescription }),
        ...(input.pricingType === undefined ? {} : { pricingType: input.pricingType }),
        ...(input.priceKobo === undefined
          ? {}
          : { priceKobo: input.priceKobo === null ? null : BigInt(input.priceKobo) }),
        ...(input.currency === undefined ? {} : { currency: input.currency }),
        ...(input.durationMinutes === undefined
          ? {}
          : { durationMinutes: input.durationMinutes }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        version: { increment: 1 },
      },
    });
  }

  customerProfile(userId: string, client: DatabaseClient = this.database) {
    return client.customerProfile.findUnique({ where: { userId }, select: { id: true } });
  }

  staffProfile(userId: string, client: DatabaseClient = this.database) {
    return client.staffProfile.findUnique({
      where: { userId },
      select: { id: true, branchId: true, branch: { select: { isActive: true } } },
    });
  }

  publicBookingSlots(serviceId: string, query: PublicBookingSlotListQuery) {
    const now = new Date();
    return this.database.bookingSlot.findMany({
      where: {
        serviceId,
        branchId: query.branchId,
        status: "OPEN",
        startsAt: {
          gte: query.from === undefined ? now : new Date(query.from),
          ...(query.to === undefined ? {} : { lte: new Date(query.to) }),
        },
        bookings: {
          none: { status: { in: ["AWAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS"] } },
        },
      },
      select: publicBookingSlotSelect,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  listBookingSlots(query: StaffBookingSlotListQuery, branchId: string | null) {
    return this.database.bookingSlot.findMany({
      where: {
        ...(branchId === null
          ? query.branchId === undefined
            ? {}
            : { branchId: query.branchId }
          : { branchId }),
        ...(query.serviceId === undefined ? {} : { serviceId: query.serviceId }),
        ...(query.staffId === undefined ? {} : { staffId: query.staffId }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.startsFrom === undefined && query.startsTo === undefined
          ? {}
          : {
              startsAt: {
                ...(query.startsFrom === undefined
                  ? {}
                  : { gte: new Date(query.startsFrom) }),
                ...(query.startsTo === undefined ? {} : { lt: new Date(query.startsTo) }),
              },
            }),
      },
      select: bookingSlotSelect,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  bookingSlot(id: string, client: DatabaseClient = this.database) {
    return client.bookingSlot.findUnique({ where: { id }, select: bookingSlotSelect });
  }

  async lockBookingSlot(id: string, client: Prisma.TransactionClient) {
    const rows = await client.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "BookingSlot" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return rows.length === 0 ? null : this.bookingSlot(id, client);
  }

  createBookingSlot(
    data: Prisma.BookingSlotUncheckedCreateInput,
    client: DatabaseClient,
  ) {
    return client.bookingSlot.create({ data, select: bookingSlotSelect });
  }

  updateBookingSlot(
    id: string,
    expectedVersion: number,
    status: "OPEN" | "CLOSED",
    client: DatabaseClient,
  ) {
    return client.bookingSlot.updateMany({
      where: { id, version: expectedVersion },
      data: { status, version: { increment: 1 } },
    });
  }

  assignableStaff(id: string, client: DatabaseClient) {
    return client.staffProfile.findFirst({
      where: {
        id,
        user: { role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
      },
      select: { id: true, branchId: true },
    });
  }

  branch(id: string, client: DatabaseClient) {
    return client.branch.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
  }

  ownedVehicle(customerId: string, id: string, client: DatabaseClient) {
    return client.customerVehicle.findFirst({
      where: { id, customerId },
      select: { id: true },
    });
  }

  listCustomerBookings(customerId: string, query: CustomerBookingListQuery) {
    return this.database.booking.findMany({
      where: {
        customerId,
        ...(query.status === undefined ? {} : { status: query.status }),
      },
      select: {
        ...bookingSelect,
        quotes: {
          ...bookingSelect.quotes,
          where: { issuedAt: { not: null }, status: { not: "DRAFT" } },
        },
      },
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  listStaffBookings(
    query: StaffBookingListQuery,
    allowedBranchId: string | null,
    includePayment: boolean,
  ) {
    const branchId = allowedBranchId ?? query.branchId;
    return this.database.booking.findMany({
      where: {
        ...(branchId === undefined || branchId === null ? {} : { branchId }),
        ...(query.assignedStaffId === undefined
          ? {}
          : { assignedStaffId: query.assignedStaffId }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.scheduledFrom === undefined && query.scheduledTo === undefined
          ? {}
          : {
              scheduledAt: {
                ...(query.scheduledFrom === undefined
                  ? {}
                  : { gte: new Date(query.scheduledFrom) }),
                ...(query.scheduledTo === undefined
                  ? {}
                  : { lt: new Date(query.scheduledTo) }),
              },
            }),
      },
      select: {
        ...bookingSelect,
        depositPayment: includePayment ? bookingSelect.depositPayment : false,
      },
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  booking(id: string, client: DatabaseClient = this.database) {
    return client.booking.findUnique({ where: { id }, select: bookingSelect });
  }

  customerBooking(id: string, client: DatabaseClient = this.database) {
    return client.booking.findUnique({
      where: { id },
      select: {
        ...bookingSelect,
        quotes: {
          ...bookingSelect.quotes,
          where: { issuedAt: { not: null }, status: { not: "DRAFT" } },
        },
      },
    });
  }

  staffBooking(
    id: string,
    includePayment: boolean,
    client: DatabaseClient = this.database,
  ) {
    return client.booking.findUnique({
      where: { id },
      select: {
        ...bookingSelect,
        depositPayment: includePayment ? bookingSelect.depositPayment : false,
      },
    });
  }

  async lockBooking(id: string, client: Prisma.TransactionClient) {
    const rows = await client.$queryRaw<
      Array<{ id: string }>
    >`SELECT "id" FROM "Booking" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return rows.length === 0 ? null : this.booking(id, client);
  }

  createBooking(data: Prisma.BookingUncheckedCreateInput, client: DatabaseClient) {
    return client.booking.create({
      data,
      select: bookingSelect,
    });
  }

  updateBooking(
    id: string,
    expectedVersion: number,
    data: Prisma.BookingUncheckedUpdateManyInput,
    client: DatabaseClient,
  ) {
    return client.booking.updateMany({
      where: { id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
  }

  async hasScheduleConflict(
    staffId: string,
    start: Date,
    end: Date,
    excludeBookingId: string | null,
    client: Prisma.TransactionClient,
  ) {
    const rows = await client.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM "Booking" b
        JOIN "Service" s ON s."id" = b."serviceId"
        WHERE b."assignedStaffId" = ${staffId}::uuid
          AND b."status" IN ('REQUESTED', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS')
          AND (${excludeBookingId}::uuid IS NULL OR b."id" <> ${excludeBookingId}::uuid)
          AND b."scheduledAt" < ${end}
          AND b."scheduledAt" + make_interval(mins => COALESCE(s."durationMinutes", 60)) > ${start}
      ) AS "exists"
    `);
    return rows[0]?.exists ?? false;
  }

  async hasCustomerScheduleConflict(
    customerId: string,
    start: Date,
    end: Date,
    excludeBookingId: string | null,
    client: Prisma.TransactionClient,
  ) {
    const rows = await client.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM "Booking" b
        JOIN "Service" s ON s."id" = b."serviceId"
        WHERE b."customerId" = ${customerId}::uuid
          AND b."status" IN ('REQUESTED', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS')
          AND (${excludeBookingId}::uuid IS NULL OR b."id" <> ${excludeBookingId}::uuid)
          AND b."scheduledAt" < ${end}
          AND b."scheduledAt" + make_interval(mins => COALESCE(s."durationMinutes", 60)) > ${start}
      ) AS "exists"
    `);
    return rows[0]?.exists ?? false;
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
    bookingId: string,
    client: DatabaseClient,
    responseStatus = 201,
  ) {
    return client.idempotencyRecord.update({
      where: { scope_keyHash: { scope, keyHash } },
      data: {
        status: "COMPLETED",
        responseStatus,
        responseBody: { bookingId },
        completedAt: new Date(),
      },
      select: { id: true },
    });
  }

  products(ids: string[], client: DatabaseClient) {
    return client.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true, priceKobo: true },
    });
  }

  latestQuoteVersion(bookingId: string, client: DatabaseClient) {
    return client.serviceQuote.aggregate({
      where: { bookingId },
      _max: { version: true },
    });
  }

  quote(id: string, bookingId: string, client: DatabaseClient = this.database) {
    return client.serviceQuote.findFirst({
      where: { id, bookingId },
      select: quoteSelect,
    });
  }

  createQuote(
    bookingId: string,
    staffId: string,
    quoteNumber: string,
    versionNumber: number,
    lines: PricedLine[],
    taxKobo: bigint,
    notes: string | null | undefined,
    expiresAt: Date,
    client: DatabaseClient,
  ) {
    const subtotalKobo = lines.reduce((sum, line) => sum + line.subtotalKobo, 0n);
    return client.serviceQuote.create({
      data: {
        bookingId,
        createdByStaffId: staffId,
        quoteNumber,
        version: versionNumber,
        subtotalKobo,
        taxKobo,
        totalKobo: subtotalKobo + taxKobo,
        expiresAt,
        ...(notes === undefined ? {} : { notes }),
        items: { createMany: { data: lines } },
      },
      select: quoteSelect,
    });
  }

  async reviseQuote(
    id: string,
    expectedRevision: number,
    bookingId: string,
    staffId: string,
    quoteNumber: string,
    versionNumber: number,
    lines: PricedLine[],
    taxKobo: bigint,
    notes: string | null | undefined,
    expiresAt: Date,
    client: Prisma.TransactionClient,
  ) {
    const updated = await client.serviceQuote.updateMany({
      where: { id, status: "DRAFT", revision: expectedRevision },
      data: {
        status: "VOID",
        voidedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    if (updated.count !== 1) return null;
    return this.createQuote(
      bookingId,
      staffId,
      quoteNumber,
      versionNumber,
      lines,
      taxKobo,
      notes,
      expiresAt,
      client,
    );
  }

  transitionQuote(
    id: string,
    expectedRevision: number,
    from: readonly ("DRAFT" | "ISSUED")[],
    data: Prisma.ServiceQuoteUpdateManyMutationInput,
    client: DatabaseClient,
  ) {
    return client.serviceQuote.updateMany({
      where: { id, status: { in: [...from] }, revision: expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });
  }

  voidOtherIssuedQuotes(
    bookingId: string,
    exceptId: string,
    now: Date,
    client: DatabaseClient,
  ) {
    return client.serviceQuote.updateMany({
      where: { bookingId, id: { not: exceptId }, status: "ISSUED" },
      data: { status: "VOID", voidedAt: now, revision: { increment: 1 } },
    });
  }

  workOrder(id: string, bookingId: string, client: DatabaseClient = this.database) {
    return client.workOrder.findFirst({
      where: { id, bookingId },
      select: workOrderSelect,
    });
  }

  createWorkOrder(
    bookingId: string,
    number: string,
    diagnosis: string | null | undefined,
    notes: string | null | undefined,
    lines: PricedLine[],
    client: DatabaseClient,
  ) {
    return client.workOrder.create({
      data: {
        bookingId,
        workOrderNumber: number,
        ...(diagnosis === undefined ? {} : { diagnosis }),
        ...(notes === undefined ? {} : { internalNotes: notes }),
        items: { createMany: { data: lines } },
      },
      select: workOrderSelect,
    });
  }

  async updateWorkOrder(
    id: string,
    expectedVersion: number,
    diagnosis: string | null | undefined,
    notes: string | null | undefined,
    additionalLines: PricedLine[] | undefined,
    client: Prisma.TransactionClient,
  ) {
    const updated = await client.workOrder.updateMany({
      where: {
        id,
        version: expectedVersion,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: {
        ...(diagnosis === undefined ? {} : { diagnosis }),
        ...(notes === undefined ? {} : { internalNotes: notes }),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) return null;
    if (additionalLines !== undefined) {
      await client.workOrderItem.createMany({
        data: additionalLines.map((line) => ({ ...line, workOrderId: id })),
      });
    }
    return client.workOrder.findUniqueOrThrow({ where: { id }, select: workOrderSelect });
  }

  transitionWorkOrder(
    id: string,
    expectedVersion: number,
    from: readonly string[],
    data: Prisma.WorkOrderUpdateManyMutationInput,
    client: DatabaseClient,
  ) {
    return client.workOrder.updateMany({
      where: { id, version: expectedVersion, status: { in: from as never[] } },
      data: { ...data, version: { increment: 1 } },
    });
  }
}
