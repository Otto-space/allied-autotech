import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import type {
  ConditionReportInput,
  DocumentCreateInput,
  ListingCreateInput,
  PublicVehicleListQuery,
  StaffVehicleListQuery,
  VehicleCreateInput,
  VehicleUpdateInput,
} from "./vehicles.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const publicVehicleSelect = {
  id: true,
  stockNumber: true,
  make: true,
  model: true,
  trim: true,
  year: true,
  mileageKm: true,
  transmission: true,
  fuelType: true,
  condition: true,
  bodyType: true,
  engineSize: true,
  driveType: true,
  color: true,
  doors: true,
  seats: true,
  images: {
    select: { id: true, url: true, altText: true, sortOrder: true, isPrimary: true },
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
  conditionReports: {
    select: {
      id: true,
      odometerKm: true,
      conditionScore: true,
      summary: true,
      findings: true,
      inspectedAt: true,
    },
    orderBy: { inspectedAt: "desc" as const },
    take: 1,
  },
} satisfies Prisma.VehicleSelect;

export const publicListingSelect = {
  id: true,
  title: true,
  slug: true,
  priceKobo: true,
  currency: true,
  description: true,
  featured: true,
  publishedAt: true,
  createdAt: true,
  branch: { select: { id: true, code: true, name: true, city: true, state: true } },
  vehicle: { select: publicVehicleSelect },
} satisfies Prisma.VehicleListingSelect;

