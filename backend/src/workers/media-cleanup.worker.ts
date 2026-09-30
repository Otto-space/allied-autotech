import { prisma } from "../config/database.js";
import { mediaStorage } from "../providers/storage/s3-object-storage.adapter.js";
import type { MediaStoragePort } from "../providers/storage/media-storage.port.js";
import { enqueueMediaCleanup } from "../modules/media/media.service.js";

export class MediaCleanupWorker {
  constructor(
    private readonly db = prisma,
    private readonly storage: MediaStoragePort = mediaStorage,
  ) {}
  async runOnce(batchSize = 25) {
    const limit = Math.max(1, Math.min(batchSize, 100));
    // Also handles cascaded resource deletion and recovery after an application crash.
    const orphans = await this.db.storedMedia.findMany({
      where: {
        deletedAt: null,
        createdAt: { lt: new Date(Date.now() - 60 * 60_000) },
        images: { none: {} },
        productImages: { none: {} },
        vehicleImages: { none: {} },
      },
      select: { objectKey: true },
      take: limit,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
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
      const claim = await this.db.mediaCleanupJob.updateMany({
        where: { id: job.id, completedAt: null, lockedAt: job.lockedAt },
        data: { lockedAt: new Date(), attempts: { increment: 1 } },
      });
      if (!claim.count) continue;
      try {
        const [asset, product, stock] = await Promise.all([
          this.db.storedMedia.findFirst({
            where: {
              objectKey: job.objectKey,
              OR: [
                { images: { some: {} } },
                { productImages: { some: {} } },
                { vehicleImages: { some: {} } },
              ],
            },
            select: { id: true },
          }),
          this.db.productImage.findFirst({
            where: { publicId: job.objectKey },
            select: { id: true },
          }),
          this.db.vehicleImage.findFirst({
            where: { publicId: job.objectKey },
            select: { id: true },
          }),
        ]);
        if (!asset && !product && !stock) {
          await this.storage.delete(job.objectKey);
          await this.db.storedMedia.updateMany({
            where: { objectKey: job.objectKey },
            data: { deletedAt: new Date() },
          });
          deleted++;
        }
        await this.db.mediaCleanupJob.update({
          where: { id: job.id },
          data: { completedAt: new Date(), lockedAt: null, lastErrorCode: null },
        });
      } catch {
        await this.db.mediaCleanupJob.update({
          where: { id: job.id },
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
