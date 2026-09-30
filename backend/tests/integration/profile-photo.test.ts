import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { ProfilePhotoService } from "../../src/modules/customers/profile-photo.service.js";
import { CustomersService } from "../../src/modules/customers/customers.service.js";
import { MediaService } from "../../src/modules/media/media.service.js";
import { MediaCleanupWorker } from "../../src/workers/media-cleanup.worker.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "private profile photos",
  () => {
    const storage = new MemoryMediaStorage();
    const service = new ProfilePhotoService(prisma, storage);
    const context = { requestId: "media-test", ipAddress: null, userAgent: null };
    let actor: AuthenticatedActor;
    let other: AuthenticatedActor;
    let bytes: Buffer;
    let profileId: string;
    beforeAll(async () => {
      bytes = await sharp({
        create: { width: 64, height: 64, channels: 3, background: "red" },
      })
        .png()
        .toBuffer();
      const accounts = [];
      for (let n = 0; n < 2; n++) {
        const user = await prisma.user.create({
          data: {
            email: `photo-${randomUUID()}@example.test`,
            passwordHash: "unusable-test",
            profile: {
              create: { firstName: "Photo", lastName: "Owner", phone: "+2348000000000" },
            },
          },
          include: { profile: true },
        });
        accounts.push({
          userId: user.id,
          sessionId: randomUUID(),
          role: "CUSTOMER" as const,
          email: user.email,
          mfaRequired: false,
          mfaVerifiedAt: null,
        });
        if (!n) profileId = user.profile!.id;
      }
      actor = accounts[0]!;
      other = accounts[1]!;
    });
    afterAll(async () => prisma.$disconnect());
    async function prepare(value = bytes) {
      const result = await service.prepare(
        actor,
        {
          mimeType: "image/png",
          sizeBytes: value.length,
          checksumSha256: createHash("sha256").update(value).digest("hex"),
        },
        context,
      );
      const key = storage.prepared.at(-1)!.key;
      storage.objects.set(key, value);
      return result.assetToken;
    }
    it.each(["STAFF", "ADMIN", "SUPER_ADMIN"] as const)(
      "denies %s private-media mutation even with MFA",
      async (role) => {
        await expect(
          service.prepare(
            { ...actor, role, mfaVerifiedAt: new Date() },
            { mimeType: "image/png", sizeBytes: 10, checksumSha256: "a".repeat(64) },
            context,
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      },
    );
    it("keeps uploads invisible until confirmation; replacement/removal survive profile reads", async () => {
      const assetToken = await prepare();
      expect((await new CustomersService().profile(actor)).photo).toBeNull();
      const result = await service.confirm(
        actor,
        { assetToken, expectedVersion: 0 },
        context,
      );
      expect(result.version).toBe(1);
      expect((await new CustomersService().profile(actor)).photo?.id).toBe(
        result.images[0]!.id,
      );
      expect(
        (await service.read(actor, result.images[0]!.id)).bytes.length,
      ).toBeGreaterThan(0);
      await expect(service.read(other, result.images[0]!.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(
        await service.confirm(actor, { assetToken, expectedVersion: 0 }, context),
      ).toEqual(result);
      await expect(
        service.confirm(actor, { assetToken, expectedVersion: 1 }, context),
      ).rejects.toMatchObject({ code: "MEDIA_TICKET_CONSUMED" });
      const replacement = await prepare();
      await expect(
        service.confirm(actor, { assetToken: replacement, expectedVersion: 0 }, context),
      ).rejects.toMatchObject({ code: "STALE_VERSION" });
      expect((await new CustomersService().profile(actor)).photo?.id).toBe(
        result.images[0]!.id,
      );
      const replaced = await service.confirm(
        actor,
        { assetToken: replacement, expectedVersion: 1 },
        context,
      );
      expect(replaced.version).toBe(2);
      await expect(service.read(actor, result.images[0]!.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect((await service.remove(actor, 2, context)).version).toBe(3);
      expect((await new CustomersService().profile(actor)).photo).toBeNull();
    });
    it("rejects wrong owner, purpose, resource, expiry and invalid objects", async () => {
      const assetToken = await prepare();
      await expect(
        service.confirm(other, { assetToken, expectedVersion: 0 }, context),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_OWNER" });
      const shared = new MediaService(prisma, storage);
      const binding = {
        actorUserId: actor.userId,
        ownerUserId: actor.userId,
        resourceType: "PRODUCT" as const,
        resourceId: profileId,
        branchId: null,
      };
      await expect(
        shared.confirm(binding, { assetToken, expectedVersion: 3 }, async () => ({
          version: 4,
          images: [],
        })),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_PURPOSE" });
      await expect(
        shared.confirm(
          { ...binding, resourceType: "PROFILE", resourceId: randomUUID() },
          { assetToken, expectedVersion: 3 },
          async () => ({ version: 4, images: [] }),
        ),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_RESOURCE" });
      await prisma.mediaUpload.update({
        where: { tokenHash: createHash("sha256").update(assetToken).digest("hex") },
        data: {
          createdAt: new Date(Date.now() - 600000),
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      await expect(
        service.confirm(actor, { assetToken, expectedVersion: 3 }, context),
      ).rejects.toMatchObject({ code: "MEDIA_TICKET_EXPIRED" });
      const invalid = await prepare(Buffer.from("not an image"));
      await expect(
        service.confirm(actor, { assetToken: invalid, expectedVersion: 3 }, context),
      ).rejects.toMatchObject({ code: "MEDIA_UNSUPPORTED_FORMAT" });
    });
    it("preserves an attached image during outage and keeps cleanup retryable", async () => {
      const assetToken = await prepare();
      const confirmed = await service.confirm(
        actor,
        { assetToken, expectedVersion: 3 },
        context,
      );
      const pending = await prepare();
      storage.unavailable = true;
      await expect(
        service.confirm(actor, { assetToken: pending, expectedVersion: 4 }, context),
      ).rejects.toMatchObject({ code: "MEDIA_STORAGE_UNAVAILABLE" });
      expect((await new CustomersService().profile(actor)).photo?.id).toBe(
        confirmed.images[0]!.id,
      );
      await service.remove(actor, 4, context);
      const worker = new MediaCleanupWorker(prisma, storage);
      await worker.runOnce(100);
      expect(
        await prisma.mediaCleanupJob.count({
          where: { lastErrorCode: "MEDIA_CLEANUP_FAILED" },
        }),
      ).toBeGreaterThan(0);
      storage.unavailable = false;
      await prisma.mediaCleanupJob.updateMany({
        where: { lastErrorCode: "MEDIA_CLEANUP_FAILED" },
        data: { availableAt: new Date() },
      });
      expect((await worker.runOnce(100)).deleted).toBeGreaterThan(0);
    });
    it("serializes concurrent confirmations without duplicating images", async () => {
      const assetToken = await prepare();
      const [a, b] = await Promise.all([
        service.confirm(actor, { assetToken, expectedVersion: 5 }, context),
        service.confirm(actor, { assetToken, expectedVersion: 5 }, context),
      ]);
      expect(a).toEqual(b);
      expect(await prisma.resourceImage.count({ where: { profileId } })).toBe(1);
    });
    it("rolls back failed database attachment and never logs credentials in audits", async () => {
      const assetToken = await prepare();
      await expect(
        new MediaService(prisma, storage).confirm(
          {
            actorUserId: actor.userId,
            ownerUserId: actor.userId,
            resourceType: "PROFILE",
            resourceId: profileId,
            branchId: null,
          },
          { assetToken, expectedVersion: 6 },
          async () => {
            throw new Error("injected DB failure");
          },
        ),
      ).rejects.toThrow("injected DB failure");
      const ticket = await prisma.mediaUpload.findUniqueOrThrow({
        where: { tokenHash: createHash("sha256").update(assetToken).digest("hex") },
      });
      expect(ticket.confirmedAt).toBeNull();
      expect(
        await prisma.storedMedia.findUnique({ where: { uploadId: ticket.id } }),
      ).toBeNull();
      const logs = await prisma.auditLog.findMany({ where: { entityId: profileId } });
      expect(JSON.stringify(logs)).not.toMatch(
        /assetToken|objectKey|https:|checksumSha256/,
      );
    });
    it("cleans abandoned bytes while protecting attached assets and recovering cascaded orphans", async () => {
      const pending = await prepare();
      const ticket = await prisma.mediaUpload.findUniqueOrThrow({
        where: { tokenHash: createHash("sha256").update(pending).digest("hex") },
      });
      const image = await prisma.resourceImage.findFirstOrThrow({
        where: { profileId },
        include: { asset: true },
      });
      // Advance only these synthetic jobs to model their retention deadline.
      await prisma.mediaCleanupJob.updateMany({
        where: {
          objectKey: {
            in: [ticket.objectKey, ticket.verifiedObjectKey, image.asset.objectKey],
          },
        },
        data: { availableAt: new Date(0) },
      });
      const worker = new MediaCleanupWorker(prisma, storage);
      await worker.runOnce(100);
      expect(storage.objects.has(ticket.objectKey)).toBe(false);
      expect(storage.objects.has(image.asset.objectKey)).toBe(true);
      // This fixture has no domain records: a cascade leaves a discoverable owned orphan.
      await prisma.customerProfile.delete({ where: { id: profileId } });
      await prisma.storedMedia.update({
        where: { id: image.assetId },
        data: { createdAt: new Date(Date.now() - 7200000) },
      });
      // Cleanup is bounded and may have older jobs from other integration fixtures.
      // Run successive batches until this orphan is processed, without changing
      // another fixture's deadlines or increasing the production batch limit.
      await expect
        .poll(
          async () => {
            await worker.runOnce(100);
            return storage.objects.has(image.asset.objectKey);
          },
          { timeout: 60_000, interval: 25 },
        )
        .toBe(false);
      expect(
        (await prisma.storedMedia.findUniqueOrThrow({ where: { id: image.assetId } }))
          .deletedAt,
      ).not.toBeNull();
    }, 90_000);
  },
);
