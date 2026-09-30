import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { issueVehicleAssetTicket } from "../../src/common/security/asset-tickets.js";
import { StockMediaService } from "../../src/modules/vehicles/stock-media.service.js";
import { VehiclesService } from "../../src/modules/vehicles/vehicles.service.js";
import { stockImageResultSchema } from "../../src/modules/vehicles/stock-media.schemas.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "stock image lifecycle",
  () => {
    const storage = new MemoryMediaStorage();
    const service = new StockMediaService(prisma, storage);
    const vehicles = new VehiclesService(prisma, undefined, service);
    const context = { requestId: "stock-image-test", ipAddress: null, userAgent: null };
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
    async function fixture(role: "ADMIN" | "STAFF" = "ADMIN") {
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Media stock",
          address: "Test",
          city: "Lagos",
          state: "Lagos",
        },
      });
      const user = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable",
          role,
          staffProfile: {
            create: { firstName: "Stock", lastName: "Operator", branchId: branch.id },
          },
        },
      });
      const vehicle = await prisma.vehicle.create({
        data: {
          branchId: branch.id,
          stockNumber: randomUUID(),
          make: "Toyota",
          model: "Corolla",
          year: 2021,
        },
      });
      const actor: AuthenticatedActor = {
        userId: user.id,
        email: user.email,
        role,
        sessionId: randomUUID(),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      return { actor, id: vehicle.id, branchId: branch.id };
    }
    async function prepare(f: Awaited<ReturnType<typeof fixture>>) {
      const ticket = await vehicles.createUpload(
        f.actor,
        f.id,
        { kind: "IMAGE", ...input() },
        context,
      );
      storage.objects.set(storage.prepared.at(-1)!.key, bytes);
      return ticket.assetToken;
    }
    const body = (assetToken: string, expectedVersion = 0, isPrimary = true) => ({
      assetToken,
      expectedVersion,
      isPrimary,
      sortOrder: 0,
      altText: "Front view",
    });
    async function attach(
      f: Awaited<ReturnType<typeof fixture>>,
      version = 0,
      primary = true,
    ) {
      return vehicles.addImage(
        f.actor,
        f.id,
        body(await prepare(f), version, primary),
        context,
      );
    }
    it.each(["STAFF", "ADMIN", "SUPER_ADMIN"] as const)(
      "permits authorized %s and returns safe receipts/previews",
      async (role) => {
        const f = await fixture(role === "STAFF" ? "STAFF" : "ADMIN");
        f.actor = { ...f.actor, role };
        const image = await attach(f);
        expect(image).toMatchObject({ version: 1, source: "UPLOADED", width: 96 });
        expect(
          await service.read(image.id, { actor: f.actor, vehicleId: f.id }),
        ).toMatchObject({ mimeType: "image/webp" });
        const read = await vehicles.staffVehicle(f.actor, f.id, context);
        expect(JSON.stringify(read)).toContain(
          `/staff/vehicles/${f.id}/images/${image.id}/content`,
        );
        expect(JSON.stringify(read)).not.toMatch(
          /mediaAsset|publicId|objectKey|assetToken|media\/verified/,
        );
        await expect(service.read(image.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      },
    );
    it("denies customers, missing MFA, cross-branch staff and inactive assignments", async () => {
      const f = await fixture("STAFF"),
        other = await fixture("STAFF");
      for (const actor of [
        { ...f.actor, role: "CUSTOMER" as const },
        { ...f.actor, mfaVerifiedAt: null },
        other.actor,
      ]) {
        await expect(
          service.prepare(actor, f.id, input(), context),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          service.update(
            actor,
            f.id,
            randomUUID(),
            { expectedVersion: 0, altText: "x" },
            context,
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          service.remove(actor, f.id, randomUUID(), 0, context),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      const token = await prepare(f);
      await prisma.branch.update({
        where: { id: f.branchId },
        data: { isActive: false },
      });
      await expect(
        service.confirm(f.actor, f.id, body(token), context),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("binds tickets to actor, vehicle, branch, purpose and expiry", async () => {
      const f = await fixture(),
        other = await fixture();
      const token = await prepare(f);
      await expect(
        service.confirm(other.actor, f.id, body(token), context),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_OWNER" });
      await expect(
        service.confirm(f.actor, other.id, body(token), context),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_RESOURCE" });
      await prisma.vehicle.update({
        where: { id: f.id },
        data: { branchId: other.branchId },
      });
      await expect(
        service.confirm(f.actor, f.id, body(token), context),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_RESOURCE" });
      await prisma.vehicle.update({
        where: { id: f.id },
        data: { branchId: f.branchId },
      });
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await prisma.mediaUpload.update({
        where: { tokenHash },
        data: { resourceType: "PRODUCT", purpose: "PRODUCT_IMAGE" },
      });
      await expect(
        service.confirm(f.actor, f.id, body(token), context),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_PURPOSE" });
      await prisma.mediaUpload.update({
        where: { tokenHash },
        data: {
          resourceType: "STOCK",
          purpose: "STOCK_IMAGE",
          createdAt: new Date(Date.now() - 120000),
          expiresAt: new Date(Date.now() - 60000),
        },
      });
      await expect(
        service.confirm(f.actor, f.id, body(token), context),
      ).rejects.toMatchObject({ code: "MEDIA_TICKET_EXPIRED" });
    });
    it("replays exact confirmation, rejects changed replay and supports legacy omission of version", async () => {
      const f = await fixture(),
        token = await prepare(f);
      const { expectedVersion: _version, ...input } = body(token);
      const image = await service.confirm(f.actor, f.id, input, context);
      expect(await service.confirm(f.actor, f.id, input, context)).toEqual(image);
      await expect(
        service.confirm(f.actor, f.id, { ...input, altText: "Changed" }, context),
      ).rejects.toMatchObject({ code: "MEDIA_TICKET_CONSUMED" });
      expect(await prisma.vehicleImage.count({ where: { vehicleId: f.id } })).toBe(1);
    });
    it("serializes cover changes, checks resource/image binding and shares metadata versions", async () => {
      const f = await fixture(),
        other = await fixture();
      const a = await attach(f),
        b = await attach(f, 1, false);
      const results = await Promise.allSettled([
        service.update(
          f.actor,
          f.id,
          a.id,
          { expectedVersion: 2, isPrimary: true, sortOrder: 8 },
          context,
        ),
        service.update(
          f.actor,
          f.id,
          b.id,
          { expectedVersion: 2, isPrimary: true },
          context,
        ),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.find((r) => r.status === "rejected")).toMatchObject({
        reason: { code: "STALE_VERSION" },
      });
      expect(
        await prisma.vehicleImage.count({ where: { vehicleId: f.id, isPrimary: true } }),
      ).toBe(1);
      await expect(
        service.update(
          f.actor,
          other.id,
          a.id,
          { expectedVersion: 0, altText: "wrong" },
          context,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        service.read(a.id, { actor: f.actor, vehicleId: other.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        vehicles.updateVehicle(
          f.actor,
          f.id,
          { expectedVersion: 2, color: "Blue" },
          context,
        ),
      ).rejects.toMatchObject({ code: "STALE_VERSION" });
      const changed = await service.update(
        f.actor,
        f.id,
        b.id,
        { expectedVersion: 3, altText: "Side view", sortOrder: 1 },
        context,
      );
      expect(stockImageResultSchema.safeParse(changed).success).toBe(true);
      expect(changed.images.find((i) => i.id === b.id)).toMatchObject({
        altText: "Side view",
        sortOrder: 1,
      });
    });
    it("protects the last published image, selects cover fallback and revokes public bytes", async () => {
      const f = await fixture(),
        a = await attach(f),
        b = await attach(f, 1, false);
      const listing = await prisma.vehicleListing.create({
        data: {
          vehicleId: f.id,
          branchId: f.branchId,
          title: "Available",
          slug: randomUUID(),
          priceKobo: 100n,
          status: "AVAILABLE",
          publishedAt: new Date(),
        },
      });
      expect((await service.read(a.id)).mimeType).toBe("image/webp");
      const result = await service.remove(f.actor, f.id, a.id, 2, context);
      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toMatchObject({ id: b.id, isPrimary: true });
      await expect(service.read(a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.remove(f.actor, f.id, b.id, 3, context)).rejects.toMatchObject(
        { code: "MEDIA_LAST_PUBLISHED_IMAGE" },
      );
      await prisma.branch.update({
        where: { id: f.branchId },
        data: { isActive: false },
      });
      await expect(service.read(b.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.remove(f.actor, f.id, b.id, 3, context)).rejects.toMatchObject(
        { code: "MEDIA_LAST_PUBLISHED_IMAGE" },
      );
      await prisma.vehicleListing.update({
        where: { id: listing.id },
        data: { status: "INACTIVE" },
      });
      expect((await service.remove(f.actor, f.id, b.id, 3, context)).images).toEqual([]);
    });
    it("preserves previous images on invalid and stale replacement attachments", async () => {
      const f = await fixture(),
        image = await attach(f);
      const token = await prepare(f);
      storage.objects.set(storage.prepared.at(-1)!.key, Buffer.from("invalid"));
      await expect(
        service.confirm(f.actor, f.id, body(token, 1), context),
      ).rejects.toMatchObject({ statusCode: 422 });
      const valid = await prepare(f);
      await expect(
        service.confirm(f.actor, f.id, body(valid, 0), context),
      ).rejects.toMatchObject({ code: "STALE_VERSION" });
      expect(
        await prisma.vehicleImage.findUnique({ where: { id: image.id } }),
      ).not.toBeNull();
      expect(await prisma.vehicleImage.count({ where: { vehicleId: f.id } })).toBe(1);
    });
    it("limits attachments without preventing edits/removal of legacy galleries", async () => {
      const f = await fixture(),
        token = await prepare(f);
      await prisma.vehicleImage.createMany({
        data: Array.from({ length: 20 }, (_, sortOrder) => ({
          vehicleId: f.id,
          url: "https://external.example.test/image.jpg",
          sortOrder,
        })),
      });
      await expect(prepare(f)).rejects.toMatchObject({ code: "MEDIA_COUNT_LIMIT" });
      await expect(
        service.confirm(f.actor, f.id, body(token), context),
      ).rejects.toMatchObject({ code: "MEDIA_COUNT_LIMIT" });
      const image = await prisma.vehicleImage.findFirstOrThrow({
        where: { vehicleId: f.id },
      });
      expect(
        (
          await service.update(
            f.actor,
            f.id,
            image.id,
            { expectedVersion: 0, altText: "Legacy" },
            context,
          )
        ).images,
      ).toHaveLength(20);
      expect(
        (await service.remove(f.actor, f.id, image.id, 1, context)).images,
      ).toHaveLength(19);
      expect(
        await prisma.mediaCleanupJob.findUnique({ where: { objectKey: image.url } }),
      ).toBeNull();
    });
    it("replaces atomically at the gallery limit and preserves the cover on failure", async () => {
      const f = await fixture(),
        original = await attach(f);
      await prisma.vehicleImage.createMany({
        data: Array.from({ length: 19 }, (_, sortOrder) => ({
          vehicleId: f.id,
          url: "https://external.example.test/x.jpg",
          sortOrder,
        })),
      });
      const prepareReplacement = async () => {
        const ticket = await vehicles.createUpload(
          f.actor,
          f.id,
          { kind: "IMAGE", replaceImageId: original.id, ...input() },
          context,
        );
        storage.objects.set(storage.prepared.at(-1)!.key, bytes);
        return ticket.assetToken;
      };
      const invalid = await prepareReplacement();
      storage.objects.set(storage.prepared.at(-1)!.key, Buffer.from("broken"));
      await expect(
        service.confirm(
          f.actor,
          f.id,
          { ...body(invalid, 1), replaceImageId: original.id },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(
        await prisma.vehicleImage.findUnique({ where: { id: original.id } }),
      ).not.toBeNull();
      const token = await prepareReplacement();
      const replacement = await service.confirm(
        f.actor,
        f.id,
        { ...body(token, 1, false), replaceImageId: original.id },
        context,
      );
      expect(replacement).toMatchObject({ version: 2, isPrimary: true });
      expect(
        await prisma.vehicleImage.findUnique({ where: { id: original.id } }),
      ).toBeNull();
      expect(await prisma.vehicleImage.count({ where: { vehicleId: f.id } })).toBe(20);
      await expect(
        service.read(original.id, { actor: f.actor, vehicleId: f.id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("adopts still-valid legacy encrypted tickets with real verification and replay safety", async () => {
      const f = await fixture();
      const issued = issueVehicleAssetTicket({
        actorUserId: f.actor.userId,
        vehicleId: f.id,
        kind: "IMAGE",
        ...input(),
      });
      storage.objects.set(issued.payload.objectKey, bytes);
      const result = await service.confirm(f.actor, f.id, body(issued.ticket), context);
      expect(result.source).toBe("UPLOADED");
      expect(await service.confirm(f.actor, f.id, body(issued.ticket), context)).toEqual(
        result,
      );
      expect(
        await prisma.mediaCleanupJob.findUnique({
          where: { objectKey: issued.payload.objectKey },
        }),
      ).not.toBeNull();
    });
    it("sanitizes legacy reads and queues only recognized owned keys", async () => {
      const f = await fixture(),
        key = `vehicles/${f.id}/image/${randomUUID()}`;
      storage.objects.set(key, bytes);
      const image = await prisma.vehicleImage.create({
        data: {
          vehicleId: f.id,
          url: "/legacy",
          publicId: key,
          checksumSha256: input().checksumSha256,
        },
      });
      expect(
        (await service.read(image.id, { actor: f.actor, vehicleId: f.id })).mimeType,
      ).toBe("image/webp");
      await service.remove(f.actor, f.id, image.id, 0, context);
      expect(
        await prisma.mediaCleanupJob.findUnique({ where: { objectKey: key } }),
      ).not.toBeNull();
      const external = await prisma.vehicleImage.create({
        data: {
          vehicleId: f.id,
          url: "https://external.example.test/x",
          publicId: "unowned-external-reference",
        },
      });
      await service.remove(f.actor, f.id, external.id, 1, context);
      expect(
        await prisma.mediaCleanupJob.findUnique({
          where: { objectKey: "unowned-external-reference" },
        }),
      ).toBeNull();
    });
  },
);
