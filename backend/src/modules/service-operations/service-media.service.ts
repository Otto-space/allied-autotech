import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { MediaStoragePort } from "../../providers/storage/media-storage.port.js";
import { mediaStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  MediaService,
  enqueueMediaCleanup,
  type MediaBinding,
} from "../media/media.service.js";
import { mediaError } from "../media/media.errors.js";
import { projectResourceImage, resourceImageSelect } from "../media/media.projection.js";
import type { MediaConfirmInput, MediaUploadInput } from "../media/media.schemas.js";
import { assertServiceAdministrator } from "./service-operations.policy.js";
import { serviceOperationNotFound } from "./service-operations.errors.js";

export function projectServiceImage(
  image: Prisma.ResourceImageGetPayload<{ select: typeof resourceImageSelect }>,
  serviceId: string,
  publicRead: boolean,
) {
  return {
    ...projectResourceImage(image, false),
    ...(!publicRead
      ? { url: `/api/v1/admin/services/${serviceId}/images/${image.id}/content` }
      : {}),
  };
}

export class ServiceMediaService {
  private readonly media: MediaService;
  constructor(
    private readonly db: PrismaClient = prisma,
    storage: MediaStoragePort = mediaStorage,
  ) {
    this.media = new MediaService(db, storage);
  }
  private async resource(
    actor: AuthenticatedActor,
    id: string,
    tx: Prisma.TransactionClient = this.db,
  ) {
    assertServiceAdministrator(actor);
    const service = await tx.service.findUnique({
      where: { id },
      select: { id: true, version: true },
    });
    if (!service) throw serviceOperationNotFound();
    return service;
  }
  private binding(actor: AuthenticatedActor, id: string): MediaBinding {
    return {
      actorUserId: actor.userId,
      ownerUserId: actor.userId,
      resourceType: "SERVICE",
      resourceId: id,
      branchId: null,
    };
  }
  async snapshot(
    actor: AuthenticatedActor,
    id: string,
    tx: Prisma.TransactionClient = this.db,
  ) {
    assertServiceAdministrator(actor);
    const service = await tx.service.findUnique({
      where: { id },
      select: { version: true, mediaImages: { select: resourceImageSelect, take: 1 } },
    });
    if (!service) throw serviceOperationNotFound();
    return {
      version: service.version,
      images: service.mediaImages.map((image) => projectServiceImage(image, id, false)),
    };
  }
  async prepare(
    actor: AuthenticatedActor,
    id: string,
    input: MediaUploadInput,
    context: RequestSecurityContext,
  ) {
    await this.resource(actor, id);
    const result = await this.media.prepare(this.binding(actor, id), input);
    await this.db.$transaction((tx) =>
      this.audit(tx, actor, id, "PREPARE_IMAGE", context),
    );
    return result;
  }
  private async lock(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    id: string,
    expectedVersion: number,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`service:${id}`}, 0))`;
    await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const current = await this.resource(actor, id, tx);
    if (current.version !== expectedVersion) throw mediaError("STALE_VERSION", 409);
  }
  async confirm(
    actor: AuthenticatedActor,
    id: string,
    input: MediaConfirmInput,
    context: RequestSecurityContext,
  ) {
    await this.resource(actor, id);
    return this.media.confirm(this.binding(actor, id), input, async (tx, asset) => {
      await this.lock(tx, actor, id, input.expectedVersion);
      const previous = await tx.resourceImage.findMany({
        where: { serviceId: id },
        select: { asset: { select: { objectKey: true } } },
      });
      await tx.resourceImage.deleteMany({ where: { serviceId: id } });
      for (const image of previous) await enqueueMediaCleanup(tx, image.asset.objectKey);
      await tx.resourceImage.create({
        data: {
          serviceId: id,
          assetId: asset.id,
          altText: input.altText ?? null,
          isPrimary: true,
        },
      });
      return this.finish(tx, actor, id, "REPLACE_IMAGE", context);
    });
  }
  async update(
    actor: AuthenticatedActor,
    id: string,
    imageId: string,
    input: { expectedVersion: number; altText: string | null },
    context: RequestSecurityContext,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, actor, id, input.expectedVersion);
      const updated = await tx.resourceImage.updateMany({
        where: { id: imageId, serviceId: id },
        data: { altText: input.altText },
      });
      if (updated.count !== 1) throw serviceOperationNotFound();
      return this.finish(tx, actor, id, "EDIT_IMAGE", context);
    });
  }
  async remove(
    actor: AuthenticatedActor,
    id: string,
    imageId: string,
    expectedVersion: number,
    context: RequestSecurityContext,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, actor, id, expectedVersion);
      const image = await tx.resourceImage.findFirst({
        where: { id: imageId, serviceId: id },
        select: { asset: { select: { objectKey: true } } },
      });
      if (!image) throw serviceOperationNotFound();
      await tx.resourceImage.delete({ where: { id: imageId } });
      await enqueueMediaCleanup(tx, image.asset.objectKey);
      return this.finish(tx, actor, id, "REMOVE_IMAGE", context);
    });
  }
  async read(imageId: string, admin?: { actor: AuthenticatedActor; serviceId: string }) {
    if (admin) await this.resource(admin.actor, admin.serviceId);
    const image = await this.db.resourceImage.findFirst({
      where: {
        id: imageId,
        ...(admin ? { serviceId: admin.serviceId } : { service: { isActive: true } }),
      },
      select: { asset: { select: { objectKey: true, sizeBytes: true, mimeType: true } } },
    });
    if (!image) throw serviceOperationNotFound();
    return { bytes: await this.media.read(image.asset), mimeType: image.asset.mimeType };
  }
  private async finish(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    id: string,
    operation: string,
    context: RequestSecurityContext,
  ) {
    await tx.service.update({ where: { id }, data: { version: { increment: 1 } } });
    await this.audit(tx, actor, id, operation, context);
    return this.snapshot(actor, id, tx);
  }
  private audit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    id: string,
    operation: string,
    context: RequestSecurityContext,
  ) {
    return appendAuditEvent(tx, {
      actorUserId: actor.userId,
      action: "UPDATE",
      entityType: "SERVICE",
      entityId: id,
      newValues: { operation, result: "SUCCESS" },
      context,
    });
  }
}
