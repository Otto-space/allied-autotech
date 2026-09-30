import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { GarageMediaService } from "../../src/modules/customers/garage-media.service.js";
import { ProfilePhotoService } from "../../src/modules/customers/profile-photo.service.js";
import { CustomersService } from "../../src/modules/customers/customers.service.js";
import { MemoryMediaStorage } from "../helpers/media-storage.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "private garage galleries",
  () => {
    const storage = new MemoryMediaStorage();
    const service = new GarageMediaService(prisma, storage);
    const read = new ProfilePhotoService(prisma, storage);
    const customers = new CustomersService();
    const context = { requestId: "garage-media-test", ipAddress: null, userAgent: null };
    let bytes: Buffer;
    beforeAll(async () => {
      bytes = await sharp({
        create: { width: 96, height: 64, channels: 3, background: "green" },
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
          profile: {
            create: {
              firstName: "Garage",
              lastName: "Owner",
              phone: "+2348000000000",
              customerVehicles: {
                create: [
                  { make: "Toyota", model: "Corolla", year: 2020 },
                  { make: "Honda", model: "Civic", year: 2021 },
                ],
              },
            },
          },
        },
        include: { profile: { include: { customerVehicles: true } } },
      });
      const actor: AuthenticatedActor = {
        userId: user.id,
        email: user.email,
        role: "CUSTOMER",
        sessionId: randomUUID(),
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
      return {
        actor,
        id: user.profile!.customerVehicles[0]!.id,
        second: user.profile!.customerVehicles[1]!.id,
      };
    }
    async function prepare(actor: AuthenticatedActor, id: string) {
      const prepared = await service.prepare(actor, id, input(), context);
      storage.objects.set(storage.prepared.at(-1)!.key, bytes);
      return prepared.assetToken;
    }
    const attach = async (actor: AuthenticatedActor, id: string, version: number) =>
      service.confirm(
        actor,
        id,
        {
          assetToken: await prepare(actor, id),
          expectedVersion: version,
          sortOrder: 0,
          isPrimary: false,
        },
        context,
      );
    it.each(["STAFF", "ADMIN", "SUPER_ADMIN"] as const)(
      "denies %s garage media access",
      async (role) => {
        const { actor, id } = await fixture();
        const denied = { ...actor, role, mfaRequired: true, mfaVerifiedAt: new Date() };
        await expect(service.prepare(denied, id, input(), context)).rejects.toMatchObject(
          { code: "FORBIDDEN" },
        );
        await expect(
          service.update(
            denied,
            id,
            randomUUID(),
            { expectedVersion: 0, isPrimary: true },
            context,
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
          service.remove(denied, id, randomUUID(), 0, context),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      },
    );
    it("enforces ownership, image binding and ticket-to-vehicle binding on reads and mutations", async () => {
      const a = await fixture(),
        b = await fixture();
      const token = await prepare(a.actor, a.id);
      await expect(
        service.confirm(
          a.actor,
          a.second,
          { assetToken: token, expectedVersion: 0, sortOrder: 0, isPrimary: false },
          context,
        ),
      ).rejects.toMatchObject({ code: "MEDIA_WRONG_RESOURCE" });
      await expect(
        service.prepare(b.actor, a.id, input(), context),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const result = await service.confirm(
        a.actor,
        a.id,
        { assetToken: token, expectedVersion: 0, sortOrder: 0, isPrimary: false },
        context,
      );
      const image = result.images[0]!;
      expect((await read.read(a.actor, image.id)).bytes.length).toBeGreaterThan(0);
      await expect(read.read(b.actor, image.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        service.update(
          a.actor,
          a.second,
          image.id,
          { expectedVersion: 0, altText: "Wrong vehicle" },
          context,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        service.remove(b.actor, a.id, image.id, 1, context),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const detail = await customers.vehicle(a.actor, a.id);
      expect(detail.images).toEqual(result.images);
      expect(JSON.stringify(detail)).not.toMatch(
        /objectKey|assetToken|tokenHash|checksum/,
      );
    });
    it("serializes attachment, supports exact replay and rejects competing stale edits", async () => {
      const { actor, id } = await fixture();
      const tokens = [await prepare(actor, id), await prepare(actor, id)];
      const inputs = tokens.map((assetToken) => ({
        assetToken,
        expectedVersion: 0,
        sortOrder: 0,
        isPrimary: true,
      }));
      const results = await Promise.allSettled(
        inputs.map((value) => service.confirm(actor, id, value, context)),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejectedIndex = results.findIndex((r) => r.status === "rejected");
      expect(results[rejectedIndex]).toMatchObject({ reason: { code: "STALE_VERSION" } });
      const retry = { ...inputs[rejectedIndex]!, expectedVersion: 1 };
      const confirmed = await service.confirm(actor, id, retry, context);
      expect(await service.confirm(actor, id, retry, context)).toEqual(confirmed);
      const edits = await Promise.allSettled(
        confirmed.images.map((image) =>
          service.update(
            actor,
            id,
            image.id,
            { expectedVersion: 2, isPrimary: true },
            context,
          ),
        ),
      );
      expect(edits.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(edits.filter((r) => r.status === "rejected")[0]).toMatchObject({
        reason: { code: "STALE_VERSION" },
      });
      const detail = await customers.vehicle(actor, id);
      expect(detail.images.filter((image) => image.isPrimary)).toHaveLength(1);
      expect(detail.mediaVersion).toBe(3);
    });
    it("persists alt text and order; removal chooses a deterministic cover and permits an empty gallery", async () => {
      const { actor, id } = await fixture();
      const first = (await attach(actor, id, 0)).images[0]!;
      const second = (await attach(actor, id, 1)).images.find(
        (image) => image.id !== first.id,
      )!;
      const edited = await service.update(
        actor,
        id,
        second.id,
        { expectedVersion: 2, altText: "Passenger side", sortOrder: 8, isPrimary: true },
        context,
      );
      expect(edited.images.find((image) => image.id === second.id)).toMatchObject({
        altText: "Passenger side",
        sortOrder: 8,
        isPrimary: true,
      });
      expect((await customers.vehicle(actor, id)).images).toEqual(edited.images);
      const removed = await service.remove(actor, id, second.id, 3, context);
      expect(removed.images).toEqual([
        expect.objectContaining({ id: first.id, isPrimary: true }),
      ]);
      await expect(read.read(actor, second.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect((await service.remove(actor, id, first.id, 4, context)).images).toEqual([]);
    });
    it("enforces the count at preparation and confirmation even for pre-issued tickets", async () => {
      const { actor, id } = await fixture();
      const tickets: string[] = [];
      for (let n = 0; n < 13; n++) tickets.push(await prepare(actor, id));
      for (let n = 0; n < 12; n++)
        await service.confirm(
          actor,
          id,
          { assetToken: tickets[n]!, expectedVersion: n, sortOrder: n, isPrimary: false },
          context,
        );
      await expect(
        service.confirm(
          actor,
          id,
          {
            assetToken: tickets[12]!,
            expectedVersion: 12,
            sortOrder: 12,
            isPrimary: false,
          },
          context,
        ),
      ).rejects.toMatchObject({ code: "MEDIA_COUNT_LIMIT" });
      await expect(prepare(actor, id)).rejects.toMatchObject({
        code: "MEDIA_COUNT_LIMIT",
      });
      expect((await customers.vehicle(actor, id)).images).toHaveLength(12);
    });
    it("vehicle deletion revokes image reads and atomically queues all owned objects", async () => {
      const { actor, id } = await fixture();
      const result = await attach(actor, id, 0);
      const keys = await prisma.resourceImage.findMany({
        where: { customerVehicleId: id },
        select: { asset: { select: { objectKey: true } } },
      });
      await customers.deleteVehicle(actor, id, context);
      await expect(read.read(actor, result.images[0]!.id)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      for (const image of keys)
        expect(
          await prisma.mediaCleanupJob.findUnique({
            where: { objectKey: image.asset.objectKey },
          }),
        ).toMatchObject({ completedAt: null });
      expect(await prisma.resourceImage.count({ where: { customerVehicleId: id } })).toBe(
        0,
      );
    });
  },
);
