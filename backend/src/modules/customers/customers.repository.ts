import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { projectResourceImage, resourceImageSelect } from "../media/media.projection.js";
import { enqueueMediaCleanup } from "../media/media.service.js";
import { savedVehicleQualifierKeys } from "./customers.schemas.js";
import { staleCustomerVehicle, staleCustomerProfile } from "./customers.errors.js";
import type {
  CustomerProfileUpdateInput,
  CustomerVehicleCreateInput,
  CustomerVehicleUpdateInput,
} from "./customers.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export const vehicleSelect = {
  nickname: true,
  defaultSlot: true,
  vehicleModelId: true,
  vehicleModel: {
    select: {
      id: true,
      makeId: true,
      name: true,
      yearFrom: true,
      yearTo: true,
      isActive: true,
      make: { select: { id: true, name: true, isActive: true } },
    },
  },
  trim: true,
  engineCode: true,
  market: true,
  brakeSystem: true,
  brakeDiameterMm: true,
  bodyType: true,
  transmission: true,
  generation: true,
  chassisCode: true,
  id: true,
  make: true,
  model: true,
  year: true,
  registrationNumber: true,
  vin: true,
  color: true,
  mileageKm: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerVehicleSelect;

const projectSavedVehicle = <T extends { defaultSlot: number | null }>(row: T) => {
  const { defaultSlot, ...safe } = row;
  return { ...safe, isDefault: defaultSlot === 1 };
};

