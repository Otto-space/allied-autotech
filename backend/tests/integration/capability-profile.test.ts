import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { assertCapability } from "../../src/modules/policies/policies.service.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import { testOwner } from "../helpers/owner.js";

async function account(role: UserRole) {
  if (role === "SUPER_ADMIN") return testOwner("unusable-test-only");
  return prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-test-only",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {}
        : {
            staffProfile: { create: { firstName: "Synthetic", lastName: "Permissions" } },
          }),
    },
  });
}
async function session(userId: string, role: UserRole, assured = true) {
  const token = generateOpaqueToken();
  const csrf = generateOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3_600_000);
  const record = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt,
      idleExpiresAt: expiresAt,
      createdAt: now,
      lastRotatedAt: now,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: assured && role !== "CUSTOMER" ? now : null,
    },
  });
  return { cookie: `${sessionCookieName}=${token}`, csrf, record };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Own operational permissions",
  () => {
    afterAll(() => prisma.$disconnect());
    const app = createApp({ checkReadiness: async () => undefined });
    it("allows delegated finance review and approval only while the narrow grant is active", async () => {
      const owner = await account("SUPER_ADMIN");
      const ownerSession = await session(owner.id, owner.role);
      const staff = await account("STAFF");
      const staffSession = await session(staff.id, staff.role);
      const admin = await account("ADMIN");
      const adminSession = await session(admin.id, admin.role);
      const customer = await account("CUSTOMER");
      const customerSession = await session(customer.id, customer.role);
      const unassured = await session(staff.id, staff.role, false);
      const read = (identity: typeof staffSession, path = "/staff/finance-policy") =>
        request(app).get(`/api/v1${path}`).set("Cookie", identity.cookie);
      expect((await read(staffSession)).status).toBe(403);
      expect((await read(adminSession)).status).toBe(403);
      expect((await read(customerSession)).status).toBe(403);
      expect((await read(unassured)).status).toBe(403);
      expect((await read(ownerSession)).status).toBe(200);
      const grant = await prisma.userCapability.create({
        data: {
          userId: staff.id,
          grantedByUserId: owner.id,
          capability: "FINANCE_POLICY_APPROVE",
        },
      });
      const history = await read(staffSession);
      expect(history.status).toBe(200);
      expect(
        history.body.data.every((row: { key: string }) => row.key === "finance"),
      ).toBe(true);
      expect((await read(staffSession, "/admin/policies?key=finance")).status).toBe(403);
      const latest = await prisma.businessPolicyVersion.findFirst({
        where: { key: "finance" },
        orderBy: { version: "desc" },
      });
      const body = {
        kind: "FINANCE",
        expectedVersion: latest?.version ?? 0,
        effectiveAt: new Date().toISOString(),
        source: "Synthetic accounting approval in disposable database",
        approvalEvidence: "Synthetic written accounting approval TEST-FINANCE.",
        settings: {
          vatBasisPoints: 750,
          pricesIncludeVat: false,
          rounding: "HALF_UP_MINOR_UNIT",
          discountTreatment: "BEFORE_VAT",
          deliveryTaxable: false,
          invoiceName: "Synthetic test company",
          invoiceAddress: "Synthetic test address only",
          paymentTerms: "Synthetic payment terms for testing only",
          applicability: "ALL_PRODUCTS_AND_SERVICES",
        },
      };
      const post = (identity: typeof staffSession, payload = body) =>
        request(app)
          .post("/api/v1/admin/policies")
          .set("Cookie", identity.cookie)
          .set("Origin", "http://localhost:3000")
          .set("X-CSRF-Token", identity.csrf)
          .send(payload);
      expect((await post(adminSession)).status).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/policies")
            .set("Cookie", staffSession.cookie)
            .set("Origin", "http://localhost:3000")
            .send(body)
        ).status,
      ).toBe(403);
      const results = await Promise.all([post(staffSession), post(staffSession)]);
      expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
      const saved = (await read(staffSession)).body.data[0];
      expect(saved).toMatchObject({
        key: "finance",
        version: body.expectedVersion + 1,
        approvalStatus: "APPROVED",
        settings: body.settings,
        approvedByUserId: staff.id,
      });
      await prisma.userCapability.update({
        where: { id: grant.id },
        data: { revokedAt: new Date() },
      });
      expect((await read(staffSession)).status).toBe(403);
      expect(
        (await post(staffSession, { ...body, expectedVersion: saved.version })).status,
      ).toBe(403);
    });
    it("publishes reviewed branch capacity only for the owner and rejects stale concurrent approvals", async () => {
      const owner = await account("SUPER_ADMIN");
      const ownerSession = await session(owner.id, owner.role);
      const admin = await account("ADMIN");
      const adminSession = await session(admin.id, admin.role);
      const branch = await prisma.branch.create({
        data: {
          code: `POL-${randomUUID().slice(0, 8)}`,
          name: "Synthetic policy branch",
          address: "Test only",
          city: "Port Harcourt",
          state: "Rivers",
        },
      });
      const body = {
        kind: "BRANCH_CAPACITY",
        branchId: branch.id,
        expectedVersion: 0,
        effectiveAt: new Date().toISOString(),
        source: "Synthetic owner approval in an isolated database",
        approvalEvidence:
          "Synthetic signed approval reference for integration testing only.",
        settings: {
          dailyLimit: 4,
          openingDays: [1, 2, 3, 4, 5],
          opensAt: "08:00",
          closesAt: "18:00",
          holidays: [],
          timezone: "Africa/Lagos",
        },
      };
      const post = (identity: typeof ownerSession) =>
        request(app)
          .post("/api/v1/admin/policies")
          .set("Cookie", identity.cookie)
          .set("Origin", "http://localhost:3000")
          .set("X-CSRF-Token", identity.csrf)
          .send(body);
      expect((await post(adminSession)).status).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/v1/admin/policies")
            .set("Cookie", ownerSession.cookie)
            .set("Origin", "http://localhost:3000")
            .send(body)
        ).status,
      ).toBe(403);
      const results = await Promise.all([post(ownerSession), post(ownerSession)]);
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      const history = await request(app)
        .get(`/api/v1/admin/policies?key=booking-capacity:${branch.id}&limit=100`)
        .set("Cookie", ownerSession.cookie);
      expect(history.status).toBe(200);
      expect(history.body.data).toHaveLength(1);
      expect(history.body.data[0]).toMatchObject({
        key: `booking-capacity:${branch.id}`,
        version: 1,
        approvalStatus: "APPROVED",
        source: body.source,
        approvalEvidence: body.approvalEvidence,
        settings: body.settings,
      });
      expect(
        (
          await request(app)
            .get(`/api/v1/admin/policies?key=booking-capacity:${branch.id}`)
            .set("Cookie", adminSession.cookie)
        ).status,
      ).toBe(403);
    });
    it("returns only the caller's active grants and removes authority immediately after audited revocation", async () => {
      const owner = await account("SUPER_ADMIN");
      const staff = await account("STAFF");
      const other = await account("ADMIN");
      const ownerSession = await session(owner.id, owner.role);
      const staffSession = await session(staff.id, staff.role);
      const actor = {
        userId: staff.id,
        email: staff.email,
        role: staff.role,
        sessionId: staffSession.record.id,
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const grantResponse = await request(app)
        .post("/api/v1/admin/capabilities")
        .set("Cookie", ownerSession.cookie)
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", ownerSession.csrf)
        .send({ userId: staff.id, capability: "BOOKING_CONFIRM" });
      expect(grantResponse.status).toBe(201);
      const grantId: string = grantResponse.body.data.id;
      await prisma.userCapability.update({
        where: { id: grantId },
        data: { grantedAt: new Date("2020-01-01") },
      });
      await prisma.userCapability.createMany({
        data: [
          {
            userId: other.id,
            capability: "FINANCE_POLICY_APPROVE",
            grantedByUserId: owner.id,
          },
          ...Array.from({ length: 105 }, () => ({
            userId: staff.id,
            capability: "REFUND_CHECK",
            grantedByUserId: owner.id,
            revokedAt: new Date(),
          })),
        ],
      });
      const profile = await request(app)
        .get("/api/v1/staff/profile")
        .set("Cookie", staffSession.cookie);
      expect(profile.status).toBe(200);
      expect(profile.body.data.capabilities).toEqual(["BOOKING_CONFIRM"]);
      expect(profile.body.data.id).toBe(staff.id);
      expect(profile.body.data).not.toHaveProperty("passwordHash");
      expect(profile.body.data).not.toHaveProperty("grantedByUserId");
      await expect(
        prisma.$transaction((tx) => assertCapability(tx, actor, "BOOKING_CONFIRM")),
      ).resolves.toBeUndefined();
      const history = await request(app)
        .get(`/api/v1/admin/capabilities?userId=${staff.id}`)
        .set("Cookie", ownerSession.cookie);
      expect(history.status).toBe(200);
      expect(history.body.data).toHaveLength(100);
      expect(history.body.data.some((row: { id: string }) => row.id === grantId)).toBe(
        false,
      );
      const active = await request(app)
        .get(`/api/v1/admin/capabilities?userId=${staff.id}&activeOnly=true`)
        .set("Cookie", ownerSession.cookie);
      expect(active.status).toBe(200);
      expect(active.body.data.map((row: { id: string }) => row.id)).toEqual([grantId]);
      const revoke = await request(app)
        .post(`/api/v1/admin/capabilities/${grantId}/revoke`)
        .set("Cookie", ownerSession.cookie)
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", ownerSession.csrf)
        .send({ reason: "The assigned booking duty has ended." });
      expect(revoke.status).toBe(200);
      const after = await request(app)
        .get("/api/v1/staff/profile")
        .set("Cookie", staffSession.cookie);
      expect(after.status).toBe(200);
      expect(after.body.data.capabilities).toEqual([]);
      await expect(
        prisma.$transaction((tx) => assertCapability(tx, actor, "BOOKING_CONFIRM")),
      ).rejects.toMatchObject({ statusCode: 403 });
      const audit = await prisma.auditLog.findFirst({
        where: { userId: owner.id, entityId: staff.id, action: "UPDATE" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit?.newValues).toMatchObject({
        revokedCapabilityGrantId: grantId,
        reason: "The assigned booking duty has ended.",
      });
    });
    it("requires privileged MFA for own grants and reserves other accounts' grants and mutations for the owner", async () => {
      for (const role of ["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const) {
        const user = await account(role);
        const assured = await session(user.id, role);
        const own = await request(app)
          .get("/api/v1/staff/profile")
          .set("Cookie", assured.cookie);
        expect(own.status).toBe(role === "CUSTOMER" ? 403 : 200);
        const list = await request(app)
          .get(`/api/v1/admin/capabilities?userId=${user.id}&activeOnly=true`)
          .set("Cookie", assured.cookie);
        expect(list.status).toBe(role === "SUPER_ADMIN" ? 200 : 403);
        if (role !== "SUPER_ADMIN") {
          const denied = await request(app)
            .post("/api/v1/admin/capabilities")
            .set("Cookie", assured.cookie)
            .set("Origin", "http://localhost:3000")
            .set("X-CSRF-Token", assured.csrf)
            .send({ userId: user.id, capability: "BOOKING_CONFIRM" });
          expect(denied.status).toBe(403);
        }
        if (role !== "CUSTOMER") {
          const unassured = await session(user.id, role, false);
          const denied = await request(app)
            .get("/api/v1/staff/profile")
            .set("Cookie", unassured.cookie);
          expect(denied.status).toBe(403);
          expect(denied.body.error.code).toBe("MFA_REQUIRED");
        }
      }
    });
  },
);
