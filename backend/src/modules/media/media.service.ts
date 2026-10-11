import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type {
  Prisma,
  PrismaClient,
  MediaUpload,
  StoredMedia,
} from "../../generated/prisma/client.js";
import type { MediaStoragePort } from "../../providers/storage/media-storage.port.js";
import { mediaStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { mediaError } from "./media.errors.js";
import {
  mediaLimits,
  mediaResultSchema,
  type MediaConfirmInput,
  type MediaPurpose,
  type MediaResult,
  type MediaUploadInput,
} from "./media.schemas.js";
import { validateAndTransformImage } from "./media-validation.js";
import { mediaTransaction } from "./media-transaction.js";

export interface MediaBinding {
  actorUserId: string;
  ownerUserId: string;
  resourceType: MediaPurpose;
  resourceId: string;
  branchId: string | null;
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const purpose = (type: MediaPurpose) =>
  type === "PROFILE" ? "PROFILE_PHOTO" : `${type}_IMAGE`;
export async function enqueueMediaCleanup(
  tx: Prisma.TransactionClient,
  objectKey: string,
  availableAt = new Date(),
) {
  await tx.mediaCleanupJob.upsert({
    where: { objectKey },
    create: { objectKey, availableAt },
    update: { availableAt, completedAt: null, lockedAt: null, lastErrorCode: null },
  });
}
export class MediaService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly storage: MediaStoragePort = mediaStorage,
  ) {}
  async prepare(binding: MediaBinding, input: MediaUploadInput) {
    if (input.sizeBytes > mediaLimits[binding.resourceType].maxBytes)
      throw mediaError("MEDIA_TOO_LARGE");
    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + env.ASSET_UPLOAD_TTL_SECONDS * 1000);
    const objectKey = `media/pending/${id}`;
    const verifiedObjectKey = `media/verified/${id}`;
    await this.db.$transaction(async (tx) => {
      await tx.mediaUpload.create({
        data: {
          id,
          tokenHash: hash(token),
          ...binding,
          purpose: purpose(binding.resourceType),
          ...input,
          expiresAt,
          objectKey,
          verifiedObjectKey,
        },
      });
      // Retain pending keys until the signed PUT has expired; late PUTs cannot recreate deleted orphans.
      const due = new Date(expiresAt.getTime() + 60 * 60_000);
      await enqueueMediaCleanup(tx, objectKey, due);
      await enqueueMediaCleanup(tx, verifiedObjectKey, due);
    });
    try {
      const upload = await this.storage.createUpload({ key: objectKey, ...input });
      return { assetToken: token, upload, limits: mediaLimits[binding.resourceType] };
    } catch {
      throw mediaError("MEDIA_STORAGE_UNAVAILABLE", 503);
    }
  }
  private check(ticket: MediaUpload | null, binding: MediaBinding) {
    if (!ticket) throw mediaError("MEDIA_TICKET_INVALID");
    if (
      ticket.actorUserId !== binding.actorUserId ||
      ticket.ownerUserId !== binding.ownerUserId
    )
      throw mediaError("MEDIA_WRONG_OWNER", 403);
    if (
      ticket.purpose !== purpose(binding.resourceType) ||
      ticket.resourceType !== binding.resourceType
    )
      throw mediaError("MEDIA_WRONG_PURPOSE");
    if (ticket.resourceId !== binding.resourceId || ticket.branchId !== binding.branchId)
      throw mediaError("MEDIA_WRONG_RESOURCE");
    if (ticket.rejectedAt) throw mediaError("MEDIA_TICKET_INVALID");
    return ticket;
  }
  private replay(ticket: MediaUpload, requestHash: string) {
    if (!ticket.confirmedAt) {
      if (ticket.expiresAt <= new Date()) throw mediaError("MEDIA_TICKET_EXPIRED");
      return null;
    }
    if (
      ticket.requestHash !== requestHash ||
      ticket.confirmedAt.getTime() + 24 * 60 * 60_000 < Date.now()
    )
      throw mediaError("MEDIA_TICKET_CONSUMED", 409);
    return mediaResultSchema.parse(ticket.result);
  }
  async confirm(
    binding: MediaBinding,
    input: Omit<MediaConfirmInput, "expectedVersion"> & {
      expectedVersion?: number | undefined;
    },
    attach: (tx: Prisma.TransactionClient, asset: StoredMedia) => Promise<MediaResult>,
  ) {
    const tokenHash = hash(input.assetToken);
    const requestHash = hash(JSON.stringify(input));
    const ticket = this.check(
      await this.db.mediaUpload.findUnique({ where: { tokenHash } }),
      binding,
    );
    const prior = this.replay(ticket, requestHash);
    if (prior) return prior;
    const bytes = await this.storage.read(
      ticket.objectKey,
      mediaLimits[binding.resourceType].maxBytes,
    );
    let verified: Awaited<ReturnType<typeof validateAndTransformImage>>;
    try {
      verified = await validateAndTransformImage(
        bytes,
        {
          mimeType: ticket.mimeType as MediaUploadInput["mimeType"],
          sizeBytes: ticket.sizeBytes,
          checksumSha256: ticket.checksumSha256,
        },
        binding.resourceType,
      );
    } catch (error) {
      await this.db.mediaUpload.updateMany({
        where: { id: ticket.id, confirmedAt: null },
        data: { rejectedAt: new Date() },
      });
      throw error;
    }
    return mediaTransaction(this.db, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "MediaUpload" WHERE "id" = ${ticket.id}::uuid FOR UPDATE`;
      const current = this.check(
        await tx.mediaUpload.findUnique({ where: { id: ticket.id } }),
        binding,
      );
      const replay = this.replay(current, requestHash);
      if (replay) return replay;
      // Only the unconsumed ticket holder may write this key. A delayed retry
      // must not recreate bytes after the confirmed image has been removed.
      await this.storage.write(
        current.verifiedObjectKey,
        verified.bytes,
        verified.mimeType,
      );
      // Storage latency does not extend the ticket's authorization window.
      this.replay(current, requestHash);
      const asset = await tx.storedMedia.create({
        data: {
          id: ticket.id,
          uploadId: ticket.id,
          objectKey: ticket.verifiedObjectKey,
          width: verified.width,
          height: verified.height,
          mimeType: verified.mimeType,
          checksumSha256: verified.checksumSha256,
          sizeBytes: verified.sizeBytes,
        },
      });
      const result = await attach(tx, asset);
      await tx.mediaUpload.update({
        where: { id: ticket.id },
        data: {
          confirmedAt: new Date(),
          requestHash,
          result: { ...result, images: result.images.map((image) => ({ ...image })) },
        },
      });
      return result;
    });
  }
  read(asset: Pick<StoredMedia, "objectKey" | "sizeBytes">) {
    return this.storage.read(asset.objectKey, asset.sizeBytes);
  }
}
