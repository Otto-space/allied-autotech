import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoryObjectStorage } from "../helpers/object-storage.js";
import { objectStorage } from "../../src/providers/storage/s3-object-storage.adapter.js";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";

import { env } from "../../src/config/env.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { testOwner } from "../helpers/owner.js";
import { testReservationAcceptance } from "../helpers/reservation-terms.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
const app = createApp({ checkReadiness: async () => undefined });
const endpoint = "/api/v1/staff/vehicle-transactions",
  sessions: string[] = [];
afterEach(() => vi.restoreAllMocks());
async function account(role: UserRole, branchId?: string, verified = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-qa-only")
      : await prisma.user.create({
          data: {
            email: `stock-creation-${randomUUID()}@example.test`,
            passwordHash: "unusable-qa-only",
            role,
            emailVerifiedAt: new Date(),
            ...(role === "CUSTOMER"
              ? {
                  profile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Discovery",
                      phone: "+2348000000000",
                    },
                  },
                }
              : {
                  staffProfile: {
                    create: {
                      firstName: "Synthetic",
                      lastName: "Discovery",
                      ...(branchId ? { branchId } : {}),
                    },
                  },
                }),
          },
        });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken(),
    expiry = new Date(Date.now() + 3600000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      createdAt: new Date(Date.now() - 1000),
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt: expiry,
      idleExpiresAt: expiry,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: verified && role !== "CUSTOMER" ? new Date() : null,
    },
  });
  sessions.push(session.id);
  return {
    user,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: env.FRONTEND_URL[0]!,
      "x-csrf-token": csrf,
    },
  };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "workshop transaction detail",
  () => {
    let branch: string, other: string;
    beforeAll(async () => {
      const [actual] = await prisma.$queryRaw<
        { database: string; host: string; port: number }[]
      >`SELECT current_database() AS database,host(inet_server_addr()) AS host,inet_server_port() AS port`;
      expect(actual).toEqual({
        database: env.DB_NAME,
        host: env.DB_HOST,
        port: env.DB_PORT,
      });
      expect(actual?.database).toMatch(/_(test|ci)$/);
      const make = async () =>
        (
          await prisma.branch.create({
            data: {
              code: randomUUID().slice(0, 8),
              name: "Synthetic detail sales workshop",
              address: "Synthetic",
              city: "Synthetic",
              state: "Synthetic",
            },
          })
        ).id;
      branch = await make();
      other = await make();
    });
    afterAll(async () => {
      await prisma.session.deleteMany({ where: { id: { in: sessions } } });
      await prisma.$disconnect();
    });
    async function seed(paid = false) {
      const v = await prisma.vehicle.create({
          data: {
            branchId: branch,
            stockNumber: "SD-" + randomUUID().slice(0, 9).toUpperCase(),
            make: "Toyota",
            model: "Camry",
            year: 2022,
            condition: "USED",
          },
        }),
        listing = await prisma.vehicleListing.create({
          data: {
            vehicleId: v.id,
            branchId: branch,
            title: "Synthetic purchase detail",
            slug: "sd-" + randomUUID(),
            priceKobo: 9999999999999999n,
            status: paid ? "RESERVED" : "DRAFT",
            publishedAt: paid ? new Date("2026-10-17T08:00:00Z") : null,
            reservedAt: paid ? new Date("2026-10-17T09:00:00Z") : null,
          },
        });
      return prisma.vehicleTransaction.create({
        data: {
          vehicleListingId: listing.id,
          transactionNumber: "SD-" + randomUUID(),
          customerName: "Synthetic customer",
          customerPhone: "+2348000000000",
          askingPriceKobo: 9999999999999999n,
          agreedPriceKobo: paid ? 9999999999999999n : null,
          status: paid ? "PAID" : "ENQUIRY",
          ...(paid ? await testReservationAcceptance() : {}),
          paidAt: paid ? new Date("2026-10-17T09:00:37.123Z") : null,
        },
      });
    }
    it("returns exact scoped detail with independent role/MFA and private boundaries", async () => {
      const sale = await seed(),
        admin = await account("ADMIN", branch),
        staff = await account("STAFF", branch),
        foreign = await account("STAFF", other),
        customer = await account("CUSTOMER"),
        unverified = await account("ADMIN", branch, false),
        owner = await account("SUPER_ADMIN"),
        path = endpoint + "/" + sale.id;
      for (const actor of [admin, staff, owner]) {
        const result = await request(app).get(path).set(actor.headers);
        expect(result.status).toBe(200);
        expect(result.headers["cache-control"]).toContain("no-store");
        expect(result.body.data).toMatchObject({
          id: sale.id,
          askingPriceKobo: "9999999999999999",
          agreedPriceKobo: null,
          version: 0,
        });
        expect(result.body.data.customerPhone).toBeUndefined();
        expect(
          result.body.data.vehicleListing.vehicle.acquisitionCostKobo,
        ).toBeUndefined();
      }
      for (const actor of [foreign, customer, unverified])
        expect((await request(app).get(path).set(actor.headers)).status).toBe(403);
      expect((await request(app).get(path)).status).toBe(401);
      expect(
        await prisma.auditLog.count({ where: { entityId: sale.id, action: "READ" } }),
      ).toBe(3);
    });
    it("returns the committed negotiation/progress history with exact reviewed reasons", async () => {
      const sale = await seed(),
        admin = await account("ADMIN", branch),
        path = endpoint + "/" + sale.id;
      const result = await request(app)
        .post(path + "/negotiate")
        .set(admin.headers)
        .send({
          expectedVersion: 0,
          agreedPriceKobo: "9999999999999999",
          reservationRequiredKobo: null,
          notes: "Reviewed public negotiation note",
        });
      expect(result.status).toBe(200);
      expect(result.body.data).toMatchObject({
        version: 1,
        status: "NEGOTIATING",
        agreedPriceKobo: "9999999999999999",
        reservationRequiredKobo: null,
      });
      expect(result.body.data.statusHistory).toHaveLength(1);
      expect(result.body.data.statusHistory[0]).toMatchObject({
        fromStatus: "ENQUIRY",
        toStatus: "NEGOTIATING",
        reason: "Reviewed public negotiation note",
      });
      expect(
        (
          await request(app)
            .post(path + "/negotiate")
            .set(admin.headers)
            .send({ expectedVersion: 0, agreedPriceKobo: "1" })
        ).status,
      ).toBe(409);
      const cancelled = await request(app)
        .post(path + "/status")
        .set(admin.headers)
        .send({
          expectedVersion: 1,
          status: "CANCELLED",
          reason: "Reviewed cancellation",
        });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.statusHistory).toHaveLength(2);
      expect(cancelled.body.data.statusHistory.at(-1)).toMatchObject({
        fromStatus: "NEGOTIATING",
        toStatus: "CANCELLED",
        reason: "Reviewed cancellation",
      });
      expect(cancelled.body.data.cancelledAt).toBeTruthy();
      expect(
        await prisma.auditLog.count({
          where: { entityId: sale.id, action: { in: ["UPDATE", "VEHICLE_RELEASED"] } },
        }),
      ).toBe(2);
    });
    it("keeps handover versions independent and preserves cancelled handover recovery limits", async () => {
      const admin = await account("ADMIN", branch),
        sale = await seed(true),
        path = endpoint + "/" + sale.id,
        body = {
          recipientName: "Synthetic recipient",
          recipientPhone: "+2348000000000",
          odometerKm: 0,
          keysDelivered: 0,
        };
      const storage = new MemoryObjectStorage(),
        bytes = Buffer.from("%PDF-1.4\nSynthetic signed handover\n%%EOF");
      vi.spyOn(objectStorage, "createUpload").mockImplementation((input) =>
        storage.createUpload(input),
      );
      vi.spyOn(objectStorage, "verifyObject").mockImplementation((input) =>
        storage.verifyObject(input),
      );
      const upload = await request(app)
        .post(
          `/api/v1/staff/vehicles/${(await prisma.vehicleListing.findUniqueOrThrow({ where: { id: sale.vehicleListingId } })).vehicleId}/assets/upload`,
        )
        .set(admin.headers)
        .send({
          kind: "HANDOVER",
          mimeType: "application/pdf",
          sizeBytes: bytes.length,
          checksumSha256: createHash("sha256").update(bytes).digest("hex"),
        });
      expect(upload.status).toBe(201);
      storage.objects.set(storage.prepared.at(-1)!.key, bytes);
      const created = await request(app)
        .post(path + "/handovers")
        .set(admin.headers)
        .send({ ...body, assetToken: upload.body.data.assetToken });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ status: "HANDOVER_PENDING", version: 1 });
      const handover = created.body.data.handover;
      expect(handover).toMatchObject({ ...body, status: "PENDING", version: 0 });
      expect(handover.hasSignedDocument).toBe(true);
      expect(handover.signedDocumentObjectKey).toBeUndefined();
      expect(handover.signedDocumentSha256).toBeUndefined();
      const hp = path + "/handovers/" + handover.id + "/status",
        ready = await request(app)
          .post(hp)
          .set(admin.headers)
          .send({ expectedVersion: 0, status: "READY" });
      expect(ready.status).toBe(200);
      expect(ready.body.data.version).toBe(1);
      expect(ready.body.data.handover.version).toBe(1);
      expect(
        (
          await request(app)
            .post(hp)
            .set(admin.headers)
            .send({ expectedVersion: 0, status: "COMPLETED" })
        ).status,
      ).toBe(409);
      const completed = await request(app)
        .post(hp)
        .set(admin.headers)
        .send({ expectedVersion: 1, status: "COMPLETED" });
      expect(completed.status).toBe(200);
      expect(completed.body.data).toMatchObject({
        status: "COMPLETED",
        version: 2,
        vehicleListing: { status: "SOLD" },
        handover: { status: "COMPLETED", version: 2 },
      });
      expect(
        await prisma.auditLog.count({
          where: { entityId: sale.id, action: { in: ["CREATE", "STATUS_CHANGE"] } },
        }),
      ).toBe(3);
      const second = await seed(true),
        secondPath = endpoint + "/" + second.id,
        c = await request(app)
          .post(secondPath + "/handovers")
          .set(admin.headers)
          .send(body),
        secondHandover = c.body.data.handover.id,
        sp = secondPath + "/handovers/" + secondHandover + "/status";
      expect(c.status).toBe(201);
      expect(c.body.data.handover.hasSignedDocument).toBe(false);
      expect(
        (
          await request(app)
            .post(sp)
            .set(admin.headers)
            .send({ expectedVersion: 0, status: "READY" })
        ).status,
      ).toBe(200);
      const missingDocument = await request(app)
        .post(sp)
        .set(admin.headers)
        .send({ expectedVersion: 1, status: "COMPLETED" });
      expect(missingDocument.status).toBe(409);
      expect(
        (
          await prisma.vehicleHandover.findUniqueOrThrow({
            where: { id: secondHandover },
          })
        ).version,
      ).toBe(1);
      const stopped = await request(app)
        .post(sp)
        .set(admin.headers)
        .send({ expectedVersion: 1, status: "CANCELLED" });
      expect(stopped.status).toBe(200);
      expect(stopped.body.data).toMatchObject({
        status: "HANDOVER_PENDING",
        version: 1,
        handover: { status: "CANCELLED", version: 2 },
      });
      expect(
        (
          await request(app)
            .post(sp)
            .set(admin.headers)
            .send({ expectedVersion: 2, status: "READY" })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .post(secondPath + "/handovers")
            .set(admin.headers)
            .send(body)
        ).status,
      ).toBe(409);
      expect(
        await prisma.vehicleHandover.count({
          where: { vehicleTransactionId: second.id },
        }),
      ).toBe(1);
    });
  },
);
