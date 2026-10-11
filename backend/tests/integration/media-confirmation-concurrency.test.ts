import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { ProfilePhotoService } from "../../src/modules/customers/profile-photo.service.js";
import { MediaCleanupWorker } from "../../src/workers/media-cleanup.worker.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "media confirmation storage concurrency",
  () => {
    let bytes: Buffer;
    const context = {
      requestId: "media-confirmation-race",
      ipAddress: null,
      userAgent: null,
    };
    beforeAll(async () => {
      bytes = await sharp({
        create: { width: 64, height: 64, channels: 3, background: "blue" },
      })
        .png()
        .toBuffer();
    });
    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });
    afterAll(async () => prisma.$disconnect());

    async function fixture() {
      const user = await prisma.user.create({
        data: {
          email: `confirmation-${randomUUID()}@example.test`,
          passwordHash: "unusable",
          profile: {
            create: { firstName: "Media", lastName: "Owner", phone: "+2348000000000" },
          },
        },
      });
      const actor: AuthenticatedActor = {
        userId: user.id,
        email: user.email,
        role: "CUSTOMER",
        sessionId: randomUUID(),
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
      const storage = new MemoryMediaStorage();
      const service = new ProfilePhotoService(prisma, storage);
      const prepared = await service.prepare(
        actor,
        {
          mimeType: "image/png",
          sizeBytes: bytes.length,
          checksumSha256: createHash("sha256").update(bytes).digest("hex"),
        },
        context,
      );
      const ticket = await prisma.mediaUpload.findUniqueOrThrow({
        where: {
          tokenHash: createHash("sha256").update(prepared.assetToken).digest("hex"),
        },
      });
      storage.objects.set(ticket.objectKey, bytes);
      const confirm = () =>
        service.confirm(
          actor,
          { assetToken: prepared.assetToken, expectedVersion: 0 },
          context,
        );
      return { actor, storage, service, ticket, confirm };
    }

    it("does not rewrite a confirmed object for concurrent exact retries", async () => {
      const f = await fixture();
      const write = vi.spyOn(f.storage, "write");
      const [first, second] = await Promise.all([f.confirm(), f.confirm()]);
      expect(first).toEqual(second);
      expect(write).toHaveBeenCalledTimes(1);
    });

    it("does not recreate removed bytes when a duplicate finishes reading late", async () => {
      const f = await fixture();
      const entered = gate(),
        release = gate();
      vi.spyOn(f.storage, "read").mockImplementationOnce(async () => {
        entered.resolve();
        await release.promise;
        return bytes;
      });
      const delayed = f.confirm();
      let expected;
      try {
        await entered.promise;
        expected = await f.confirm();
        await f.service.remove(f.actor, expected.version, context);
        const worker = new MediaCleanupWorker(prisma, f.storage);
        await expect
          .poll(async () => {
            await worker.runOnce(100);
            return f.storage.objects.has(f.ticket.verifiedObjectKey);
          })
          .toBe(false);
      } finally {
        release.resolve();
      }
      expect(await delayed).toEqual(expected);
      expect(f.storage.objects.has(f.ticket.verifiedObjectKey)).toBe(false);
      expect(await prisma.resourceImage.count({ where: { assetId: f.ticket.id } })).toBe(
        0,
      );
    });

    it("does not write expired bytes after cleanup ran during a delayed read", async () => {
      const f = await fixture();
      const entered = gate(),
        release = gate();
      vi.spyOn(f.storage, "read").mockImplementationOnce(async () => {
        entered.resolve();
        await release.promise;
        return bytes;
      });
      const write = vi.spyOn(f.storage, "write");
      const delayed = f.confirm();
      const rejection = expect(delayed).rejects.toMatchObject({
        code: "MEDIA_TICKET_EXPIRED",
      });
      try {
        await entered.promise;
        await prisma.mediaUpload.update({
          where: { id: f.ticket.id },
          data: {
            createdAt: new Date(Date.now() - 7_200_000),
            expiresAt: new Date(Date.now() - 3_600_000),
          },
        });
        await prisma.mediaCleanupJob.updateMany({
          where: { objectKey: { in: [f.ticket.objectKey, f.ticket.verifiedObjectKey] } },
          data: { availableAt: new Date(0) },
        });
        await new MediaCleanupWorker(prisma, f.storage).runOnce(100);
      } finally {
        release.resolve();
      }
      await rejection;
      expect(write).not.toHaveBeenCalled();
      expect(f.storage.objects.has(f.ticket.verifiedObjectKey)).toBe(false);
    });

    it("rechecks expiry after a storage write and leaves failed attachment cleanup durable", async () => {
      const f = await fixture();
      const write = f.storage.write.bind(f.storage);
      vi.spyOn(f.storage, "write").mockImplementationOnce(async (key, data) => {
        await write(key, data);
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(f.ticket.expiresAt.getTime() + 1));
      });
      await expect(f.confirm()).rejects.toMatchObject({ code: "MEDIA_TICKET_EXPIRED" });
      vi.useRealTimers();
      expect(
        await prisma.storedMedia.findUnique({ where: { uploadId: f.ticket.id } }),
      ).toBeNull();
      expect(
        await prisma.mediaCleanupJob.findUniqueOrThrow({
          where: { objectKey: f.ticket.verifiedObjectKey },
        }),
      ).toMatchObject({ completedAt: null });
      await prisma.mediaCleanupJob.update({
        where: { objectKey: f.ticket.verifiedObjectKey },
        data: { availableAt: new Date(0) },
      });
      await new MediaCleanupWorker(prisma, f.storage).runOnce(100);
      expect(f.storage.objects.has(f.ticket.verifiedObjectKey)).toBe(false);
    });

    it("makes cleanup wait until a verified write is attached before checking references", async () => {
      const f = await fixture();
      const entered = gate(),
        release = gate();
      const write = f.storage.write.bind(f.storage);
      vi.spyOn(f.storage, "write").mockImplementationOnce(async (key, data) => {
        await write(key, data);
        entered.resolve();
        await release.promise;
      });
      const confirmation = f.confirm();
      let cleanup: Promise<unknown> | undefined;
      let cleanupFinished = false;
      try {
        await entered.promise;
        // Force only this fixture's job due while storage has written but not acknowledged.
        await prisma.mediaCleanupJob.update({
          where: { objectKey: f.ticket.verifiedObjectKey },
          data: { availableAt: new Date(0) },
        });
        cleanup = new MediaCleanupWorker(prisma, f.storage).runOnce(1).then((result) => {
          cleanupFinished = true;
          return result;
        });
        await expect
          .poll(async () => {
            const waiting = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT count(*) FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query LIKE '%FROM "MediaUpload"%FOR UPDATE%'
          `;
            return cleanupFinished || Number(waiting[0]?.count ?? 0) > 0;
          })
          .toBe(true);
        expect(cleanupFinished).toBe(false);
        expect(f.storage.objects.has(f.ticket.verifiedObjectKey)).toBe(true);
      } finally {
        release.resolve();
        await cleanup;
      }
      const result = await confirmation;
      expect(
        (await f.service.read(f.actor, result.images[0]!.id)).bytes.length,
      ).toBeGreaterThan(0);
      expect(
        await prisma.storedMedia.findUniqueOrThrow({ where: { uploadId: f.ticket.id } }),
      ).toMatchObject({ deletedAt: null });
    });
  },
);
