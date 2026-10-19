import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import { MediaCleanupWorker } from "../../src/workers/media-cleanup.worker.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";

describe.skipIf(process.env["RUN_DATABASE_TESTS"] !== "true")(
  "media orphan discovery",
  () => {
    afterAll(async () => prisma.$disconnect());
    it("discovers later orphans behind a full page of pending cleanup jobs", async () => {
      const rollback = new Error("synthetic rollback");
      try {
        await prisma.$transaction(
          async (tx) => {
            const database = new Proxy(prisma, {
              get(_target, property) {
                if (property === "$transaction")
                  return <T>(work: (client: Prisma.TransactionClient) => Promise<T>) =>
                    work(tx);
                return Reflect.get(tx, property);
              },
            });
            const user = await tx.user.create({
              data: {
                email: `orphan-scan-${randomUUID()}@example.test`,
                passwordHash: "unusable-test",
                profile: {
                  create: {
                    firstName: "Synthetic",
                    lastName: "Media",
                    phone: "+2348000000000",
                  },
                },
              },
              include: { profile: true },
            });
            const storage = new MemoryMediaStorage();
            const assets = [];
            for (let index = 0; index < 6; index++) {
              const objectKey = `media/verified/${randomUUID()}`;
              const asset = await tx.storedMedia.create({
                data: {
                  objectKey,
                  mimeType: "image/webp",
                  sizeBytes: 32,
                  width: 32,
                  height: 32,
                  checksumSha256: "a".repeat(64),
                  createdAt: new Date(Date.UTC(1900, 0, 1, 0, 0, index)),
                  upload: {
                    create: {
                      tokenHash: randomUUID().replaceAll("-", "").repeat(2),
                      actorUserId: user.id,
                      ownerUserId: user.id,
                      resourceType: "PROFILE",
                      resourceId: user.profile!.id,
                      purpose: "PROFILE_PHOTO",
                      objectKey: `media/pending/${randomUUID()}`,
                      verifiedObjectKey: objectKey,
                      mimeType: "image/png",
                      sizeBytes: 32,
                      checksumSha256: "a".repeat(64),
                      expiresAt: new Date(Date.now() + 3600000),
                    },
                  },
                },
              });
              assets.push(asset);
              storage.objects.set(objectKey, Buffer.from("synthetic orphan"));
            }
            const future = new Date(Date.now() + 3600000);
            // A delayed retry and an active lease fill the entire discovery page.
            for (const [index, asset] of assets.slice(0, 2).entries()) {
              await tx.mediaCleanupJob.create({
                data: {
                  objectKey: asset.objectKey,
                  availableAt: future,
                  lockedAt: index === 1 ? new Date() : null,
                  attempts: 3,
                  lastErrorCode: "MEDIA_CLEANUP_FAILED",
                },
              });
            }
            // A previously completed job must be reopened after its asset becomes orphaned.
            await tx.mediaCleanupJob.create({
              data: {
                objectKey: assets[2]!.objectKey,
                availableAt: new Date(0),
                completedAt: new Date(),
              },
            });
            await tx.resourceImage.create({
              data: {
                assetId: assets[5]!.id,
                profileId: user.profile!.id,
              },
            });
            const pending = await tx.mediaCleanupJob.findMany({
              where: {
                objectKey: { in: assets.slice(0, 2).map((asset) => asset.objectKey) },
              },
              orderBy: { objectKey: "asc" },
            });
            await new MediaCleanupWorker(database, storage).runOnce(2);
            await new MediaCleanupWorker(database, storage).runOnce(2);
            for (const asset of assets.slice(2, 5)) {
              expect(storage.objects.has(asset.objectKey)).toBe(false);
              expect(
                (await tx.storedMedia.findUniqueOrThrow({ where: { id: asset.id } }))
                  .deletedAt,
              ).not.toBeNull();
            }
            expect(
              await tx.mediaCleanupJob.findMany({
                where: {
                  objectKey: { in: assets.slice(0, 2).map((asset) => asset.objectKey) },
                },
                orderBy: { objectKey: "asc" },
              }),
            ).toEqual(pending);
            for (const asset of [assets[0]!, assets[1]!, assets[5]!])
              expect(storage.objects.has(asset.objectKey)).toBe(true);
            expect(
              await tx.mediaCleanupJob.findUnique({
                where: { objectKey: assets[5]!.objectKey },
              }),
            ).toBeNull();
            throw rollback;
          },
          { timeout: 60000 },
        );
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });
  },
);
