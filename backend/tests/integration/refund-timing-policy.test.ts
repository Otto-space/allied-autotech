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
import { snapshotRefundClock } from "../../src/modules/policies/refund-clock.js";
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
  "Approved bank refund timing",
  () => {
    afterAll(() => prisma.$disconnect());
    it("requires an assured owner and binds a manual refund to the approved calendar at request time", async () => {
      const app = createApp({ checkReadiness: async () => undefined });
      const owner = await account("SUPER_ADMIN");
      const identity = await session(owner.id, owner.role);
      const latest = await prisma.businessPolicyVersion.findFirst({
        where: { key: "bank_refund_clock" },
        orderBy: { version: "desc" },
      });
      const now = new Date();
      const settings = {
        startEvent: "APPROVED",
        businessDays: 10,
        countingConvention: "EXCLUDE_START_SAME_LOCAL_TIME",
        bankingDays: [1, 2, 3, 4, 5],
        holidays: ["2030-10-01"],
        timezone: "Africa/Lagos",
      };
      const body = {
        kind: "BANK_REFUND_CLOCK",
        expectedVersion: latest?.version ?? 0,
        effectiveAt: now.toISOString(),
        source: "Synthetic banking calendar approval",
        approvalEvidence: "Synthetic signed banking calendar TEST-CLOCK.",
        settings,
      };
      const publish = (auth: typeof identity, data: unknown = body, csrf = auth.csrf) =>
        request(app)
          .post("/api/v1/admin/policies")
          .set("Cookie", auth.cookie)
          .set("Origin", "http://localhost:3000")
          .set("X-CSRF-Token", csrf)
          .send(data);
      for (const role of ["CUSTOMER", "STAFF", "ADMIN"] as const) {
        const user = await account(role),
          auth = await session(user.id, role);
        expect((await publish(auth)).status).toBe(403);
        expect(
          (
            await request(app)
              .get("/api/v1/admin/policies?key=bank_refund_clock")
              .set("Cookie", auth.cookie)
          ).status,
        ).toBe(403);
      }
      expect((await publish(await session(owner.id, owner.role, false))).status).toBe(
        403,
      );
      expect((await publish(identity, body, "invalid-token")).status).toBe(403);
      for (const invalid of [
        { bankingDays: [] },
        { holidays: ["2030-02-30"] },
        { businessDays: 9 },
        { startEvent: "PAID" },
        { timezone: "UTC" },
      ]) {
        expect(
          (await publish(identity, { ...body, settings: { ...settings, ...invalid } }))
            .status,
        ).toBe(422);
      }
      const competing = await Promise.all([publish(identity), publish(identity)]);
      expect(competing.map((response) => response.status).sort()).toEqual([201, 409]);
      const published = competing.find((response) => response.status === 201)!.body.data;
      expect(published).toMatchObject({
        key: "bank_refund_clock",
        version: body.expectedVersion + 1,
        approvalStatus: "APPROVED",
        settings,
      });
      expect(
        (
          await request(app)
            .get("/api/v1/admin/policies?key=bank_refund_clock&limit=100")
            .set("Cookie", identity.cookie)
        ).body.data,
      ).toEqual(expect.arrayContaining([expect.objectContaining({ id: published.id })]));
      expect(
        await prisma.auditLog.count({
          where: {
            userId: owner.id,
            action: "CREATE",
            newValues: { path: ["policyVersionId"], equals: published.id },
          },
        }),
      ).toBe(1);

      const customer = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable",
          profile: {
            create: {
              firstName: "Synthetic",
              lastName: "Refund",
              phone: "+2348000000000",
            },
          },
        },
        include: { profile: true },
      });
      const branch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Synthetic bank clock",
          address: "Test",
          city: "Test",
          state: "Test",
        },
      });
      const order = await prisma.order.create({
        data: {
          branchId: branch.id,
          customerId: customer.profile!.id,
          orderNumber: randomUUID(),
          customerName: "Synthetic Refund",
          customerEmail: customer.email,
          customerPhone: "+2348000000000",
          subtotalKobo: 10000n,
          totalKobo: 10000n,
        },
      });
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          customerId: customer.profile!.id,
          paymentNumber: randomUUID(),
          purpose: "ORDER_PAYMENT",
          amountKobo: 10000n,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
        },
      });
      const attempt = await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
          internalReference: randomUUID(),
          provider: "MANUAL",
          amountKobo: 10000n,
          status: "SUCCESSFUL",
          verificationStatus: "VERIFIED",
          verifiedAmountKobo: 10000n,
          verifiedCurrency: "NGN",
          verifiedAt: now,
          paidAt: now,
        },
      });
      // Fixed synthetic Friday and holiday are independent of the machine's calendar.
      const anchor = new Date("2030-09-27T09:00:00Z");
      const refund = await prisma.refund.create({
        data: {
          paymentAttemptId: attempt.id,
          requestedByUserId: customer.id,
          refundNumber: randomUUID(),
          amountKobo: 10000n,
          reason: "Synthetic bank clock verification",
          requestedAt: anchor,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
        },
      });
      await prisma.$transaction((tx) => snapshotRefundClock(tx, refund.id));
      expect(
        (await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).dueAt,
      ).toBeNull();
      await prisma.refund.update({
        where: { id: refund.id },
        data: { approvedAt: anchor, approvedByUserId: owner.id, status: "APPROVED" },
      });
      // A future version must not apply to this earlier request even after its selected anchor occurs.
      const future = await publish(identity, {
        ...body,
        expectedVersion: published.version,
        effectiveAt: "2031-01-01T00:00:00Z",
        settings: { ...settings, startEvent: "TRANSFER_RECORDED", bankingDays: [0] },
      });
      expect(future.status).toBe(201);
      await prisma.$transaction((tx) => snapshotRefundClock(tx, refund.id));
      const saved = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
      expect(saved.dueAt?.toISOString()).toBe("2030-10-14T09:00:00.000Z");
      expect(saved.clockPolicySnapshot).toMatchObject({ id: published.id, settings });
      expect(saved.clockStatus).toBe("APPROVED_CLOCK_SNAPSHOTTED");
      expect(saved.status).toBe("APPROVED");
      // Subsequent publication and re-evaluation cannot move an already saved deadline.
      const next = await publish(identity, {
        ...body,
        expectedVersion: future.body.data.version,
        effectiveAt: new Date().toISOString(),
        settings: { ...settings, startEvent: "REQUESTED", bankingDays: [0] },
      });
      expect(next.status).toBe(201);
      await prisma.$transaction((tx) => snapshotRefundClock(tx, refund.id));
      expect(
        await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } }),
      ).toMatchObject({
        dueAt: saved.dueAt,
        clockPolicySnapshot: saved.clockPolicySnapshot,
      });
      expect(
        await prisma.paymentLedgerEntry.count({ where: { refundId: refund.id } }),
      ).toBe(0);
    }, 30000);
  },
);