export const staffVehicleSelect = {
  ...publicVehicleSelect,
  branchId: true,
  vin: true,
  chassisNumber: true,
  registrationNumber: true,
  acquisitionCostKobo: true,
  acquisitionCurrency: true,
  acquiredAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, code: true, name: true, isActive: true } },
  listings: {
    select: {
      id: true,
      title: true,
      slug: true,
      priceKobo: true,
      currency: true,
      description: true,
      status: true,
      featured: true,
      publishedAt: true,
      reservedAt: true,
      soldAt: true,
      archivedAt: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  documents: {
    select: {
      id: true,
      type: true,
      verificationStatus: true,
      checksumSha256: true,
      mimeType: true,
      sizeBytes: true,
      issuedAt: true,
      expiresAt: true,
      verifiedAt: true,
      rejectionReason: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.VehicleSelect;

function publicWhere(query: PublicVehicleListQuery): Prisma.VehicleListingWhereInput {
  const vehicle: Prisma.VehicleWhereInput = {
    ...(query.make === undefined
      ? {}
      : { make: { equals: query.make, mode: "insensitive" } }),
    ...(query.model === undefined
      ? {}
      : { model: { equals: query.model, mode: "insensitive" } }),
    ...(query.year === undefined ? {} : { year: query.year }),
    ...(query.bodyType === undefined ? {} : { bodyType: query.bodyType }),
    ...(query.transmission === undefined ? {} : { transmission: query.transmission }),
    ...(query.fuelType === undefined ? {} : { fuelType: query.fuelType }),
  };
  return {
    status: "AVAILABLE",
    branch: { isActive: true },
    ...(Object.keys(vehicle).length === 0 ? {} : { vehicle }),
    ...(query.featured === undefined ? {} : { featured: query.featured }),
    ...(query.minPriceKobo === undefined && query.maxPriceKobo === undefined
      ? {}
      : {
          priceKobo: {
            ...(query.minPriceKobo === undefined
              ? {}
              : { gte: BigInt(query.minPriceKobo) }),
            ...(query.maxPriceKobo === undefined
              ? {}
              : { lte: BigInt(query.maxPriceKobo) }),
          },
        }),
    ...(query.search === undefined
      ? {}
      : {
          OR: [
            { title: { contains: query.search, mode: "insensitive" } },
            { vehicle: { make: { contains: query.search, mode: "insensitive" } } },
            { vehicle: { model: { contains: query.search, mode: "insensitive" } } },
          ],
        }),
  };
}
function publicOrder(
  sort: PublicVehicleListQuery["sort"],
): Prisma.VehicleListingOrderByWithRelationInput[] {
  if (sort === "price_asc") return [{ priceKobo: "asc" }, { id: "asc" }];
  if (sort === "price_desc") return [{ priceKobo: "desc" }, { id: "desc" }];
  if (sort === "year_desc") return [{ vehicle: { year: "desc" } }, { id: "desc" }];
  return [{ createdAt: "desc" }, { id: "desc" }];
}

export class VehiclesRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  listPublic(query: PublicVehicleListQuery) {
    return this.database.vehicleListing.findMany({
      where: publicWhere(query),
      select: publicListingSelect,
      orderBy: publicOrder(query.sort),
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  publicListing(id: string) {
    return this.database.vehicleListing.findFirst({
      where: { id, status: "AVAILABLE", branch: { isActive: true } },
      select: publicListingSelect,
    });
  }
  publicImage(id: string) {
    return this.database.vehicleImage.findFirst({
      where: {
        id,
        vehicle: {
          listings: { some: { status: "AVAILABLE", branch: { isActive: true } } },
        },
      },
      select: { publicId: true },
    });
  }
  listStaff(query: StaffVehicleListQuery, branchId: string | null) {
    return this.database.vehicle.findMany({
      where: {
        ...(branchId === null
          ? query.branchId === undefined
            ? {}
            : { branchId: query.branchId }
          : { branchId }),
        ...(query.make === undefined
          ? {}
          : { make: { equals: query.make, mode: "insensitive" } }),
        ...(query.model === undefined
          ? {}
          : { model: { equals: query.model, mode: "insensitive" } }),
        ...(query.year === undefined ? {} : { year: query.year }),
        ...(query.status === undefined
          ? {}
          : { listings: { some: { status: query.status } } }),
        ...(query.search === undefined
          ? {}
          : {
              OR: [
                { stockNumber: { contains: query.search, mode: "insensitive" } },
                { make: { contains: query.search, mode: "insensitive" } },
                { model: { contains: query.search, mode: "insensitive" } },
                { vin: { contains: query.search, mode: "insensitive" } },
              ],
            }),
      },
      select: staffVehicleSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
  vehicle(id: string, client: DatabaseClient = this.database) {
    return client.vehicle.findUnique({ where: { id }, select: staffVehicleSelect });
  }
  activeBranch(id: string, client: DatabaseClient) {
    return client.branch.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
  }
  staff(userId: string, client: DatabaseClient = this.database) {
    return client.staffProfile.findUnique({
      where: { userId },
      select: { id: true, branchId: true, branch: { select: { isActive: true } } },
    });
  }
  customer(userId: string, client: DatabaseClient = this.database) {
    return client.customerProfile.findUnique({ where: { userId }, select: { id: true } });
  }
  createVehicle(input: VehicleCreateInput, client: DatabaseClient) {
    const data = Object.fromEntries(
      Object.entries({
        ...input,
        acquisitionCostKobo:
          input.acquisitionCostKobo == null ? null : BigInt(input.acquisitionCostKobo),
        acquisitionCurrency: "NGN",
        acquiredAt: input.acquiredAt == null ? null : new Date(input.acquiredAt),
      }).filter(([, value]) => value !== undefined),
    ) as unknown as Prisma.VehicleUncheckedCreateInput;
    return client.vehicle.create({
      data,
      select: staffVehicleSelect,
    });
  }
  async updateVehicle(id: string, input: VehicleUpdateInput, client: DatabaseClient) {
    const { expectedVersion, acquisitionCostKobo, acquiredAt, ...fields } = input;
    const data = Object.fromEntries(
      Object.entries({
        ...fields,
        ...(acquisitionCostKobo === undefined
          ? {}
          : {
              acquisitionCostKobo:
                acquisitionCostKobo === null ? null : BigInt(acquisitionCostKobo),
            }),
        ...(acquiredAt === undefined
          ? {}
          : { acquiredAt: acquiredAt === null ? null : new Date(acquiredAt) }),
        version: { increment: 1 },
      }).filter(([, value]) => value !== undefined),
    ) as Prisma.VehicleUncheckedUpdateManyInput;
    const result = await client.vehicle.updateMany({
      where: { id, version: expectedVersion },
      data,
    });
    return result.count === 1 ? this.vehicle(id, client) : null;
  }
  createListing(
    vehicle: { id: string; branchId: string },
    input: ListingCreateInput,
    client: DatabaseClient,
  ) {
    return client.vehicleListing.create({
      data: {
        vehicleId: vehicle.id,
        branchId: vehicle.branchId,
        title: input.title,
        slug: input.slug,
        priceKobo: BigInt(input.priceKobo),
        currency: "NGN",
        description: input.description ?? null,
        featured: input.featured,
      },
      select: { id: true },
    });
  }
  listing(id: string, client: DatabaseClient = this.database) {
    return client.vehicleListing.findUnique({
      where: { id },
      select: {
        id: true,
        vehicleId: true,
        branchId: true,
        title: true,
        slug: true,
        priceKobo: true,
        currency: true,
        description: true,
        status: true,
        featured: true,
        publishedAt: true,
        reservedAt: true,
        soldAt: true,
        archivedAt: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async lockListing(id: string, client: Prisma.TransactionClient) {
    await client.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return this.listing(id, client);
  }
  async updateListing(
    id: string,
    expectedVersion: number,
    data: Prisma.VehicleListingUncheckedUpdateManyInput,
    client: DatabaseClient,
  ) {
    const result = await client.vehicleListing.updateMany({
      where: { id, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count === 1 ? this.listing(id, client) : null;
  }
  addPriceHistory(
    listingId: string,
    staffId: string,
    oldPriceKobo: bigint,
    newPriceKobo: bigint,
    reason: string,
    client: DatabaseClient,
  ) {
    return client.vehiclePriceHistory.create({
      data: {
        vehicleListingId: listingId,
        changedByStaffId: staffId,
        oldPriceKobo,
        newPriceKobo,
        currency: "NGN",
        reason,
      },
      select: { id: true },
    });
  }
  async addImage(
    vehicleId: string,
    data: {
      id: string;
      url: string;
      objectKey: string;
      checksum: string;
      altText?: string | null;
      sortOrder: number;
      isPrimary: boolean;
    },
    client: DatabaseClient,
  ) {
    if (data.isPrimary)
      await client.vehicleImage.updateMany({
        where: { vehicleId, isPrimary: true },
        data: { isPrimary: false },
      });
    return client.vehicleImage.create({
      data: {
        id: data.id,
        vehicleId,
        url: data.url,
        publicId: data.objectKey,
        checksumSha256: data.checksum,
        altText: data.altText ?? null,
        sortOrder: data.sortOrder,
        isPrimary: data.isPrimary,
      },
      select: {
        id: true,
        url: true,
        altText: true,
        sortOrder: true,
        isPrimary: true,
        createdAt: true,
      },
    });
  }
  addDocument(
    vehicleId: string,
    data: DocumentCreateInput & {
      objectKey: string;
      checksum: string;
      mimeType: string;
      sizeBytes: number;
    },
    client: DatabaseClient,
  ) {
    return client.vehicleDocument.create({
      data: {
        vehicleId,
        type: data.type,
        objectKey: data.objectKey,
        checksumSha256: data.checksum,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        issuedAt: data.issuedAt == null ? null : new Date(data.issuedAt),
        expiresAt: data.expiresAt == null ? null : new Date(data.expiresAt),
      },
      select: {
        id: true,
        type: true,
        verificationStatus: true,
        checksumSha256: true,
        mimeType: true,
        sizeBytes: true,
        version: true,
        createdAt: true,
      },
    });
  }
  document(vehicleId: string, id: string, client: DatabaseClient = this.database) {
    return client.vehicleDocument.findFirst({
      where: { id, vehicleId },
      select: {
        id: true,
        vehicleId: true,
        objectKey: true,
        type: true,
        verificationStatus: true,
        checksumSha256: true,
        mimeType: true,
        sizeBytes: true,
        version: true,
      },
    });
  }
  addConditionReport(
    vehicleId: string,
    input: ConditionReportInput,
    asset: null | { objectKey: string; checksum: string },
    client: DatabaseClient,
  ) {
    return client.vehicleConditionReport.create({
      data: {
        vehicleId,
        inspectionId: input.inspectionId ?? null,
        odometerKm: input.odometerKm ?? null,
        conditionScore: input.conditionScore ?? null,
        summary: input.summary,
        ...(input.findings === undefined ? {} : { findings: input.findings }),
        inspectedAt: new Date(input.inspectedAt),
        reportObjectKey: asset?.objectKey ?? null,
        reportSha256: asset?.checksum ?? null,
      },
      select: {
        id: true,
        inspectionId: true,
        odometerKm: true,
        conditionScore: true,
        summary: true,
        findings: true,
        inspectedAt: true,
        createdAt: true,
      },
    });
  }
  listSaved(customerId: string) {
    return this.database.savedVehicle.findMany({
      where: {
        customerId,
        vehicleListing: { status: "AVAILABLE", branch: { isActive: true } },
      },
      select: {
        id: true,
        createdAt: true,
        vehicleListing: { select: publicListingSelect },
      },
      orderBy: { id: "asc" },
    });
  }
  save(customerId: string, listingId: string, client: DatabaseClient) {
    return client.savedVehicle.upsert({
      where: { customerId_vehicleListingId: { customerId, vehicleListingId: listingId } },
      create: { customerId, vehicleListingId: listingId },
      update: {},
      select: { id: true, createdAt: true },
    });
  }
  unsave(customerId: string, listingId: string, client: DatabaseClient) {
    return client.savedVehicle.deleteMany({
      where: { customerId, vehicleListingId: listingId },
    });
  }
}
