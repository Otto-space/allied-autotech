import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { MediaStoragePort } from "../../providers/storage/media-storage.port.js";
import { mediaStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { MediaService, enqueueMediaCleanup } from "../media/media.service.js";
import { mediaError } from "../media/media.errors.js";
import { projectResourceImage, resourceImageSelect } from "../media/media.projection.js";
import { mediaLimits, type MediaUploadInput } from "../media/media.schemas.js";
import { assertCustomerActor } from "./customers.policy.js";
import { customerResourceNotFound } from "./customers.errors.js";
import type { GarageImageConfirm, GarageImageUpdate } from "./garage-media.schemas.js";

export class GarageMediaService {
  private readonly media: MediaService;
  constructor(
    private readonly db: PrismaClient = prisma,
    storage: MediaStoragePort = mediaStorage,
  ) {
    this.media = new MediaService(db, storage);
  }
  private async owner(
    actor: AuthenticatedActor,
    vehicleId: string,
    tx: Prisma.TransactionClient = this.db,
  ) {
    assertCustomerActor(actor);
    const vehicle = await tx.customerVehicle.findFirst({
      where: { id: vehicleId, customer: { userId: actor.userId } },
      select: { id: true, mediaVersion: true },
    });
    if (!vehicle) throw customerResourceNotFound();
    return vehicle;
  }
  private async lock(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    vehicleId: string,
    expectedVersion: number,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "CustomerVehicle" WHERE "id" = ${vehicleId}::uuid FOR UPDATE`;
    const current = await this.owner(actor, vehicleId, tx);
    if (current.mediaVersion !== expectedVersion) throw mediaError("STALE_VERSION", 409);
  }
  private binding(actor: AuthenticatedActor, vehicleId: string) {
    return {
      actorUserId: actor.userId,
      ownerUserId: actor.userId,
      resourceType: "GARAGE" as const,
      resourceId: vehicleId,
      branchId: null,
    };
  }
  async prepare(
    actor: AuthenticatedActor,
    vehicleId: string,
    input: MediaUploadInput,
    context: RequestSecurityContext,
  ) {
    await this.owner(actor, vehicleId);
    if (
      (await this.db.resourceImage.count({ where: { customerVehicleId: vehicleId } })) >=
      mediaLimits.GARAGE.count
    )
      throw mediaError("MEDIA_COUNT_LIMIT", 409);
    const result = await this.media.prepare(this.binding(actor, vehicleId), input);
    await this.db.$transaction((tx) =>
      this.audit(tx, actor, vehicleId, "PREPARE_GARAGE_IMAGE", context),
    );
    return result;
  }
  async confirm(
    actor: AuthenticatedActor,
    vehicleId: string,
    input: GarageImageConfirm,
    context: RequestSecurityContext,
  ) {
    await this.owner(actor, vehicleId);
    return this.media.confirm(
      this.binding(actor, vehicleId),
      input,
      async (tx, asset) => {
        await this.lock(tx, actor, vehicleId, input.expectedVersion);
        const count = await tx.resourceImage.count({
          where: { customerVehicleId: vehicleId },
        });
        if (count >= mediaLimits.GARAGE.count) throw mediaError("MEDIA_COUNT_LIMIT", 409);
        const primary = count === 0 || input.isPrimary;
        if (primary)
          await tx.resourceImage.updateMany({
            where: { customerVehicleId: vehicleId, isPrimary: true },
            data: { isPrimary: false },
          });
        await tx.resourceImage.create({
          data: {
            assetId: asset.id,
            customerVehicleId: vehicleId,
            altText: input.altText ?? null,
            sortOrder: input.sortOrder,
            isPrimary: primary,
          },
        });
        return this.finish(tx, actor, vehicleId, "ATTACH_GARAGE_IMAGE", context);
      },
    );
  }
  async update(
    actor: AuthenticatedActor,
    vehicleId: string,
    imageId: string,
    input: GarageImageUpdate,
    context: RequestSecurityContext,
  ) {
    await this.owner(actor, vehicleId);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, actor, vehicleId, input.expectedVersion);
      const image = await tx.resourceImage.findFirst({
        where: { id: imageId, customerVehicleId: vehicleId },
        select: { id: true },
      });
      if (!image) throw customerResourceNotFound();
      if (input.isPrimary)
        await tx.resourceImage.updateMany({
          where: { customerVehicleId: vehicleId, isPrimary: true },
          data: { isPrimary: false },
        });
      await tx.resourceImage.update({
        where: { id: imageId },
        data: {
          ...(input.altText === undefined ? {} : { altText: input.altText }),
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
          ...(input.isPrimary ? { isPrimary: true } : {}),
        },
      });
      return this.finish(tx, actor, vehicleId, "UPDATE_GARAGE_IMAGE", context);
    });
  }
  async remove(
    actor: AuthenticatedActor,
    vehicleId: string,
    imageId: string,
    expectedVersion: number,
    context: RequestSecurityContext,
  ) {
    await this.owner(actor, vehicleId);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, actor, vehicleId, expectedVersion);
      const image = await tx.resourceImage.findFirst({
        where: { id: imageId, customerVehicleId: vehicleId },
        select: { isPrimary: true, asset: { select: { objectKey: true } } },
      });
      if (!image) throw customerResourceNotFound();
      await tx.resourceImage.delete({ where: { id: imageId } });
      await enqueueMediaCleanup(tx, image.asset.objectKey);
      if (image.isPrimary) {
        const next = await tx.resourceImage.findFirst({
          where: { customerVehicleId: vehicleId },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        if (next)
          await tx.resourceImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
      }
      return this.finish(tx, actor, vehicleId, "REMOVE_GARAGE_IMAGE", context);
    });
  }
  private async finish(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    vehicleId: string,
    operation: string,
    context: RequestSecurityContext,
  ) {
    const updated = await tx.customerVehicle.update({
      where: { id: vehicleId },
      data: { mediaVersion: { increment: 1 } },
      select: { mediaVersion: true },
    });
    const images = await tx.resourceImage.findMany({
      where: { customerVehicleId: vehicleId },
      select: resourceImageSelect,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      take: mediaLimits.GARAGE.count,
    });
    await this.audit(tx, actor, vehicleId, operation, context);
    return {
      version: updated.mediaVersion,
      images: images.map((image) => projectResourceImage(image)),
    };
  }
  private audit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    vehicleId: string,
    operation: string,
    context: RequestSecurityContext,
  ) {
    return appendAuditEvent(tx, {
      actorUserId: actor.userId,
      action: "UPDATE",
      entityType: "CUSTOMER_VEHICLE",
      entityId: vehicleId,
      newValues: { operation, result: "SUCCESS" },
      context,
    });
  }
}
