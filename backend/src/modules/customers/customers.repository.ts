import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { projectResourceImage, resourceImageSelect } from "../media/media.projection.js";
import { enqueueMediaCleanup } from "../media/media.service.js";
import type {
  CustomerProfileUpdateInput,
  CustomerVehicleCreateInput,
  CustomerVehicleUpdateInput,
} from "./customers.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const vehicleSelect = {
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

  updateProfile(
    userId: string,
    input: CustomerProfileUpdateInput,
    client: DatabaseClient,
  ) {
    const data: Prisma.CustomerProfileUpdateInput = {
      ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
      ...(input.lastName === undefined ? {} : { lastName: input.lastName }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.address === undefined ? {} : { address: input.address }),
      ...(input.city === undefined ? {} : { city: input.city }),
      ...(input.state === undefined ? {} : { state: input.state }),
      ...(input.country === undefined ? {} : { country: input.country }),
    };
    return client.customerProfile
      .update({
        where: { userId },
        data,
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
          mediaImages: { select: resourceImageSelect, take: 1 },
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true } },
        },
      })
      .then((row) => {
        const { mediaImages, ...profile } = row;
        return {
          ...profile,
          photo: mediaImages[0] ? projectResourceImage(mediaImages[0]) : null,
        };
      });
  }

  async listVehicles(userId: string, cursor: string | undefined, limit: number) {
    const profile = await this.database.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (profile === null) return null;

    return this.database.customerVehicle.findMany({
      where: { customerId: profile.id },
      select: vehicleSelect,
      orderBy: { id: "asc" },
      take: limit + 1,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });
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
          ...vehicle,
          images: mediaImages.map((image) => projectResourceImage(image)),
        };
      });
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
    return client.customerVehicle.create({
      data,
      select: vehicleSelect,
    });
  }

  async updateVehicle(
    userId: string,
    vehicleId: string,
    input: CustomerVehicleUpdateInput,
    client: DatabaseClient,
  ) {
    const owned = await this.vehicle(userId, vehicleId, client);
    if (owned === null) return null;
    const data: Prisma.CustomerVehicleUpdateInput = {
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
    return client.customerVehicle.update({
      where: { id: vehicleId },
      data,
      select: vehicleSelect,
    });
  }

  async deleteVehicle(userId: string, vehicleId: string, client: DatabaseClient) {
    await client.$queryRaw`SELECT "id" FROM "CustomerVehicle" WHERE "id" = ${vehicleId}::uuid FOR UPDATE`;
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
