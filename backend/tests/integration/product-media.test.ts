import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { ProductMediaService } from "../../src/modules/catalog/product-media.service.js";
import { CatalogService } from "../../src/modules/catalog/catalog.service.js";
import { productResponseSchema } from "../../src/modules/catalog/product-media.schemas.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "product binary images alongside hosted URLs",
  () => {
    const storage = new MemoryMediaStorage();
    const service = new ProductMediaService(prisma, storage);
    const catalog = new CatalogService(prisma);
    const context = { requestId: "product-media-test", ipAddress: null, userAgent: null };
    let bytes: Buffer;
    beforeAll(async () => {
      bytes = await sharp({
        create: { width: 96, height: 64, channels: 3, background: "blue" },
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
      const product = await prisma.product.create({
        data: {
          name: "Product media",
          slug: randomUUID(),
          sku: randomUUID(),
          priceKobo: 100000n,
          category: { create: { name: "Image test", slug: randomUUID() } },
        },
      });
      const actor: AuthenticatedActor = {
        userId: user.id,
        email: user.email,
        role: "ADMIN",
        sessionId: randomUUID(),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      return { actor, id: product.id, categoryId: product.categoryId };
    }
    async function prepare(actor: AuthenticatedActor, id: string) {
      const ticket = await service.prepare(actor, id, input(), context);
      storage.objects.set(storage.prepared.at(-1)!.key, bytes);
      return ticket.assetToken;
    }
    const confirmBody = (
      assetToken: string,
      expectedVersion: number,
      isPrimary = false,
    ) => ({
      assetToken,
      expectedVersion,
      isPrimary,
      sortOrder: 0,
      altText: "Uploaded product",
    });
    const hosted = (
      actor: AuthenticatedActor,
      id: string,
      isPrimary = false,
      expectedVersion?: number,
    ) =>
      catalog.createImage(
        actor,
        id,
        {
          url: "https://images.example.test/part.jpg",
          altText: "External part",
          sortOrder: 5,
          isPrimary,
          ...(expectedVersion === undefined ? {} : { expectedVersion }),
        },
        context,
      );
    it.each(["CUSTOMER", "STAFF"] as const)(
      "denies %s upload management",
      async (role) => {
        const { actor, id } = await fixture();
        await expect(
          service.prepare({ ...actor, role }, id, input(), context),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          service.confirm(
            { ...actor, role },
            id,
            confirmBody("x".repeat(43), 0),
            context,
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      },
    );
    it("requires MFA, permits super administrators and binds actor/product/purpose/expiry", async () => {
      const a = await fixture(),
        b = await fixture();
      await expect(
        service.prepare({ ...a.actor, mfaVerifiedAt: null }, a.id, input(), context),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const token = await prepare({ ...a.actor, role: "SUPER_ADMIN" }, a.id);
      await expect(
        service.confirm(a.actor, b.id, confirmBody(token, 0), context),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_RESOURCE" });
      await expect(
        service.confirm(b.actor, a.id, confirmBody(token, 0), context),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_OWNER" });
      await prisma.mediaUpload.update({
        where: { tokenHash: createHash("sha256").update(token).digest("hex") },
        data: { resourceType: "SERVICE", purpose: "SERVICE_IMAGE" },
      });
      await expect(
        service.confirm(a.actor, a.id, confirmBody(token, 0), context),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_PURPOSE" });
      await prisma.mediaUpload.update({
        where: { tokenHash: createHash("sha256").update(token).digest("hex") },
        data: {
          resourceType: "PRODUCT",
          purpose: "PRODUCT_IMAGE",
          createdAt: new Date(Date.now() - 10000),
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      await expect(
        service.confirm(a.actor, a.id, confirmBody(token, 0), context),
      ).rejects.toMatchObject({ code: "MEDIA_TICKET_EXPIRED" });
    });
    it("keeps the hosted URL contract and ordering while sharing primary selection", async () => {
      const { actor, id } = await fixture();
      const external = await hosted(actor, id, true);
      expect(external).toMatchObject({
        url: "https://images.example.test/part.jpg",
        source: "EXTERNAL",
        width: null,
      });
      const body = confirmBody(await prepare(actor, id), 1, true);
      const result = await service.confirm(actor, id, body, context);
      expect(await service.confirm(actor, id, body, context)).toEqual(result);
      await expect(
        service.confirm(actor, id, { ...body, sortOrder: 2 }, context),
      ).rejects.toMatchObject({ code: "MEDIA_TICKET_CONSUMED" });
      let product = await catalog.publicProduct(id);
      expect(
        productResponseSchema.safeParse(JSON.parse(JSON.stringify(product))).success,
      ).toBe(true);
      expect(product.images.map((image) => image.id)).toEqual([
        result.images[0]!.id,
        external.id,
      ]);
      expect(product.images.filter((image) => image.isPrimary)).toHaveLength(1);
      expect(product.images[0]).toMatchObject({
        source: "UPLOADED",
        width: 96,
        height: 64,
        url: `/api/v1/public/catalog/products/images/${result.images[0]!.id}`,
      });
      expect(JSON.stringify(product)).not.toMatch(
        /objectKey|mediaAsset|assetToken|tokenHash|checksum|\/admin\//,
      );
      await catalog.updateImage(
        actor,
        id,
        external.id,
        {
          sortOrder: 0,
          isPrimary: true,
          altText: "New external text",
          expectedVersion: 2,
        },
        context,
      );
      product = await catalog.publicProduct(id);
      expect(product.images.find((image) => image.id === external.id)).toMatchObject({
        altText: "New external text",
        isPrimary: true,
      });
      await catalog.updateImage(actor, id, external.id, { isPrimary: false }, context);
      expect(
        (await catalog.publicProduct(id)).images.some((image) => image.isPrimary),
      ).toBe(false);
    });
    it("serves uploads only when both product and category are active; administrators can preview drafts", async () => {
      const { actor, id, categoryId } = await fixture();
      const result = await service.confirm(
        actor,
        id,
        confirmBody(await prepare(actor, id), 0),
        context,
      );
      const imageId = result.images[0]!.id;
      expect((await service.read(imageId)).bytes.length).toBeGreaterThan(0);
      await prisma.category.update({
        where: { id: categoryId },
        data: { isActive: false },
      });
      await expect(service.read(imageId)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        (await service.read(imageId, { actor, productId: id })).bytes.length,
      ).toBeGreaterThan(0);
      await prisma.category.update({
        where: { id: categoryId },
        data: { isActive: true },
      });
      await prisma.product.update({ where: { id }, data: { isActive: false } });
      await expect(service.read(imageId)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        service.read(imageId, { actor, productId: (await fixture()).id }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("protects managed URLs and queues only owned objects when existing CRUD removes images", async () => {
      const { actor, id } = await fixture();
      const external = await hosted(actor, id);
      const result = await service.confirm(
        actor,
        id,
        confirmBody(await prepare(actor, id), 1, true),
        context,
      );
      const imageId = result.images[0]!.id;
      const owned = await prisma.productImage.findUniqueOrThrow({
        where: { id: imageId },
        include: { mediaAsset: true },
      });
      await expect(
        catalog.updateImage(
          actor,
          id,
          imageId,
          { url: "https://images.example.test/replaced.jpg", expectedVersion: 2 },
          context,
        ),
      ).rejects.toMatchObject({ code: "MEDIA_MANAGED_URL_IMMUTABLE" });
      await catalog.deleteImage(actor, id, external.id, context, 2);
      expect(
        await prisma.mediaCleanupJob.findUnique({ where: { objectKey: external.url } }),
      ).toBeNull();
      await catalog.deleteImage(actor, id, imageId, context, 3);
      expect(
        (
          await prisma.mediaCleanupJob.findUniqueOrThrow({
            where: { objectKey: owned.mediaAsset!.objectKey },
          })
        ).availableAt.getTime(),
      ).toBeLessThanOrEqual(Date.now());
      await expect(service.read(imageId)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await catalog.publicProduct(id)).images).toEqual([]);
    });
    it("serializes binary confirmation and hosted creation and rejects stale metadata writes", async () => {
      const { actor, id } = await fixture();
      const token = await prepare(actor, id);
      const outcomes = await Promise.allSettled([
        service.confirm(actor, id, confirmBody(token, 0, true), context),
        hosted(actor, id, true, 0),
      ]);
      expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.find((result) => result.status === "rejected")).toMatchObject({
        reason: { code: "STALE_VERSION" },
      });
      const product = await catalog.publicProduct(id);
      expect(product.mediaVersion).toBe(1);
      await expect(
        catalog.updateImage(
          actor,
          id,
          product.images[0]!.id,
          { altText: "Stale", expectedVersion: 0 },
          context,
        ),
      ).rejects.toMatchObject({ code: "STALE_VERSION" });
      await expect(
        catalog.deleteImage(actor, id, product.images[0]!.id, context, 0),
      ).rejects.toMatchObject({ code: "STALE_VERSION" });
    });
    it("checks the shared gallery limit at preparation and confirmation while permitting existing edits/removal", async () => {
      const { actor, id } = await fixture();
      const token = await prepare(actor, id);
      for (let index = 0; index < 12; index++) await hosted(actor, id);
      await expect(service.prepare(actor, id, input(), context)).rejects.toMatchObject({
        code: "MEDIA_COUNT_LIMIT",
      });
      await expect(hosted(actor, id)).rejects.toMatchObject({
        code: "MEDIA_COUNT_LIMIT",
      });
      await expect(
        service.confirm(actor, id, confirmBody(token, 12), context),
      ).rejects.toMatchObject({ code: "MEDIA_COUNT_LIMIT" });
      const image = (await catalog.publicProduct(id)).images[0]!;
      await catalog.updateImage(
        actor,
        id,
        image.id,
        { altText: "At the limit", expectedVersion: 12 },
        context,
      );
      await catalog.deleteImage(actor, id, image.id, context, 13);
      expect((await catalog.publicProduct(id)).images).toHaveLength(11);
    });
    it("does not change an existing gallery when the transferred bytes fail verification", async () => {
      const { actor, id } = await fixture();
      await hosted(actor, id, true);
      const before = await catalog.publicProduct(id);
      const token = await prepare(actor, id);
      storage.objects.set(storage.prepared.at(-1)!.key, Buffer.from("invalid"));
      await expect(
        service.confirm(actor, id, confirmBody(token, 1, true), context),
      ).rejects.toBeDefined();
      expect(await catalog.publicProduct(id)).toEqual(before);
    });
  },
);
