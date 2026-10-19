import { prisma } from "../config/database.js";
import { mediaStorage } from "../providers/storage/s3-object-storage.adapter.js";
import type { MediaStoragePort } from "../providers/storage/media-storage.port.js";
import { enqueueMediaCleanup } from "../modules/media/media.service.js";
import { mediaTransaction } from "../modules/media/media-transaction.js";

export class MediaCleanupWorker {
  constructor(
    private readonly db = prisma,
    private readonly storage: MediaStoragePort = mediaStorage,
  ) {}
  async runOnce(batchSize = 25) {
    const limit = Math.max(1, Math.min(batchSize, 100));
    // Also handles cascaded resource deletion and recovery after an application crash.
    // Pending jobs already own recovery, including delayed retries and leases.
    // Exclude them before LIMIT so a failing oldest page cannot starve new orphans.
    // Completed jobs remain eligible when a later resource deletion leaves an orphan.
    const orphans = await this.db.$queryRaw<{ objectKey: string }[]>`
      SELECT asset."objectKey" FROM "StoredMedia" AS asset
      WHERE asset."deletedAt" IS NULL
        AND asset."createdAt" < ${new Date(Date.now() - 60 * 60_000)}
        AND NOT EXISTS (SELECT 1 FROM "ResourceImage" AS image
          WHERE image."assetId" = asset."id")
        AND NOT EXISTS (SELECT 1 FROM "ProductImage" AS image
          WHERE image."mediaAssetId" = asset."id")
        AND NOT EXISTS (SELECT 1 FROM "VehicleImage" AS image
          WHERE image."mediaAssetId" = asset."id")
        AND NOT EXISTS (SELECT 1 FROM "MediaCleanupJob" AS job
          WHERE job."objectKey" = asset."objectKey" AND job."completedAt" IS NULL)
      ORDER BY asset."createdAt", asset."id"
      LIMIT ${limit}
    `;
    await this.db.$transaction(async (tx) => {
      for (const orphan of orphans) {
        const existing = await tx.mediaCleanupJob.findUnique({
          where: { objectKey: orphan.objectKey },
          select: { completedAt: true },
        });
        if (!existing || existing.completedAt)
          await enqueueMediaCleanup(tx, orphan.objectKey);
      }
    });
    const jobs = await this.db.mediaCleanupJob.findMany({
      where: {
        completedAt: null,
        availableAt: { lte: new Date() },
        OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 5 * 60_000) } }],
      },
      orderBy: [{ availableAt: "asc" }, { id: "asc" }],
      take: limit,
    });
    let deleted = 0;
    for (const job of jobs) {
      const lockedAt = new Date();
      const claim = await this.db.mediaCleanupJob.updateMany({
        where: {
          id: job.id,
          completedAt: null,
          lockedAt: job.lockedAt,
          attempts: job.attempts,
          availableAt: job.availableAt,
        },
        data: { lockedAt, attempts: { increment: 1 } },
      });
      if (!claim.count) continue;
      // Enqueueing clears the lease; a replacement worker increments attempts.
      // Fence both outcomes so a late storage response cannot erase newer work.
      const ownedClaim = {
        id: job.id,
        completedAt: null,
        lockedAt,
        attempts: job.attempts + 1,
      };
      try {
        const removed = await mediaTransaction(this.db, async (tx) => {
          // A confirmation may be between its verified write and attachment.
          // Check references only after it releases the same ticket lock.
          await tx.$queryRaw`SELECT "id" FROM "MediaUpload"
            WHERE "objectKey" = ${job.objectKey} OR "verifiedObjectKey" = ${job.objectKey}
            ORDER BY "id" FOR UPDATE`;
          if (
            !(await tx.mediaCleanupJob.findFirst({
              where: ownedClaim,
              select: { id: true },
            }))
          )
            return false;
          const asset = await tx.storedMedia.findFirst({
            where: {
              objectKey: job.objectKey,
              OR: [
                { images: { some: {} } },
                { productImages: { some: {} } },
                { vehicleImages: { some: {} } },
              ],
            },
            select: { id: true },
          });
          const product = await tx.productImage.findFirst({
            where: { publicId: job.objectKey },
            select: { id: true },
          });
          const stock = await tx.vehicleImage.findFirst({
            where: { publicId: job.objectKey },
            select: { id: true },
          });
          if (!asset && !product && !stock) {
            await this.storage.delete(job.objectKey);
            await tx.storedMedia.updateMany({
              where: { objectKey: job.objectKey },
              data: { deletedAt: new Date() },
            });
          }
          await tx.mediaCleanupJob.updateMany({
            where: ownedClaim,
            data: { completedAt: new Date(), lockedAt: null, lastErrorCode: null },
          });
          return !asset && !product && !stock;
        });
        if (removed) deleted++;
      } catch {
        await this.db.mediaCleanupJob.updateMany({
          where: ownedClaim,
          data: {
            lockedAt: null,
            availableAt: new Date(
              Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** Math.min(job.attempts, 6)),
            ),
            lastErrorCode: "MEDIA_CLEANUP_FAILED",
          },
        });
      }
    }
    return { processed: jobs.length, deleted };
  }
}
