import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { VehicleSalesService } from "../../src/modules/vehicle-sales/vehicle-sales.service.js";
import {
  reservationTermsKey,
  reservationTermsResponseSchema,
} from "../../src/modules/vehicle-sales/reservation-terms.js";
import { testOwner } from "../helpers/owner.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";

const app = createApp({ checkReadiness: async () => undefined });
const service = new VehicleSalesService(prisma);
const context = { requestId: "reservation-terms-test", ipAddress: null, userAgent: null };
const origin = "http://localhost:3000";
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function account(role: AuthenticatedActor["role"] = "CUSTOMER", assured = true) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-terms-test")
      : await prisma.user.create({
          data: {
            email: `${randomUUID()}@example.test`,
            passwordHash: "unusable-terms-test",
            role,
            emailVerifiedAt: new Date(),
            ...(role === "CUSTOMER"
              ? {
                  profile: {
                    create: {
                      firstName: "Terms",
                      lastName: "Customer",
                      phone: "+2348000000000",
                    },
                  },
                }
              : {}),
          },
        });
  const token = randomUUID().repeat(2),
    csrf = randomUUID().repeat(2);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      createdAt: new Date(Date.now() - 1000),
      lastUsedAt: new Date(),
      mfaRequired: role !== "CUSTOMER",
      expiresAt: new Date(Date.now() + 3600000),
      idleExpiresAt: new Date(Date.now() + 1800000),
      mfaVerifiedAt: role !== "CUSTOMER" && assured ? new Date() : null,
    },
  });
  const actor: AuthenticatedActor = {
    userId: user.id,
    email: user.email,
    role,
    sessionId: session.id,
    mfaRequired: role !== "CUSTOMER",
    mfaVerifiedAt: session.mfaVerifiedAt,
  };
  const cookie = `${sessionCookieName}=${token}`;
  return {
    user,
    actor,
    cookie,
    headers: { Cookie: cookie, Origin: origin, "x-csrf-token": csrf },
  };
}
async function fixture() {
  const buyer = await account();
  const customer = await prisma.customerProfile.findUniqueOrThrow({
    where: { userId: buyer.user.id },
  });
  const branch = await prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 8),
      name: "Terms test",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const vehicle = await prisma.vehicle.create({
    data: {
      branchId: branch.id,
      stockNumber: randomUUID(),
      make: "Test",
      model: "Terms",
      year: 2025,
    },
  });
  const listing = await prisma.vehicleListing.create({
    data: {
      vehicleId: vehicle.id,
      branchId: branch.id,
      title: "Test terms",
      slug: randomUUID(),
      priceKobo: 10000n,
      status: "AVAILABLE",
      publishedAt: new Date(),
    },
  });
  const sale = await prisma.vehicleTransaction.create({
    data: {
      vehicleListingId: listing.id,
      customerId: customer.id,
      transactionNumber: randomUUID(),
      customerName: "Terms Customer",
      customerPhone: customer.phone,
      askingPriceKobo: 10000n,
      agreedPriceKobo: 10000n,
      status: "NEGOTIATING",
    },
  });
  const read = (cookie = buyer.cookie) =>
    request(app)
      .get(`/api/v1/customers/vehicle-transactions/${sale.id}/reservation-terms`)
      .set("Cookie", cookie);
  const reserve = (termsVersion: string, key = randomUUID(), expectedVersion = 0) =>
    request(app)
      .post(`/api/v1/customers/vehicle-transactions/${sale.id}/reserve`)
      .set(buyer.headers)
      .set("Idempotency-Key", key)
      .send({ expectedVersion, termsVersion, termsAccepted: true });
  return { buyer, customer, listing, sale, read, reserve };
}
async function policyBody(enabled = true) {
  const latest = await prisma.businessPolicyVersion.findFirst({
    where: { key: reservationTermsKey },
    orderBy: { version: "desc" },
  });
  return {
    kind: "VEHICLE_RESERVATION_TERMS",
    expectedVersion: latest?.version ?? 0,
    effectiveAt: new Date().toISOString(),
    source: "Synthetic isolated security test; not business approval",
    approvalEvidence: "Synthetic provenance used only in this isolated test database",
    settings: enabled
      ? {
          enabled: true,
          title: "Synthetic agreement",
          body: `Synthetic test document ${randomUUID()}. Not approved business wording.`,
        }
      : { enabled: false, reason: "Synthetic withdrawal" },
  };
}
async function publish(enabled = true) {
  const owner = await account("SUPER_ADMIN");
  const body = await policyBody(enabled);
  const response = await request(app)
    .post("/api/v1/admin/policies")
    .set(owner.headers)
    .send(body);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return { id: response.body.data.id as string, body, owner };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Approved reservation terms",
  () => {
    afterAll(() => prisma.$disconnect());

    it("returns no applicable agreement after withdrawal and refuses a reservation without changing stock", async () => {
      await publish(false);
      const f = await fixture();
      const read = await f.read();
      expect(read.status).toBe(200);
      expect(read.headers["cache-control"]).toBe("private, no-store");
      expect(read.body.data).toEqual({
        current: null,
        accepted: null,
        legacyAcceptance: false,
      });
      expect((await f.reserve("invented-v1")).status).toBe(409);
      expect(
        await prisma.vehicleListing.findUnique({ where: { id: f.listing.id } }),
      ).toMatchObject({ status: "AVAILABLE", version: 0 });
      expect(
        await prisma.idempotencyRecord.count({ where: { userId: f.buyer.user.id } }),
      ).toBe(0);
    });

    it("serves exact plain text without private policy provenance and records immutable evidence", async () => {
      const p = await publish();
      const f = await fixture();
      const read = await f.read();
      expect(reservationTermsResponseSchema.safeParse(read.body.data).success).toBe(true);
      expect(read.body.data.current).toMatchObject({
        version: p.id,
        body: p.body.settings.body,
        title: p.body.settings.title,
      });
      expect(JSON.stringify(read.body.data)).not.toContain("approvalEvidence");
      expect(JSON.stringify(read.body.data)).not.toContain("approvedByUserId");
      expect((await f.reserve(p.id)).status).toBe(200);
      const accepted = (await f.read()).body.data.accepted;
      expect(accepted.document).toEqual(read.body.data.current);
      const record = await prisma.vehicleTransaction.findUniqueOrThrow({
        where: { id: f.sale.id },
      });
      expect(record).toMatchObject({
        reservationTermsPolicyId: p.id,
        reservationTermsAcceptedByUserId: f.buyer.user.id,
        termsVersion: p.id,
      });
      expect(accepted.acceptedAt).toBe(record.termsAcceptedAt!.toISOString());
      await expect(
        prisma.vehicleTransaction.update({
          where: { id: f.sale.id },
          data: { termsVersion: "rewritten" },
        }),
      ).rejects.toThrow("acceptance is immutable");
      for (const data of [
        { termsAcceptedAt: null },
        { reservationTermsPolicyId: null },
        { reservationTermsAcceptedByUserId: null },
        { customerId: randomUUID() },
        { vehicleListingId: randomUUID() },
      ]) {
        await expect(
          prisma.vehicleTransaction.update({ where: { id: f.sale.id }, data }),
        ).rejects.toThrow("acceptance is immutable");
      }
      await expect(
        prisma.businessPolicyVersion.update({
          where: { id: p.id },
          data: { settings: { enabled: false } },
        }),
      ).rejects.toThrow("append-only");
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: f.sale.id, action: "VEHICLE_RESERVED" },
      });
      expect(audit.newValues).toMatchObject({
        termsVersion: p.id,
        termsContentSha256: accepted.document.contentSha256,
      });
    });

    it("rejects forged, superseded and future versions and preserves historical replay after withdrawal", async () => {
      const old = await publish(),
        current = await publish();
      const f = await fixture();
      expect((await f.reserve(old.id)).status).toBe(409);
      expect((await f.reserve(randomUUID())).status).toBe(409);
      const future = {
        ...(await policyBody()),
        effectiveAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const response = await request(app)
        .post("/api/v1/admin/policies")
        .set(current.owner.headers)
        .send(future);
      expect(response.status).toBe(201);
      expect((await f.reserve(response.body.data.id)).status).toBe(409);
      const key = randomUUID();
      expect((await f.reserve(current.id, key)).status).toBe(200);
      await publish(false);
      const replay = await f.reserve(current.id, key);
      expect(replay.status).toBe(200);
      expect(replay.body.data.replayed).toBe(true);
      expect((await f.reserve(old.id, key)).status).toBe(409);
      const read = await f.read();
      expect(read.body.data.current).toBeNull();
      expect(read.body.data.accepted.document.version).toBe(current.id);
      expect(
        await prisma.vehicleTransactionStatusHistory.count({
          where: { vehicleTransactionId: f.sale.id, toStatus: "RESERVED" },
        }),
      ).toBe(1);
    });

    it("rejects missing acceptance and stale transaction versions without creating evidence", async () => {
      const p = await publish(),
        f = await fixture();
      const result = await request(app)
        .post(`/api/v1/customers/vehicle-transactions/${f.sale.id}/reserve`)
        .set(f.buyer.headers)
        .set("Idempotency-Key", randomUUID())
        .send({ expectedVersion: 0, termsVersion: p.id, termsAccepted: false });
      expect(result.status).toBe(422);
      expect((await f.reserve(p.id, randomUUID(), 99)).status).toBe(409);
      expect(
        await prisma.vehicleTransaction.findUnique({ where: { id: f.sale.id } }),
      ).toMatchObject({
        status: "NEGOTIATING",
        reservationTermsPolicyId: null,
        termsAcceptedAt: null,
      });
      expect(
        await prisma.vehicleListing.findUnique({ where: { id: f.listing.id } }),
      ).toMatchObject({ status: "AVAILABLE" });
    });

    it("denies anonymous and foreign purchase reads and reservations", async () => {
      const p = await publish(),
        f = await fixture(),
        stranger = await account();
      expect(
        (
          await request(app).get(
            `/api/v1/customers/vehicle-transactions/${f.sale.id}/reservation-terms`,
          )
        ).status,
      ).toBe(401);
      expect((await f.read(stranger.cookie)).status).toBe(404);
      const reserve = await request(app)
        .post(`/api/v1/customers/vehicle-transactions/${f.sale.id}/reserve`)
        .set(stranger.headers)
        .set("Idempotency-Key", randomUUID())
        .send({ expectedVersion: 0, termsVersion: p.id, termsAccepted: true });
      expect(reserve.status).toBe(404);
    });

    it.each(["CUSTOMER", "STAFF", "ADMIN"] as const)(
      "denies %s publication",
      async (role) => {
        const actor = await account(role);
        const response = await request(app)
          .post("/api/v1/admin/policies")
          .set(actor.headers)
          .send(await policyBody());
        expect(response.status).toBe(403);
      },
    );

    it("requires owner MFA, CSRF and an expected publication version", async () => {
      const owner = await account("SUPER_ADMIN", false);
      const body = await policyBody();
      expect(
        (await request(app).post("/api/v1/admin/policies").set(owner.headers).send(body))
          .status,
      ).toBe(403);
      const p = await publish();
      expect(
        (
          await request(app)
            .post("/api/v1/admin/policies")
            .set("Cookie", p.owner.cookie)
            .send(await policyBody())
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/policies")
            .set(p.owner.headers)
            .send(p.body)
        ).status,
      ).toBe(409);
    });

    it("cannot link a different customer's signature or bypass agreement validation with a direct database update", async () => {
      const p = await publish(),
        f = await fixture(),
        other = await account();
      const data = {
        status: "RESERVED" as const,
        termsAcceptedAt: new Date(),
        termsVersion: p.id,
        reservationTermsPolicyId: p.id,
        reservationTermsAcceptedByUserId: other.user.id,
      };
      await expect(
        prisma.vehicleTransaction.update({ where: { id: f.sale.id }, data }),
      ).rejects.toThrow("customer acceptance are required");
      await expect(
        prisma.vehicleTransaction.update({
          where: { id: f.sale.id },
          data: {
            status: "RESERVED",
            termsVersion: "invented",
            termsAcceptedAt: new Date(),
          },
        }),
      ).rejects.toThrow("customer acceptance are required");
    });

    it("keeps an unapproved draft unavailable", async () => {
      await publish(false);
      const latest = await prisma.businessPolicyVersion.findFirstOrThrow({
        where: { key: reservationTermsKey },
        orderBy: { version: "desc" },
      });
      const draft = await prisma.businessPolicyVersion.create({
        data: {
          key: reservationTermsKey,
          version: latest.version + 1,
          effectiveAt: new Date(),
          approvalStatus: "DRAFT",
          source: "Synthetic unapproved draft",
          sourceQuestion: "Q3",
          settings: { enabled: true, title: "Draft", body: "Never approved" },
        },
      });
      const f = await fixture();
      expect((await f.read()).body.data.current).toBeNull();
      expect((await f.reserve(draft.id)).status).toBe(409);
    });

    it("serializes withdrawal with a waiting reservation and commits no hold against withdrawn terms", async () => {
      const p = await publish(),
        f = await fixture();
      const locked = gate(),
        release = gate();
      const withdrawal = prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`policy:${reservationTermsKey}`}, 0))`;
          const latest = await tx.businessPolicyVersion.findFirstOrThrow({
            where: { key: reservationTermsKey },
            orderBy: { version: "desc" },
          });
          await tx.businessPolicyVersion.create({
            data: {
              key: reservationTermsKey,
              version: latest.version + 1,
              approvalStatus: "APPROVED",
              source: p.body.source,
              sourceQuestion: "Q3",
              approvedByUserId: p.owner.user.id,
              approvalEvidence: p.body.approvalEvidence,
              effectiveAt: new Date(),
              settings: { enabled: false, reason: "Concurrent withdrawal test" },
            },
          });
          locked.release();
          await release.promise;
        },
        { timeout: 15000 },
      );
      await locked.promise;
      const reservation = service
        .reserve(
          f.buyer.actor,
          f.sale.id,
          { expectedVersion: 0, termsVersion: p.id, termsAccepted: true },
          randomUUID(),
          context,
        )
        .then(
          () => null,
          (error: unknown) => error,
        );
      try {
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          const rows = await prisma.$queryRaw<
            Array<{ blocked: boolean }>
          >`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())) AS blocked`;
          if (rows[0]?.blocked) {
            blocked = true;
            break;
          }
          await delay(10);
        }
        expect(blocked).toBe(true);
      } finally {
        release.release();
        await withdrawal;
      }
      expect(await reservation).toMatchObject({ statusCode: 409 });
      expect(
        await prisma.vehicleListing.findUnique({ where: { id: f.listing.id } }),
      ).toMatchObject({ status: "AVAILABLE" });
    });
  },
);
