import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { prisma } from "../../src/config/database.js";
import { VehicleSalesService } from "../../src/modules/vehicle-sales/vehicle-sales.service.js";
import * as audit from "../../src/modules/audit/audit.service.js";
import { ExpirationWorker } from "../../src/workers/expiration.worker.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function account(): Promise<AuthenticatedActor> {
  const user = await prisma.user.create({
    data: {
      email: `creation-${randomUUID()}@example.test`,
      passwordHash: "unusable-test-password",
      role: "CUSTOMER",
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Isolated", lastName: "Retry", phone: "+2348000000000" },
      },
    },
  });
  return {
    userId: user.id,
    email: user.email,
    role: "CUSTOMER",
    sessionId: randomUUID(),
    mfaRequired: false,
    mfaVerifiedAt: null,
  };
}
async function fixture() {
  const owner = await account();
  const branch = await prisma.branch.create({
    data: {
      code: `IR-${randomUUID().slice(0, 8)}`,
      name: "Isolated retry",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: {
      branchId: branch.id,
      stockNumber: `IR-${randomUUID()}`,
      make: "Test",
      model: "Retry",
      year: 2025,
    },
  });
  const listing = await prisma.vehicleListing.create({
    data: {
      vehicleId: vehicle.id,
      branchId: branch.id,
      title: "Retry",
      slug: `retry-${randomUUID()}`,
      priceKobo: 10000n,
      status: "AVAILABLE",
      publishedAt: new Date(),
    },
  });
  return {
    owner,
    listing,
    input: {
      vehicleListingId: listing.id,
      preferredStartAt: new Date(Date.now() + 3600000).toISOString(),
      notes: "Synthetic retry",
    },
  };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Vehicle creation retry guarantees",
  () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });
    afterAll(() => prisma.$disconnect());

    it.each(["inspection", "enquiry"] as const)(
      "serializes concurrent %s creation, replays after restart and rejects changed input",
      async (kind) => {
        const { owner, listing, input } = await fixture();
        const key = randomUUID();
        const body = kind === "inspection" ? input : { vehicleListingId: listing.id };
        const create = (service: VehicleSalesService, value = body) =>
          kind === "inspection"
            ? service.requestInspection(owner, { ...input, ...value }, context(), key)
            : service.createTransaction(owner, value, context(), key);
        const results = await Promise.all(
          Array.from({ length: 5 }, () => create(new VehicleSalesService(prisma))),
        );
        const first = results[0] as { id: string };
        expect(
          results.every((result) => (result as { id: string }).id === first.id),
        ).toBe(true);
        expect(
          await prisma.auditLog.count({
            where: { entityId: first.id, action: "CREATE" },
          }),
        ).toBe(1);
        const count =
          kind === "inspection"
            ? await prisma.inspectionRequest.count({
                where: { vehicleListingId: listing.id },
              })
            : await prisma.vehicleTransaction.count({
                where: { vehicleListingId: listing.id },
              });
        expect(count).toBe(1);
        await expect(
          create(new VehicleSalesService(prisma), {
            ...body,
            vehicleListingId: randomUUID(),
          }),
        ).rejects.toMatchObject({ statusCode: 409, code: "IDEMPOTENCY_CONFLICT" });
        await prisma.vehicleListing.update({
          where: { id: listing.id },
          data: { status: "SOLD", soldAt: new Date() },
        });
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(Date.now() + 7200000);
        await expect(create(new VehicleSalesService(prisma))).resolves.toMatchObject({
          id: first.id,
        });
      },
    );

    it("isolates customers and operations while preserving callers without a key", async () => {
      const { owner, input } = await fixture();
      const other = await account();
      const service = new VehicleSalesService(prisma);
      const key = randomUUID();
      const first = await service.requestInspection(owner, input, context(), key);
      const second = await service.requestInspection(other, input, context(), key);
      const enquiry = await service.createTransaction(
        owner,
        { vehicleListingId: input.vehicleListingId },
        context(),
        key,
      );
      expect(second).not.toMatchObject({ id: (first as { id: string }).id });
      expect(enquiry).not.toMatchObject({ id: (first as { id: string }).id });
      const legacy = await service.requestInspection(owner, input, context());
      expect(legacy).not.toMatchObject({ id: (first as { id: string }).id });
      await prisma.customerProfile.update({
        where: { userId: owner.userId },
        data: { firstName: "Changed" },
      });
      await expect(
        service.requestInspection(owner, input, context(), key),
      ).resolves.toMatchObject({ id: (first as { id: string }).id });
    });

    it("rolls back a failed attempt and permits the same key when the cause is corrected", async () => {
      const { owner, listing, input } = await fixture();
      const service = new VehicleSalesService(prisma);
      const key = randomUUID();
      await prisma.vehicleListing.update({
        where: { id: listing.id },
        data: { status: "DRAFT" },
      });
      await expect(
        service.requestInspection(owner, input, context(), key),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(
        await prisma.idempotencyRecord.count({ where: { userId: owner.userId } }),
      ).toBe(0);
      await prisma.vehicleListing.update({
        where: { id: listing.id },
        data: { status: "AVAILABLE" },
      });
      await expect(
        service.requestInspection(owner, input, context(), key),
      ).resolves.toMatchObject({ vehicleListingId: listing.id });
    });

    it("retains only a receipt for 24 hours and fails closed for incomplete or unowned receipts", async () => {
      const { owner, input } = await fixture();
      const service = new VehicleSalesService(prisma);
      const key = randomUUID();
      const start = Date.now();
      await service.requestInspection(owner, input, context(), key);
      const receipt = await prisma.idempotencyRecord.findFirstOrThrow({
        where: { userId: owner.userId },
      });
      expect(Object.keys(receipt.responseBody as object)).toEqual(["resourceId"]);
      expect(receipt.expiresAt.getTime()).toBeGreaterThanOrEqual(start + 86400000);
      await prisma.idempotencyRecord.update({
        where: { id: receipt.id },
        data: { status: "IN_PROGRESS" },
      });
      await expect(
        service.requestInspection(owner, input, context(), key),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
      const other = await account();
      const otherRecord = (await service.requestInspection(
        other,
        input,
        context(),
        key,
      )) as { id: string };
      await prisma.idempotencyRecord.update({
        where: { id: receipt.id },
        data: { status: "COMPLETED", responseBody: { resourceId: otherRecord.id } },
      });
      await expect(
        service.requestInspection(owner, input, context(), key),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rolls back domain and audit writes on failure, then safely retries", async () => {
      const { owner, input, listing } = await fixture();
      const key = randomUUID();
      const service = new VehicleSalesService(prisma);
      vi.spyOn(audit, "appendAuditEvent").mockRejectedValueOnce(
        new Error("Synthetic audit failure"),
      );
      await expect(
        service.requestInspection(owner, input, context(), key),
      ).rejects.toThrow("Synthetic audit failure");
      expect(
        await prisma.inspectionRequest.count({ where: { vehicleListingId: listing.id } }),
      ).toBe(0);
      expect(
        await prisma.idempotencyRecord.count({ where: { userId: owner.userId } }),
      ).toBe(0);
      await expect(
        service.requestInspection(owner, input, context(), key),
      ).resolves.toMatchObject({ vehicleListingId: listing.id });
    });

    it("replays retained expired receipts but treats keys as new after worker cleanup", async () => {
      const { owner, input } = await fixture();
      const key = randomUUID();
      const service = new VehicleSalesService(prisma);
      const first = (await service.requestInspection(owner, input, context(), key)) as {
        id: string;
      };
      await prisma.idempotencyRecord.updateMany({
        where: { userId: owner.userId },
        data: {
          createdAt: new Date(Date.now() - 86400000),
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      await expect(
        service.requestInspection(owner, input, context(), key),
      ).resolves.toMatchObject({ id: first.id });
      await new ExpirationWorker(prisma).runOnce();
      expect(
        await prisma.idempotencyRecord.count({ where: { userId: owner.userId } }),
      ).toBe(0);
      const next = (await service.requestInspection(owner, input, context(), key)) as {
        id: string;
      };
      expect(next.id).not.toBe(first.id);
    });

    it("normalizes property order and equivalent date offsets before fingerprinting", async () => {
      const { owner, input } = await fixture();
      const key = randomUUID();
      const service = new VehicleSalesService(prisma);
      const first = (await service.requestInspection(owner, input, context(), key)) as {
        id: string;
      };
      await expect(
        service.requestInspection(
          owner,
          {
            notes: input.notes,
            preferredStartAt: input.preferredStartAt.replace("Z", "+00:00"),
            vehicleListingId: input.vehicleListingId,
          },
          context(),
          key,
        ),
      ).resolves.toMatchObject({ id: first.id });
    });

    it("validates optional keys at the HTTP boundary and retains session, CSRF and role checks", async () => {
      const { owner, input } = await fixture();
      const token = generateOpaqueToken();
      const csrf = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + 3600000);
      await prisma.session.create({
        data: {
          userId: owner.userId,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          expiresAt,
          idleExpiresAt: expiresAt,
        },
      });
      const app = createApp({ checkReadiness: async () => undefined });
      const headers = {
        Cookie: `${sessionCookieName}=${token}`,
        Origin: "http://localhost:3000",
        "X-CSRF-Token": csrf,
      };
      for (const [path, body] of [
        ["vehicle-inspections", input],
        ["vehicle-transactions", { vehicleListingId: input.vehicleListingId }],
      ] as const) {
        expect(
          (await request(app).post(`/api/v1/customers/${path}`).send(body)).status,
        ).toBe(401);
        expect(
          (
            await request(app)
              .post(`/api/v1/customers/${path}`)
              .set({ Cookie: headers.Cookie, Origin: headers.Origin })
              .send(body)
          ).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .post(`/api/v1/customers/${path}`)
              .set({ ...headers, "Idempotency-Key": "short" })
              .send(body)
          ).status,
        ).toBe(422);
        const key = randomUUID();
        const first = await request(app)
          .post(`/api/v1/customers/${path}`)
          .set({ ...headers, "Idempotency-Key": key })
          .send(body);
        const replay = await request(app)
          .post(`/api/v1/customers/${path}`)
          .set({ ...headers, "Idempotency-Key": key })
          .send(body);
        expect(first.status).toBe(201);
        expect(replay.status).toBe(201);
        expect(replay.body.data.id).toBe(first.body.data.id);
      }
      await expect(
        new VehicleSalesService(prisma).requestInspection(
          { ...owner, role: "ADMIN" },
          input,
          context(),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  },
);
