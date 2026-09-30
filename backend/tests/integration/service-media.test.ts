import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { ServiceMediaService } from "../../src/modules/service-operations/service-media.service.js";
import { ServiceOperationsService } from "../../src/modules/service-operations/service-operations.service.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "service image lifecycle",
  () => {
    const storage = new MemoryMediaStorage();
    const service = new ServiceMediaService(prisma, storage);
    const operations = new ServiceOperationsService(prisma);
    const context = { requestId: "service-media-test", ipAddress: null, userAgent: null };
    let bytes: Buffer;
    beforeAll(async () => {
      bytes = await sharp({
        create: { width: 96, height: 64, channels: 3, background: "orange" },
      })
        .png()
        .toBuffer();
    });
    afterAll(async () => prisma.$disconnect());
    const input = () => ({
      mimeType: "image/png" as const,
      sizeBytes: bytes.length,
      checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    });
    async function fixture() {
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable",
          role: "ADMIN",
        },
      });
      const row = await prisma.service.create({
        data: { name: "Image test", slug: randomUUID(), pricingType: "QUOTE_REQUIRED" },
      });
      const actor: AuthenticatedActor = {
        userId: user.id,
        email: user.email,
        role: "ADMIN",
        sessionId: randomUUID(),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      return { actor, id: row.id };
    }
    async function prepare(actor: AuthenticatedActor, id: string) {
      const ticket = await service.prepare(actor, id, input(), context);
      storage.objects.set(storage.prepared.at(-1)!.key, bytes);
      return ticket.assetToken;
    }
    async function attach(actor: AuthenticatedActor, id: string, version = 0) {
      return service.confirm(
        actor,
        id,
        {
          assetToken: await prepare(actor, id),
          expectedVersion: version,
          altText: "Workshop",
        },
        context,
      );
    }
    it.each(["CUSTOMER", "STAFF"] as const)("denies %s management", async (role) => {
      const { actor, id } = await fixture();
      const denied = { ...actor, role };
      await expect(service.prepare(denied, id, input(), context)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(service.snapshot(denied, id)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      await expect(
        service.remove(denied, id, randomUUID(), 0, context),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("requires MFA and permits super administrators", async () => {
      const { actor, id } = await fixture();
      await expect(
        service.prepare({ ...actor, mfaVerifiedAt: null }, id, input(), context),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await attach({ ...actor, role: "SUPER_ADMIN" }, id)).images).toHaveLength(
        1,
      );
    });
    it("binds tickets to both administrator and service, and supports exact replay", async () => {
      const a = await fixture(),
        b = await fixture();
      const body = { assetToken: await prepare(a.actor, a.id), expectedVersion: 0 };
      await expect(service.confirm(a.actor, b.id, body, context)).rejects.toMatchObject({
        code: "MEDIA_WRONG_RESOURCE",
      });
      await expect(service.confirm(b.actor, a.id, body, context)).rejects.toMatchObject({
        code: "MEDIA_WRONG_OWNER",
      });
      const result = await service.confirm(a.actor, a.id, body, context);
      expect(await service.confirm(a.actor, a.id, body, context)).toEqual(result);
      await expect(
        service.confirm(a.actor, a.id, { ...body, altText: "Changed" }, context),
      ).rejects.toMatchObject({ code: "MEDIA_TICKET_CONSUMED" });
      await expect(
        service.update(
          a.actor,
          b.id,
          result.images[0]!.id,
          { expectedVersion: 0, altText: "Wrong" },
          context,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("publishes only active-service images with safe projections and revokes old image IDs", async () => {
      const { actor, id } = await fixture();
      const first = await attach(actor, id);
      const imageId = first.images[0]!.id;
      expect((await service.read(imageId)).bytes.length).toBeGreaterThan(0);
      const publicRow = await operations.publicService(id);
      expect(publicRow).toMatchObject({
        image: { url: `/api/v1/public/media/images/${imageId}` },
      });
      expect(JSON.stringify(publicRow)).not.toMatch(
        /objectKey|assetToken|tokenHash|checksum|\/admin\//,
      );
      await operations.updateService(
        actor,
        id,
        { expectedVersion: 1, isActive: false },
        context,
      );
      await expect(service.read(imageId)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        (await service.read(imageId, { actor, serviceId: id })).bytes.length,
      ).toBeGreaterThan(0);
      const second = await attach(actor, id, 2);
      expect(second.images).toHaveLength(1);
      await expect(service.read(imageId, { actor, serviceId: id })).rejects.toMatchObject(
        { code: "NOT_FOUND" },
      );
      expect(await service.remove(actor, id, second.images[0]!.id, 3, context)).toEqual({
        version: 4,
        images: [],
      });
      await operations.updateService(
        actor,
        id,
        { expectedVersion: 4, isActive: true },
        context,
      );
      expect(await operations.publicService(id)).toMatchObject({ image: null });
    });
    it("preserves the prior image on invalid replacement and queues cleanup only after successful changes", async () => {
      const { actor, id } = await fixture();
      const first = await attach(actor, id);
      const old = await prisma.resourceImage.findUniqueOrThrow({
        where: { id: first.images[0]!.id },
        include: { asset: true },
      });
      const token = await prepare(actor, id);
      storage.objects.set(storage.prepared.at(-1)!.key, Buffer.from("invalid"));
      await expect(
        service.confirm(actor, id, { assetToken: token, expectedVersion: 1 }, context),
      ).rejects.toBeDefined();
      expect(await service.snapshot(actor, id)).toEqual(first);
      const replaced = await attach(actor, id, 1);
      expect(replaced.version).toBe(2);
      const cleanup = await prisma.mediaCleanupJob.findUniqueOrThrow({
        where: { objectKey: old.asset.objectKey },
      });
      expect(cleanup.availableAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
    it("serializes concurrent images and service metadata using the shared version", async () => {
      const { actor, id } = await fixture();
      const first = await attach(actor, id);
      const imageId = first.images[0]!.id;
      const results = await Promise.allSettled([
        service.update(
          actor,
          id,
          imageId,
          { expectedVersion: 1, altText: "Updated" },
          context,
        ),
        operations.updateService(
          actor,
          id,
          { expectedVersion: 1, shortDescription: "Updated" },
          context,
        ),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({
        reason: { code: "STALE_VERSION" },
      });
      expect((await service.snapshot(actor, id)).version).toBe(2);
    });
  },
);
