import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { readVehicleAssetTicket } from "../../common/security/asset-tickets.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { MediaStoragePort } from "../../providers/storage/media-storage.port.js";
import { mediaStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  MediaService,
  enqueueMediaCleanup,
  type MediaBinding,
} from "../media/media.service.js";
import {
  mediaLimits,
  mediaUploadSchema,
  type MediaUploadInput,
} from "../media/media.schemas.js";
import { mediaError } from "../media/media.errors.js";
import { validateAndTransformImage } from "../media/media-validation.js";
import { assertVehicleOperator } from "./vehicles.policy.js";
import {
  vehicleForbidden,
  vehicleNotFound,
  invalidAssetTicket,
} from "./vehicles.errors.js";
import type { ImageCreateInput } from "./vehicles.schemas.js";
import type { StockImageUpdate } from "./stock-media.schemas.js";
import { projectStockImage, stockImageSelect } from "./stock-media.projection.js";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export class StockMediaService {
  private readonly media: MediaService;
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly storage: MediaStoragePort = mediaStorage,
  ) {
    this.media = new MediaService(db, storage);
  }
  private async resource(
    actor: AuthenticatedActor,
    id: string,
    tx: Prisma.TransactionClient = this.db,
  ) {
    assertVehicleOperator(actor);
    const vehicle = await tx.vehicle.findUnique({
      where: { id },
      select: { id: true, branchId: true, version: true },
    });
    if (!vehicle) throw vehicleNotFound();
    if (actor.role === "STAFF") {
      const staff = await tx.staffProfile.findUnique({
        where: { userId: actor.userId },
        select: { branchId: true, branch: { select: { isActive: true } } },
      });
      if (staff?.branchId !== vehicle.branchId || !staff.branch?.isActive)
        throw vehicleForbidden();
    }
    return vehicle;
  }
  private binding(
    actor: AuthenticatedActor,
    vehicle: { id: string; branchId: string },
  ): MediaBinding {
    return {
      actorUserId: actor.userId,
      ownerUserId: actor.userId,
      resourceType: "STOCK",
      resourceId: vehicle.id,
      branchId: vehicle.branchId,
    };
  }
  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }
  private async count(tx: Prisma.TransactionClient, id: string) {
    if (
      (await tx.vehicleImage.count({ where: { vehicleId: id } })) >=
      mediaLimits.STOCK.count
    )
      throw mediaError("MEDIA_COUNT_LIMIT", 409);
  }
  async prepare(
    actor: AuthenticatedActor,
    id: string,
    input: MediaUploadInput,
    context: RequestSecurityContext,
    replaceImageId?: string,
  ) {
    const vehicle = await this.resource(actor, id);
    if (replaceImageId) {
      if (
        !(await this.db.vehicleImage.findFirst({
          where: { id: replaceImageId, vehicleId: id },
          select: { id: true },
        }))
      )
        throw vehicleNotFound();
    } else await this.count(this.db, id);
    const result = await this.media.prepare(this.binding(actor, vehicle), input);
    await this.db.$transaction((tx) =>
      this.audit(tx, actor, id, "PREPARE_IMAGE", context),
    );
    return result;
  }
  // Accept still-valid encrypted tickets issued before this release, but apply full byte validation.
  private async adoptLegacy(token: string, binding: MediaBinding) {
    const tokenHash = hash(token);
    if (
      await this.db.mediaUpload.findUnique({ where: { tokenHash }, select: { id: true } })
    )
      return;
    let ticket: ReturnType<typeof readVehicleAssetTicket>;
    try {
      ticket = readVehicleAssetTicket(token);
    } catch {
      throw invalidAssetTicket();
    }
    if (
      ticket.actorUserId !== binding.actorUserId ||
      ticket.vehicleId !== binding.resourceId ||
      ticket.kind !== "IMAGE" ||
      ticket.expiresAt <= Date.now() ||
      !this.ownedLegacyKey(ticket.objectKey, binding.resourceId)
    )
      throw invalidAssetTicket();
    const input = mediaUploadSchema.safeParse({
      mimeType: ticket.mimeType,
      sizeBytes: ticket.sizeBytes,
      checksumSha256: ticket.checksumSha256,
    });
    if (!input.success) throw invalidAssetTicket();
    const id = randomUUID(),
      expiresAt = new Date(ticket.expiresAt);
    await this.db.$transaction(async (tx) => {
      if (await tx.mediaUpload.findUnique({ where: { tokenHash }, select: { id: true } }))
        return;
      if (
        await tx.mediaCleanupJob.findUnique({
          where: { objectKey: ticket.objectKey },
          select: { id: true },
        })
      )
        throw mediaError("MEDIA_TICKET_CONSUMED", 409);
      if (
        await tx.vehicleImage.findUnique({
          where: { publicId: ticket.objectKey },
          select: { id: true },
        })
      )
        throw mediaError("MEDIA_TICKET_CONSUMED", 409);
      const upload = await tx.mediaUpload.upsert({
        where: { tokenHash },
        update: {},
        create: {
          id,
          tokenHash,
          ...binding,
          purpose: "STOCK_IMAGE",
          ...input.data,
          objectKey: ticket.objectKey,
          verifiedObjectKey: `media/verified/${id}`,
          expiresAt,
          createdAt: new Date(
            Math.min(Date.now(), ticket.expiresAt - env.ASSET_UPLOAD_TTL_SECONDS * 1000),
          ),
        },
      });
      const due = new Date(ticket.expiresAt + 60 * 60_000);
      await enqueueMediaCleanup(tx, upload.objectKey, due);
      await enqueueMediaCleanup(tx, upload.verifiedObjectKey, due);
    });
  }
  async confirm(
    actor: AuthenticatedActor,
    id: string,
    input: ImageCreateInput,
    context: RequestSecurityContext,
  ) {
    const vehicle = await this.resource(actor, id);
    const binding = this.binding(actor, vehicle);
    if (input.assetToken.length !== 43) await this.adoptLegacy(input.assetToken, binding);
    const result = await this.media.confirm(binding, input, async (tx, asset) => {
      await this.lock(tx, id);
      const current = await this.resource(actor, id, tx);
      if (
        input.expectedVersion !== undefined &&
        current.version !== input.expectedVersion
      )
        throw mediaError("STALE_VERSION", 409);
      if (current.branchId !== binding.branchId) throw mediaError("MEDIA_WRONG_RESOURCE");
      const replaced = input.replaceImageId
        ? await tx.vehicleImage.findFirst({
            where: { id: input.replaceImageId, vehicleId: id },
            select: {
              id: true,
              isPrimary: true,
              publicId: true,
              mediaAsset: { select: { objectKey: true } },
            },
          })
        : null;
      if (input.replaceImageId && (!replaced || input.expectedVersion === undefined))
        throw vehicleNotFound();
      if (!replaced) await this.count(tx, id);
      const primary = input.isPrimary || replaced?.isPrimary === true;
      if (primary)
        await tx.vehicleImage.updateMany({
          where: { vehicleId: id, isPrimary: true },
          data: { isPrimary: false },
        });
      const imageId = randomUUID();
      const image = await tx.vehicleImage.create({
        data: {
          id: imageId,
          vehicleId: id,
          mediaAssetId: asset.id,
          url: `/api/v1/public/vehicles/images/${imageId}`,
          altText: input.altText ?? null,
          sortOrder: input.sortOrder,
          isPrimary: primary,
        },
        select: { id: true, url: true, altText: true, sortOrder: true, isPrimary: true },
      });
      if (replaced) {
        await tx.vehicleImage.delete({ where: { id: replaced.id } });
        const key =
          replaced.mediaAsset?.objectKey ??
          (replaced.publicId && this.ownedLegacyKey(replaced.publicId, id)
            ? replaced.publicId
            : null);
        if (key) await enqueueMediaCleanup(tx, key);
      }
      const updated = await tx.vehicle.update({
        where: { id },
        data: { version: { increment: 1 } },
        select: { version: true },
      });
      await this.audit(
        tx,
        actor,
        id,
        replaced ? "REPLACE_IMAGE" : "ATTACH_IMAGE",
        context,
        image.id,
      );
      return {
        version: updated.version,
        images: [{ ...image, width: asset.width, height: asset.height }],
      };
    });
    const ticket = await this.db.mediaUpload.findUniqueOrThrow({
      where: { tokenHash: hash(input.assetToken) },
      select: { confirmedAt: true },
    });
    return {
      ...result.images[0]!,
      source: "UPLOADED" as const,
      version: result.version,
      createdAt: ticket.confirmedAt,
    };
  }
  private async snapshot(tx: Prisma.TransactionClient, id: string, version: number) {
    const images = await tx.vehicleImage.findMany({
      where: { vehicleId: id },
      select: stockImageSelect,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return { version, images: images.map((image) => projectStockImage(image, id)) };
  }
  async update(
    actor: AuthenticatedActor,
    id: string,
    imageId: string,
    input: StockImageUpdate,
    context: RequestSecurityContext,
  ) {
    await this.resource(actor, id);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, id);
      const vehicle = await this.resource(actor, id, tx);
      if (vehicle.version !== input.expectedVersion)
        throw mediaError("STALE_VERSION", 409);
      if (
        !(await tx.vehicleImage.findFirst({
          where: { id: imageId, vehicleId: id },
          select: { id: true },
        }))
      )
        throw vehicleNotFound();
      if (input.isPrimary)
        await tx.vehicleImage.updateMany({
          where: { vehicleId: id, isPrimary: true },
          data: { isPrimary: false },
        });
      const data = {
        ...(input.altText === undefined ? {} : { altText: input.altText }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        ...(input.isPrimary === undefined ? {} : { isPrimary: input.isPrimary }),
      };
      await tx.vehicleImage.update({ where: { id: imageId }, data });
      const updated = await tx.vehicle.update({
        where: { id },
        data: { version: { increment: 1 } },
        select: { version: true },
      });
      await this.audit(tx, actor, id, "UPDATE_IMAGE", context, imageId);
      return this.snapshot(tx, id, updated.version);
    });
  }
  async remove(
    actor: AuthenticatedActor,
    id: string,
    imageId: string,
    expectedVersion: number,
    context: RequestSecurityContext,
  ) {
    await this.resource(actor, id);
    return this.db.$transaction(async (tx) => {
      await this.lock(tx, id);
      const vehicle = await this.resource(actor, id, tx);
      if (vehicle.version !== expectedVersion) throw mediaError("STALE_VERSION", 409);
      const image = await tx.vehicleImage.findFirst({
        where: { id: imageId, vehicleId: id },
        select: {
          isPrimary: true,
          publicId: true,
          mediaAsset: { select: { objectKey: true } },
        },
      });
      if (!image) throw vehicleNotFound();
      await tx.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "vehicleId" = ${id}::uuid ORDER BY "id" FOR UPDATE`;
      const count = await tx.vehicleImage.count({ where: { vehicleId: id } });
      if (
        count === 1 &&
        (await tx.vehicleListing.findFirst({
          where: { vehicleId: id, status: { in: ["AVAILABLE", "RESERVED"] } },
          select: { id: true },
        }))
      )
        throw mediaError("MEDIA_LAST_PUBLISHED_IMAGE", 409);
      await tx.vehicleImage.delete({ where: { id: imageId } });
      if (image.isPrimary) {
        const next = await tx.vehicleImage.findFirst({
          where: { vehicleId: id },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        if (next)
          await tx.vehicleImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
      }
      const key =
        image.mediaAsset?.objectKey ??
        (image.publicId && this.ownedLegacyKey(image.publicId, id)
          ? image.publicId
          : null);
      if (key) await enqueueMediaCleanup(tx, key);
      const updated = await tx.vehicle.update({
        where: { id },
        data: { version: { increment: 1 } },
        select: { version: true },
      });
      await this.audit(tx, actor, id, "REMOVE_IMAGE", context, imageId);
      return this.snapshot(tx, id, updated.version);
    });
  }
  async read(imageId: string, staff?: { actor: AuthenticatedActor; vehicleId: string }) {
    if (staff) await this.resource(staff.actor, staff.vehicleId);
    const image = await this.db.vehicleImage.findFirst({
      where: {
        id: imageId,
        ...(staff
          ? { vehicleId: staff.vehicleId }
          : {
              vehicle: {
                listings: { some: { status: "AVAILABLE", branch: { isActive: true } } },
              },
            }),
      },
      select: {
        publicId: true,
        checksumSha256: true,
        mediaAsset: { select: { objectKey: true, sizeBytes: true, mimeType: true } },
      },
    });
    if (!image) throw vehicleNotFound();
    if (image.mediaAsset)
      return {
        bytes: await this.media.read(image.mediaAsset),
        mimeType: image.mediaAsset.mimeType,
      };
    if (!image.publicId) throw vehicleNotFound();
    // Older attachments are decoded and sanitized on reads; never redirect to lasting credentials.
    const bytes = await this.storage.read(image.publicId, mediaLimits.STOCK.maxBytes);
    let format: string | undefined;
    try {
      format = (await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata()).format;
    } catch {
      throw mediaError("MEDIA_INVALID");
    }
    if (format !== "jpeg" && format !== "png" && format !== "webp")
      throw mediaError("MEDIA_INVALID");
    const verified = await validateAndTransformImage(
      bytes,
      {
        mimeType: `image/${format}`,
        sizeBytes: bytes.length,
        checksumSha256:
          image.checksumSha256 ?? createHash("sha256").update(bytes).digest("hex"),
      },
      "STOCK",
    );
    return { bytes: verified.bytes, mimeType: verified.mimeType };
  }
  private ownedLegacyKey(key: string, id: string) {
    return new RegExp(`^vehicles/${id}/image/[0-9a-f-]{36}$`).test(key);
  }
  private audit(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    id: string,
    operation: string,
    context: RequestSecurityContext,
    imageId?: string,
  ) {
    return appendAuditEvent(tx, {
      actorUserId: actor.userId,
      action: "UPDATE",
      entityType: "VEHICLE",
      entityId: id,
      newValues: { operation, result: "SUCCESS", ...(imageId ? { imageId } : {}) },
      context,
    });
  }
}
