import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import { enqueueMediaCleanup } from "../../src/modules/media/media.service.js";
import { MediaCleanupWorker } from "../../src/workers/media-cleanup.worker.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "media cleanup claim ownership",
  () => {
    const keys: string[] = [];
    afterEach(async () => {
      vi.restoreAllMocks();
      await prisma.mediaCleanupJob.deleteMany({ where: { objectKey: { in: keys } } });
      keys.length = 0;
    });
    afterAll(async () => prisma.$disconnect());

    async function fixture() {
      const objectKey = `media/verified/cleanup-test-${randomUUID()}`;
      keys.push(objectKey);
      const job = await prisma.mediaCleanupJob.create({
        data: { objectKey, availableAt: new Date(0) },
      });
      const storage = new MemoryMediaStorage();
      storage.objects.set(objectKey, Buffer.from("synthetic orphan"));
      return { job, storage, worker: new MediaCleanupWorker(prisma, storage) };
    }
    const requeue = (key: string, due: Date) =>
      prisma.$transaction((tx) => enqueueMediaCleanup(tx, key, due));

    it("keeps a newly queued cleanup when the superseded attempt succeeds", async () => {
      const { job, storage, worker } = await fixture();
      const due = new Date(Date.now() + 3_600_000);
      vi.spyOn(storage, "delete").mockImplementationOnce(async (key) => {
        storage.objects.delete(key);
        await requeue(key, due);
      });
      await worker.runOnce(1);
      expect(
        await prisma.mediaCleanupJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).toMatchObject({ completedAt: null, lockedAt: null, availableAt: due });
    });

    it("does not replace a newly queued deadline with an old attempt's retry", async () => {
      const { job, storage, worker } = await fixture();
      const due = new Date(Date.now() + 3_600_000);
      vi.spyOn(storage, "delete").mockImplementationOnce(async (key) => {
        await requeue(key, due);
        throw new Error("old storage attempt failed");
      });
      await worker.runOnce(1);
      expect(
        await prisma.mediaCleanupJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).toMatchObject({
        completedAt: null,
        lockedAt: null,
        availableAt: due,
        lastErrorCode: null,
      });
    });

    it("leaves a replacement worker's completed claim intact after lease expiry", async () => {
      const { job, storage, worker } = await fixture();
      let replacementCompletedAt: Date | null = null;
      vi.spyOn(storage, "delete").mockImplementationOnce(async () => {
        // Expire just this synthetic lease while its original storage call is pending.
        await prisma.mediaCleanupJob.update({
          where: { id: job.id },
          data: { lockedAt: new Date(0) },
        });
        await new MediaCleanupWorker(prisma, storage).runOnce(1);
        replacementCompletedAt = (
          await prisma.mediaCleanupJob.findUniqueOrThrow({
            where: { id: job.id },
          })
        ).completedAt;
        throw new Error("late failure from the expired worker");
      });
      await worker.runOnce(1);
      expect(replacementCompletedAt).not.toBeNull();
      expect(
        await prisma.mediaCleanupJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).toMatchObject({
        attempts: 2,
        completedAt: replacementCompletedAt,
        lockedAt: null,
        lastErrorCode: null,
        availableAt: job.availableAt,
      });
    });

    it("does not claim a queued snapshot after its deadline has been postponed", async () => {
      const { job, storage, worker } = await fixture();
      const due = new Date(Date.now() + 3_600_000);
      const findMany = prisma.mediaCleanupJob.findMany.bind(prisma.mediaCleanupJob);
      vi.spyOn(prisma.mediaCleanupJob, "findMany").mockImplementationOnce(
        async (args) => {
          const selected = await findMany(args);
          await requeue(job.objectKey, due);
          return selected;
        },
      );
      await worker.runOnce(1);
      expect(storage.objects.has(job.objectKey)).toBe(true);
      expect(
        await prisma.mediaCleanupJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).toMatchObject({ attempts: 0, completedAt: null, availableAt: due });
    });

    it("rejects a stale snapshot even when a newer retry restores the same deadline", async () => {
      const { job, storage, worker } = await fixture();
      const findMany = prisma.mediaCleanupJob.findMany.bind(prisma.mediaCleanupJob);
      vi.spyOn(prisma.mediaCleanupJob, "findMany").mockImplementationOnce(
        async (args) => {
          const selected = await findMany(args);
          storage.unavailable = true;
          await new MediaCleanupWorker(prisma, storage).runOnce(1);
          storage.unavailable = false;
          await requeue(job.objectKey, job.availableAt);
          return selected;
        },
      );
      await worker.runOnce(1);
      expect(storage.objects.has(job.objectKey)).toBe(true);
      expect(
        await prisma.mediaCleanupJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).toMatchObject({
        attempts: 1,
        lockedAt: null,
        completedAt: null,
        availableAt: job.availableAt,
      });
    });

    it("retries a current failed claim and completes it when storage recovers", async () => {
      const { job, storage, worker } = await fixture();
      storage.unavailable = true;
      const startedAt = Date.now();
      await worker.runOnce(1);
      const failed = await prisma.mediaCleanupJob.findUniqueOrThrow({
        where: { id: job.id },
      });
      expect(failed).toMatchObject({
        attempts: 1,
        completedAt: null,
        lockedAt: null,
        lastErrorCode: "MEDIA_CLEANUP_FAILED",
      });
      expect(failed.availableAt.getTime()).toBeGreaterThanOrEqual(startedAt + 60_000);
      storage.unavailable = false;
      await prisma.mediaCleanupJob.update({
        where: { id: job.id },
        data: { availableAt: new Date(0) },
      });
      await worker.runOnce(1);
      expect(storage.objects.has(job.objectKey)).toBe(false);
      expect(
        await prisma.mediaCleanupJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).toMatchObject({
        attempts: 2,
        completedAt: expect.any(Date),
        lastErrorCode: null,
      });
    });
  },
);
