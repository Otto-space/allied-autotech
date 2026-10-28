import { activeProductWhere } from "./catalog-visibility.js";
import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { MediaStoragePort } from "../../providers/storage/media-storage.port.js";
import { mediaStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { MediaService, type MediaBinding } from "../media/media.service.js";
import { mediaError } from "../media/media.errors.js";
import { mediaLimits, type MediaUploadInput } from "../media/media.schemas.js";
import { assertCatalogueAdministrator } from "./catalog.policy.js";
import { catalogResourceNotFound } from "./catalog.errors.js";
import type { ProductImageConfirm, ProductImageOrder } from "./product-media.schemas.js";

export class ProductMediaService {
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
    assertCatalogueAdministrator(actor);
    const product = await tx.product.findUnique({
      where: { id },
      select: { id: true, mediaVersion: true },
    });
    if (!product) throw catalogResourceNotFound();
    return product;
  }
  private binding(actor: AuthenticatedActor, id: string): MediaBinding {
    return {
      actorUserId: actor.userId,
      ownerUserId: actor.userId,
      resourceType: "PRODUCT",
      resourceId: id,
      branchId: null,
    };
  }
  async prepare(
    actor: AuthenticatedActor,
    id: string,
    input: MediaUploadInput,
    context: RequestSecurityContext,
  ) {
    await this.resource(actor, id);
    if (
      (await this.db.productImage.count({ where: { productId: id } })) >=
      mediaLimits.PRODUCT.count
    )
      throw mediaError("MEDIA_COUNT_LIMIT", 409);
    const prepared = await this.media.prepare(this.binding(actor, id), input);
    await this.db.$transaction((tx) =>
      this.audit(tx, actor, id, "PREPARE_IMAGE", context),
    );
    return prepared;
  }
  async reorder(
    actor: AuthenticatedActor,
    id: string,
    input: ProductImageOrder,
    context: RequestSecurityContext,
  ) {
    await this.resource(actor, id);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${id}`}, 0))`;
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const product = await this.resource(actor, id, tx);
      if (product.mediaVersion !== input.expectedVersion)
        throw mediaError("STALE_VERSION", 409);
      const images = await tx.productImage.findMany({
        where: { productId: id },
        select: { id: true },
      });
      if (
        images.length !== input.imageIds.length ||
        images.some((image) => !input.imageIds.includes(image.id))
      )
        throw mediaError("STALE_VERSION", 409);
      // Complete, product-bound permutation under the same lock as all image writes.
      for (const [sortOrder, imageId] of input.imageIds.entries())
        await tx.productImage.update({ where: { id: imageId }, data: { sortOrder } });
      const updated = await tx.product.update({
        where: { id },
        data: { mediaVersion: { increment: 1 } },
        select: { mediaVersion: true },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "PRODUCT",
        entityId: id,
        newValues: { action: "REORDER_IMAGES", imageIds: JSON.stringify(input.imageIds) },
        context,
      });
      return { version: updated.mediaVersion, imageIds: input.imageIds };
    });
  }
  async confirm(
    actor: AuthenticatedActor,
    id: string,
    input: ProductImageConfirm,
    context: RequestSecurityContext,
  ) {
    await this.resource(actor, id);
    return this.media.confirm(this.binding(actor, id), input, async (tx, asset) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${id}`}, 0))`;
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const product = await this.resource(actor, id, tx);
      if (product.mediaVersion !== input.expectedVersion)
        throw mediaError("STALE_VERSION", 409);
      if (
        (await tx.productImage.count({ where: { productId: id } })) >=
        mediaLimits.PRODUCT.count
      )
        throw mediaError("MEDIA_COUNT_LIMIT", 409);
      if (input.isPrimary)
        await tx.productImage.updateMany({
          where: { productId: id, isPrimary: true },
          data: { isPrimary: false },
        });
      const imageId = randomUUID();
      const image = await tx.productImage.create({
        data: {
          id: imageId,
          productId: id,
          mediaAssetId: asset.id,
          url: `/api/v1/public/catalog/products/images/${imageId}`,
          altText: input.altText ?? null,
          sortOrder: input.sortOrder,
          isPrimary: input.isPrimary,
        },
        select: { id: true, altText: true, sortOrder: true, isPrimary: true },
      });
      const updated = await tx.product.update({
        where: { id },
        data: { mediaVersion: { increment: 1 } },
        select: { mediaVersion: true },
      });
      await this.audit(tx, actor, id, "ATTACH_UPLOADED_IMAGE", context);
      return {
        version: updated.mediaVersion,
        images: [
          {
            ...image,
            width: asset.width,
            height: asset.height,
            url: `/api/v1/admin/catalog/products/${id}/images/${image.id}/content`,
          },
        ],
      };
    });
  }
  async read(imageId: string, admin?: { actor: AuthenticatedActor; productId: string }) {
    if (admin) await this.resource(admin.actor, admin.productId);
    const image = await this.db.productImage.findFirst({
      where: {
        id: imageId,
        mediaAssetId: { not: null },
        ...(admin ? { productId: admin.productId } : { product: activeProductWhere }),
      },
      select: {
        mediaAsset: { select: { objectKey: true, sizeBytes: true, mimeType: true } },
      },
    });
    if (!image?.mediaAsset) throw catalogResourceNotFound();
    return {
      bytes: await this.media.read(image.mediaAsset),
      mimeType: image.mediaAsset.mimeType,
    };
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
      entityType: "PRODUCT",
      entityId: id,
      newValues: { operation, result: "SUCCESS" },
      context,
    });
  }
}