export class CustomersRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  profile(userId: string, client: DatabaseClient = this.database) {
    return client.customerProfile
      .findUnique({
        where: { userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          phoneVerifiedAt: true,
          address: true,
          city: true,
          state: true,
          country: true,
          avatarUrl: true,
          mediaVersion: true,
          profileVersion: true,
          mediaImages: { select: resourceImageSelect, take: 1 },
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true } },
        },
      })
      .then((row) => {
        if (!row) return null;
        const { mediaImages, ...profile } = row;
        return {
          ...profile,
          photo: mediaImages[0] ? projectResourceImage(mediaImages[0]) : null,
        };
      });
  }

  async updateProfile(
    userId: string,
    input: CustomerProfileUpdateInput,
    client: DatabaseClient,
  ) {
    // Prisma omits undefined filters; a caller outside the HTTP validator must
    // never turn the compare-and-update into an unversioned write.
    if (
      !Number.isInteger(input.expectedVersion) ||
      input.expectedVersion < 0 ||
      input.expectedVersion > 2_147_483_646
    )
      throw staleCustomerProfile();
    const data: Prisma.CustomerProfileUpdateManyMutationInput = {
      profileVersion: { increment: 1 },
      ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
      ...(input.lastName === undefined ? {} : { lastName: input.lastName }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.address === undefined ? {} : { address: input.address }),
      ...(input.city === undefined ? {} : { city: input.city }),
      ...(input.state === undefined ? {} : { state: input.state }),
      ...(input.country === undefined ? {} : { country: input.country }),
    };
    const result = await client.customerProfile.updateMany({
      where: { userId, profileVersion: input.expectedVersion },
      data,
    });
    if (result.count !== 1) throw staleCustomerProfile();
    return this.profile(userId, client);
  }

  async listVehicles(
    userId: string,
    cursor: string | undefined,
    limit: number,
    defaultOnly = false,
  ) {
    const profile = await this.database.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (profile === null) return null;

    return this.database.customerVehicle
      .findMany({
        where: { customerId: profile.id, ...(defaultOnly ? { defaultSlot: 1 } : {}) },
        select: vehicleSelect,
        orderBy: { id: "asc" },
        take: limit + 1,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      })
      .then((rows) => rows.map(projectSavedVehicle));
  }

  vehicle(userId: string, vehicleId: string, client: DatabaseClient = this.database) {
    return client.customerVehicle
      .findFirst({
        where: { id: vehicleId, customer: { userId } },
        select: {
          ...vehicleSelect,
          mediaVersion: true,
          mediaImages: {
            select: resourceImageSelect,
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            take: 12,
          },
        },
      })
      .then((row) => {
        if (!row) return null;
        const { mediaImages, ...vehicle } = row;
        return {
          ...projectSavedVehicle(vehicle),
          images: mediaImages.map((image) => projectResourceImage(image)),
        };
      });
  }

  async lockGarage(userId: string, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "CustomerProfile" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
    return rows[0]?.id ?? null;
  }

  async clearOtherDefaults(
    customerId: string,
    vehicleId: string | null,
    tx: Prisma.TransactionClient,
  ) {
    return tx.$queryRaw<{ id: string }[]>`
      UPDATE "CustomerVehicle"
      SET "defaultSlot" = NULL,
          "updatedAt" = GREATEST(CURRENT_TIMESTAMP(3), "updatedAt" + interval '1 millisecond')
      WHERE "customerId" = ${customerId}::uuid AND "defaultSlot" = 1
        AND (${vehicleId}::uuid IS NULL OR "id" <> ${vehicleId}::uuid)
      RETURNING "id"`;
  }

  async createVehicle(
    userId: string,
    input: CustomerVehicleCreateInput,
    client: DatabaseClient,
  ) {
    const profile = await client.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (profile === null) return null;

    const data: Prisma.CustomerVehicleUncheckedCreateInput = {
      customerId: profile.id,
      nickname: input.nickname ?? null,
      defaultSlot: input.isDefault ? 1 : null,
      vehicleModelId: input.vehicleModelId ?? null,
      ...Object.fromEntries(
        savedVehicleQualifierKeys.map((key) => [key, input[key] ?? null]),
      ),
      make: input.make,
      model: input.model,
      year: input.year,
      ...(input.registrationNumber === undefined
        ? {}
        : { registrationNumber: input.registrationNumber }),
      ...(input.vin === undefined ? {} : { vin: input.vin }),
      ...(input.color === undefined ? {} : { color: input.color }),
      ...(input.mileageKm === undefined ? {} : { mileageKm: input.mileageKm }),
    };
    return client.customerVehicle
      .create({
        data,
        select: vehicleSelect,
      })
      .then(projectSavedVehicle);
  }

  async updateVehicle(
    userId: string,
    vehicleId: string,
    input: CustomerVehicleUpdateInput,
    client: DatabaseClient,
  ) {
    await client.$queryRaw`
      SELECT v."id" FROM "CustomerVehicle" v
      JOIN "CustomerProfile" c ON c."id" = v."customerId"
      WHERE v."id" = ${vehicleId}::uuid AND c."userId" = ${userId}::uuid
      FOR UPDATE OF v`;
    const owned = await this.vehicle(userId, vehicleId, client);
    if (owned === null) return null;
    if (
      input.expectedUpdatedAt !== undefined &&
      new Date(input.expectedUpdatedAt).getTime() !== owned.updatedAt.getTime()
    )
      throw staleCustomerVehicle();
    const data: Prisma.CustomerVehicleUncheckedUpdateInput = {
      updatedAt: new Date(Math.max(Date.now(), owned.updatedAt.getTime() + 1)),
      ...(input.nickname === undefined ? {} : { nickname: input.nickname }),
      ...(input.vehicleModelId === undefined
        ? {}
        : { vehicleModelId: input.vehicleModelId }),
      ...(input.isDefault === undefined
        ? {}
        : { defaultSlot: input.isDefault ? 1 : null }),
      ...Object.fromEntries(
        savedVehicleQualifierKeys
          .filter((key) => input[key] !== undefined)
          .map((key) => [key, input[key]]),
      ),
      ...(input.make === undefined ? {} : { make: input.make }),
      ...(input.model === undefined ? {} : { model: input.model }),
      ...(input.year === undefined ? {} : { year: input.year }),
      ...(input.registrationNumber === undefined
        ? {}
        : { registrationNumber: input.registrationNumber }),
      ...(input.vin === undefined ? {} : { vin: input.vin }),
      ...(input.color === undefined ? {} : { color: input.color }),
      ...(input.mileageKm === undefined ? {} : { mileageKm: input.mileageKm }),
    };
    return client.customerVehicle
      .update({
        where: { id: vehicleId },
        data,
        select: vehicleSelect,
      })
      .then(projectSavedVehicle);
  }

  async deleteVehicle(userId: string, vehicleId: string, client: DatabaseClient) {
    await client.$queryRaw`
      SELECT v."id" FROM "CustomerVehicle" v
      JOIN "CustomerProfile" c ON c."id" = v."customerId"
      WHERE v."id" = ${vehicleId}::uuid AND c."userId" = ${userId}::uuid
      FOR UPDATE OF v`;
    const owned = await this.vehicle(userId, vehicleId, client);
    if (owned === null) return null;
    const images = await client.resourceImage.findMany({
      where: { customerVehicleId: vehicleId },
      select: { asset: { select: { objectKey: true } } },
    });
    await client.customerVehicle.delete({ where: { id: vehicleId } });
    for (const image of images) await enqueueMediaCleanup(client, image.asset.objectKey);
    return owned;
  }
}
