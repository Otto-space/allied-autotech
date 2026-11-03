import {
  workshopResourceAvailabilitySelect,
  type WorkshopResourceAvailability,
} from "./booking-resource-availability.js";
import { selectWorkshopResources, type WorkshopResources } from "./workshop-resources.js";
import { technicianConflictSelect } from "./booking-slot-timing.js";
import type { capacitySettingsSchema } from "./booking-capacity.js";
import { bookedJobMinutes } from "./booking-timing.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { resourceImageSelect } from "../media/media.projection.js";
import { projectServiceImage } from "./service-media.service.js";
import { publicServiceCopy } from "./public-service-copy.js";
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
  timingVersion: true,
  preparationMinutes: true,
  cleanupMinutes: true,
  durationMinutes: true,
  isActive: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ServiceSelect;

export const serviceCatalogueSelect = {
  ...serviceSelect,
  categoryId: true,
  category: { select: { id: true, name: true, slug: true, isActive: true } },
  mediaImages: { select: resourceImageSelect, take: 1 },
} satisfies Prisma.ServiceSelect;

export function projectCatalogueService(
  row: Prisma.ServiceGetPayload<{ select: typeof serviceCatalogueSelect }>,
  publicRead: boolean,
) {
  const {
    mediaImages,
    category,
    preparationMinutes,
    cleanupMinutes,
    timingVersion,
    ...service
  } = row;
  const visibleCategory =
    category && (!publicRead || category.isActive)
      ? { id: category.id, name: category.name, slug: category.slug }
      : null;
  return {
    ...service,
    ...(!publicRead ? { preparationMinutes, cleanupMinutes, timingVersion } : {}),
    ...(publicRead
      ? {
          description: publicServiceCopy(service.description),
          shortDescription: publicServiceCopy(service.shortDescription),
        }
      : {}),
    categoryId: publicRead ? (visibleCategory?.id ?? null) : service.categoryId,
    category: visibleCategory,
    image: mediaImages[0]
      ? projectServiceImage(mediaImages[0], service.id, publicRead)
      : null,
  };
}

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
  durationMinutes: true,
  preparationMinutes: true,
  cleanupMinutes: true,
  serviceTimingVersion: true,
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
  timingSnapshots: {
    select: {
      scheduleVersion: true,
      scheduledAt: true,
      durationMinutes: true,
      preparationMinutes: true,
      cleanupMinutes: true,
      source: true,
      reason: true,
      createdAt: true,
    },
    orderBy: { scheduleVersion: "desc" as const },
    take: 10,
  },
  rescheduleRequests: {
    select: {
      id: true,
      status: true,
      source: true,
      branchId: true,
      slotId: true,
      startsAt: true,
      reason: true,
      createdAt: true,
      decidedAt: true,
      decisionReason: true,
    },
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 10,
  },
  requestedAt: true,
  attendanceConfirmedAt: true,
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
  requestedServiceCategoryId: true,
  requestedServiceCategoryName: true,
  customerConcern: true,
  alternativeStartsAt: true,
  alternativeReason: true,
  alternativeVersion: true,
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

  async listServices(query: AdminServiceListQuery, activeOnly: boolean) {
    const rows = await this.database.service.findMany({
      where: {
        ...(activeOnly
          ? { isActive: true }
          : query.isActive === undefined
            ? {}
            : { isActive: query.isActive }),
        ...(query.pricingType === undefined ? {} : { pricingType: query.pricingType }),
        ...(!activeOnly && query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(!activeOnly && query.search
          ? {
              OR: ["name", "shortDescription", "description"].map((field) => ({
                [field]: {
                  contains: query.search!.replace(/[\\%_]/g, "\\$&"),
                  mode: "insensitive",
                },
              })),
            }
          : {}),
        // Administrator cursors are UUID positions, independent of the anchor's
        // continued existence or membership in the current filter.
        ...(!activeOnly && query.cursor ? { id: { gt: query.cursor } } : {}),
      },
      select: serviceCatalogueSelect,
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(activeOnly && query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    return rows.map((row) => projectCatalogueService(row, activeOnly));
  }

  async service(id: string, activeOnly: boolean, client: DatabaseClient = this.database) {
    const row = await client.service.findFirst({
      where: { id, ...(activeOnly ? { isActive: true } : {}) },
      select: serviceCatalogueSelect,
    });
    if (!row) return null;
    return {
      ...projectCatalogueService(row, activeOnly),
      timingVersion: row.timingVersion,
      preparationMinutes: row.preparationMinutes,
      cleanupMinutes: row.cleanupMinutes,
    };
  }

  createService(input: ServiceCreateInput, client: DatabaseClient) {
    return client.service.create({
      data: {
        name: input.name,
        categoryId: input.categoryId ?? null,
        slug: input.slug,
        pricingType: input.pricingType,
        priceKobo: input.priceKobo === null ? null : BigInt(input.priceKobo),
        currency: input.currency,
        preparationMinutes: input.preparationMinutes ?? null,
        cleanupMinutes: input.cleanupMinutes ?? null,
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

  updateService(
    id: string,
    input: ServiceUpdateInput,
    client: DatabaseClient,
    timingChanged = false,
  ) {
    return client.service.updateMany({
      where: { id, version: input.expectedVersion },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
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
        ...(timingChanged ? { timingVersion: { increment: 1 } } : {}),
        ...(input.preparationMinutes === undefined
          ? {}
          : { preparationMinutes: input.preparationMinutes }),
        ...(input.cleanupMinutes === undefined
          ? {}
          : { cleanupMinutes: input.cleanupMinutes }),
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

  async publicBookingSlots(
    serviceId: string,
    query: PublicBookingSlotListQuery,
    calendar: ReturnType<typeof capacitySettingsSchema.parse>,
    resources: WorkshopResources,
    eligibleStaffIds: string[],
    client: DatabaseClient = this.database,
  ) {
    const from = query.from === undefined ? new Date() : new Date(query.from),
      to = query.to === undefined ? new Date("9999-01-01") : new Date(query.to);
    const starts = Prisma.sql`slot."startsAt"-make_interval(mins=>slot."preparationMinutes")`;
    const ends = Prisma.sql`slot."endsAt"+make_interval(mins=>slot."cleanupMinutes")`;
    if (eligibleStaffIds.length === 0) return [];
    const needsResources =
      (resources.services.find((row) => row.serviceId === serviceId)?.requirements
        .length ?? 0) > 0;
    const availabilityQuery = needsResources
      ? workshopResourceAvailabilitySelect(Prisma.sql`slot."branchId"`, starts, ends)
      : Prisma.sql`SELECT false AS "legacyUnassessed", ARRAY[]::uuid[] AS "busyResourceIds"`;
    const batchSize = Math.max(50, query.limit + 1);
    const accepted: string[] = [];
    let scanCursor = query.cursor ?? null;
    // Filter before output pagination. Exhausted early candidates must not hide a
    // later available offer or produce a cursor based on private resource rows.
    while (accepted.length < query.limit + 1) {
      const candidates = await client.$queryRaw<
        Array<
          WorkshopResourceAvailability & {
            id: string;
            staffId: string;
            occupiedStartsAt: Date;
            occupiedEndsAt: Date;
          }
        >
      >(Prisma.sql`
      SELECT slot."id",slot."staffId",${starts} AS "occupiedStartsAt",${ends} AS "occupiedEndsAt",availability.* FROM "BookingSlot" slot JOIN "Service" service ON service."id"=slot."serviceId"
      JOIN "Branch" branch ON branch."id"=slot."branchId"
      JOIN "StaffProfile" staff ON staff."id"=slot."staffId" JOIN "User" worker ON worker."id"=staff."userId"
      CROSS JOIN LATERAL (${availabilityQuery}) availability
      WHERE slot."serviceId"=${serviceId}::uuid AND slot."branchId"=${query.branchId}::uuid AND slot."status"='OPEN'
      AND slot."staffId"=ANY(${eligibleStaffIds}::uuid[]) AND branch."isActive" AND worker."status"='ACTIVE' AND worker."role" IN ('STAFF','ADMIN','SUPER_ADMIN') AND worker."emailVerifiedAt" IS NOT NULL AND staff."branchId"=slot."branchId"
      AND service."isActive" AND service."pricingType"='FIXED' AND service."priceKobo" IS NOT NULL
      AND slot."serviceTimingVersion"=service."timingVersion" AND slot."durationMinutes"=service."durationMinutes"
      AND slot."preparationMinutes"=service."preparationMinutes" AND slot."cleanupMinutes"=service."cleanupMinutes"
      AND slot."startsAt">=${from} AND slot."startsAt"<=${to}
      AND (${scanCursor}::uuid IS NULL OR (slot."startsAt",slot."id")>(SELECT c."startsAt",c."id" FROM "BookingSlot" c WHERE c."id"=${scanCursor}::uuid AND c."serviceId"=${serviceId}::uuid AND c."branchId"=${query.branchId}::uuid))
      AND NOT EXISTS (SELECT 1 FROM "Booking" held WHERE held."bookingSlotId"=slot."id" AND held."status" IN ('REQUESTED','AWAITING_DEPOSIT','CONFIRMED','IN_PROGRESS'))
      AND NOT EXISTS (${technicianConflictSelect(Prisma.sql`slot."staffId"`, starts, ends, Prisma.sql`NULL::uuid`)})
      AND EXTRACT(DOW FROM (${starts}+interval '1 hour'))::integer=ANY(${calendar.openingDays}::integer[])
      AND (${starts}+interval '1 hour')::date::text<>ALL(${calendar.holidays}::text[])
      AND (${starts}+interval '1 hour')::date=(${ends}+interval '1 hour')::date
      AND (${starts}+interval '1 hour')::time >= TIME '08:00' AND (${ends}+interval '1 hour')::time<=TIME '18:00'
      AND (SELECT count(*) FROM "Booking" used WHERE used."branchId"=slot."branchId" AND used."status" IN ('CONFIRMED','IN_PROGRESS','COMPLETED','NO_SHOW')
       AND (used."scheduledAt"+interval '1 hour')::date=(slot."startsAt"+interval '1 hour')::date)<${calendar.dailyLimit}
      ORDER BY slot."startsAt",slot."id" LIMIT ${batchSize}
    `);
      for (const candidate of candidates) {
        if (
          !candidate.legacyUnassessed &&
          selectWorkshopResources(resources, {
            serviceId,
            staffId: candidate.staffId,
            startsAt: candidate.occupiedStartsAt,
            endsAt: candidate.occupiedEndsAt,
            busyResourceIds: new Set(
              candidate.busyResourceIds.map((id) => id.toLowerCase()),
            ),
          }).ok
        )
          accepted.push(candidate.id);
        if (accepted.length === query.limit + 1) break;
      }
      if (candidates.length < batchSize) break;
      scanCursor = candidates.at(-1)!.id;
    }
    return client.bookingSlot.findMany({
      where: { id: { in: accepted } },
      select: publicBookingSlotSelect,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
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
    const range = {
      ...(query.scheduledFrom ? { gte: new Date(query.scheduledFrom) } : {}),
      ...(query.scheduledTo ? { lt: new Date(query.scheduledTo) } : {}),
    };
    return this.database.booking.findMany({
      where: {
        customerId,
        ...(query.scheduledFrom || query.scheduledTo
          ? {
              OR: [
                { scheduledAt: range },
                {
                  status: { in: ["REQUESTED", "CONFIRMED"] },
                  alternativeStartsAt: range,
                },
              ],
            }
          : {}),
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

  async staffBooking(
    id: string,
    includePayment: boolean,
    client: DatabaseClient = this.database,
  ) {
    const row = await client.booking.findUnique({
      where: { id },
      select: {
        ...bookingSelect,
        rescheduleRequests: {
          ...bookingSelect.rescheduleRequests,
          select: {
            ...bookingSelect.rescheduleRequests.select,
            slot: {
              select: {
                staff: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        depositPayment: includePayment ? bookingSelect.depositPayment : false,
      },
    });
    return row
      ? {
          ...row,
          service: row.service
            ? { ...row.service, durationMinutes: bookedJobMinutes(row) }
            : null,
          rescheduleRequests: row.rescheduleRequests.map(({ slot, ...request }) => ({
            ...request,
            proposedStaff:
              includePayment || request.branchId === row.branchId
                ? (slot?.staff ?? null)
                : null,
          })),
        }
      : null;
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
      SELECT EXISTS (${technicianConflictSelect(Prisma.sql`${staffId}::uuid`, Prisma.sql`${start}::timestamp`, Prisma.sql`${end}::timestamp`, Prisma.sql`${excludeBookingId}::uuid`)}) AS "exists"
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
        LEFT JOIN "Service" s ON s."id" = b."serviceId"
        LEFT JOIN "BookingTimingSnapshot" t ON t."bookingId"=b."id" AND t."scheduleVersion"=b."scheduleVersion"
        WHERE b."customerId" = ${customerId}::uuid
          AND b."status" IN ('REQUESTED', 'AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS')
          AND (${excludeBookingId}::uuid IS NULL OR b."id" <> ${excludeBookingId}::uuid)
          AND (
            ((CASE WHEN t."id" IS NOT NULL THEN t."durationMinutes" ELSE s."durationMinutes" END) IS NOT NULL
              AND b."scheduledAt" < ${end}
              AND b."scheduledAt" + make_interval(mins => CASE WHEN t."id" IS NOT NULL THEN t."durationMinutes" ELSE s."durationMinutes" END) > ${start})
            OR ((CASE WHEN t."id" IS NOT NULL THEN t."durationMinutes" ELSE s."durationMinutes" END) IS NULL AND (b."scheduledAt" >= date_trunc('day', ${start}::timestamp + interval '1 hour') - interval '1 hour'
              AND b."scheduledAt" < date_trunc('day', ${end}::timestamp + interval '1 hour') + interval '23 hours' ))
          )
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
