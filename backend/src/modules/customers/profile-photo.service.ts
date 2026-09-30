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
import { assertCustomerActor } from "./customers.policy.js";
import { customerResourceNotFound } from "./customers.errors.js";

export class ProfilePhotoService {
  private readonly media: MediaService;
  constructor(
    private readonly db: PrismaClient = prisma,
    storage: MediaStoragePort = mediaStorage,
  ) {
    this.media = new MediaService(db, storage);
  }
  private async owner(actor: AuthenticatedActor, tx: Prisma.TransactionClient = this.db) {
    assertCustomerActor(actor);
    const profile = await tx.customerProfile.findUnique({
      where: { userId: actor.userId },
      select: { id: true, mediaVersion: true },
    });
    if (!profile) throw customerResourceNotFound();
    return profile;
  }
  private binding(actor: AuthenticatedActor, profileId: string): MediaBinding {
    return {
      actorUserId: actor.userId,
      ownerUserId: actor.userId,
      resourceType: "PROFILE",
      resourceId: profileId,
      branchId: null,
    };
  }
  async prepare(
    actor: AuthenticatedActor,
    input: MediaUploadInput,
    context: RequestSecurityContext,
  ) {
    const profile = await this.owner(actor);
    const result = await this.media.prepare(this.binding(actor, profile.id), input);
    await this.db.$transaction((tx) =>
      this.audit(tx, actor, profile.id, "PREPARE_PHOTO", context),
    );
    return result;
  }
  async confirm(
    actor: AuthenticatedActor,
    input: MediaConfirmInput,
    context: RequestSecurityContext,
  ) {
    const profile = await this.owner(actor);
    return this.media.confirm(
      this.binding(actor, profile.id),
      input,
      async (tx, asset) => {
        await tx.$queryRaw`SELECT "id" FROM "CustomerProfile" WHERE "id" = ${profile.id}::uuid FOR UPDATE`;
        const current = await this.owner(actor, tx);
        if (current.mediaVersion !== input.expectedVersion)
          throw mediaError("STALE_VERSION", 409);
        const previous = await tx.resourceImage.findMany({
          where: { profileId: profile.id },
          select: { id: true, asset: { select: { objectKey: true } } },
        });
        await tx.resourceImage.deleteMany({ where: { profileId: profile.id } });
        for (const image of previous)
          await enqueueMediaCleanup(tx, image.asset.objectKey);
        const image = await tx.resourceImage.create({
          data: {
            assetId: asset.id,
            profileId: profile.id,
            altText: input.altText ?? null,
            isPrimary: true,
          },
          select: resourceImageSelect,
        });
        const updated = await tx.customerProfile.update({
          where: { id: profile.id },
          data: { mediaVersion: { increment: 1 } },
          select: { mediaVersion: true },
        });
        await this.audit(tx, actor, profile.id, "REPLACE_PHOTO", context);
        return { version: updated.mediaVersion, images: [projectResourceImage(image)] };
      },
    );
  }
  async remove(
    actor: AuthenticatedActor,
    expectedVersion: number,
    context: RequestSecurityContext,
  ) {
    const profile = await this.owner(actor);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CustomerProfile" WHERE "id" = ${profile.id}::uuid FOR UPDATE`;
      const current = await this.owner(actor, tx);
      if (current.mediaVersion !== expectedVersion)
        throw mediaError("STALE_VERSION", 409);
      const previous = await tx.resourceImage.findMany({
        where: { profileId: profile.id },
        select: { asset: { select: { objectKey: true } } },
      });
      await tx.resourceImage.deleteMany({ where: { profileId: profile.id } });
      for (const image of previous) await enqueueMediaCleanup(tx, image.asset.objectKey);
      const updated = await tx.customerProfile.update({
        where: { id: profile.id },
        data: { mediaVersion: { increment: 1 } },
        select: { mediaVersion: true },
      });
      await this.audit(tx, actor, profile.id, "REMOVE_PHOTO", context);
      return { version: updated.mediaVersion, images: [] };
    });
  }
  async read(actor: AuthenticatedActor, imageId: string) {
    assertCustomerActor(actor);
    const image = await this.db.resourceImage.findFirst({
      where: { id: imageId, profile: { userId: actor.userId } },
      select: { asset: { select: { objectKey: true, sizeBytes: true, mimeType: true } } },
    });
    if (!image) throw customerResourceNotFound();
    return { bytes: await this.media.read(image.asset), mimeType: image.asset.mimeType };
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
      entityType: "CUSTOMER_PROFILE",
      entityId: id,
      newValues: { operation, result: "SUCCESS" },
      context,
    });
  }
}
