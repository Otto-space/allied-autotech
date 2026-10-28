import { randomUUID, createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { ManualRefundsService } from "../../src/modules/payments/manual-refunds.service.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { workforceOwnResponseSchema } from "../../src/modules/organization/workforce.schemas.js";
import { resolveNotificationTargets } from "../../src/modules/notifications/notification-targets.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "independent grants survive workforce enrollment without broad legacy access",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());
    const read = (who: { headers: Record<string, string> }, path: string) =>
      request(app).get(`/api/v1${path}`).set(who.headers);
    const grant = (userId: string, capability: string) =>
      prisma.userCapability.create({
        data: { userId, capability, grantedByUserId: f.owner.id },
      });
    it("reproduces a permitted stage-scoped refund service hidden by the managed HTTP boundary", async () => {
      const person = await f.account("ACCOUNTANT");
      await grant(person.user.id, "REFUND_APPROVE");
      const actor: AuthenticatedActor = {
        userId: person.user.id,
        role: "STAFF",
        email: person.user.email,
        sessionId: person.record.id,
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const service = new ManualRefundsService();
      const scoped = await prisma.$transaction((tx) => service.scope(tx, actor));
      expect(scoped).toEqual({
        OR: [{ OR: [{ status: "REQUESTED" }, { approvedByUserId: person.user.id }] }],
      });
      expect((await read(person, "/staff/refunds")).status).toBe(200);
      expect((await read(person, "/staff/bookings")).status).toBe(403);
      expect((await read(person, "/admin/operations/payment-refunds")).status).toBe(403);
    });
    it("projects only active recognised independent grants and invalidates the same session after revocation", async () => {
      const person = await f.account("ACCOUNTANT");
      const allowed = await grant(person.user.id, "REFUND_CHECK");
      await grant(person.user.id, "UNKNOWN_FUTURE_GRANT");
      const revoked = await grant(person.user.id, "DISPUTE_MANAGE");
      await prisma.userCapability.update({
        where: { id: revoked.id },
        data: { revokedAt: new Date() },
      });
      const before = await read(person, "/staff/workforce/access");
      expect(before.status).toBe(200);
      expect(workforceOwnResponseSchema.safeParse(before.body.data).success).toBe(true);
      expect(before.body.data.independentCapabilities).toEqual(["REFUND_CHECK"]);
      expect(before.body.data.permissions).toEqual(["FINANCE_READ"]);
      expect((await read(person, "/staff/refunds")).status).toBe(200);
      expect((await read(person, "/staff/disputes")).status).toBe(403);
      expect((await read(person, "/learning/articles/refund-work")).status).toBe(200);
      await prisma.userCapability.update({
        where: { id: allowed.id },
        data: { revokedAt: new Date() },
      });
      const after = await read(person, "/staff/workforce/access");
      expect(after.body.data.independentCapabilities).toEqual([]);
      expect(after.body.data.accessRevision).not.toBe(before.body.data.accessRevision);
      expect(after.body.data.permissions).toEqual(["FINANCE_READ"]);
      expect((await read(person, "/staff/refunds")).status).toBe(403);
      expect((await read(person, "/learning/articles/refund-work")).status).toBe(404);
    });
    it.each([
      ["DISPUTE_MANAGE", "/staff/disputes"],
      ["FINANCE_POLICY_APPROVE", "/staff/finance-policy/current"],
      ["PRIVACY_REVIEW", "/staff/privacy-requests"],
    ])(
      "retains the existing %s workflow without granting other modules",
      async (capability, path) => {
        const person = await f.account("MECHANICAL_TECHNICIAN");
        expect((await read(person, path)).status).toBe(403);
        await grant(person.user.id, capability);
        expect((await read(person, path)).status).toBe(200);
        expect((await read(person, "/staff/payments")).status).toBe(403);
        expect((await read(person, "/staff/customers")).status).toBe(403);
        expect(
          (await read(person, "/admin/capabilities?userId=" + person.user.id)).status,
        ).toBe(403);
        const pending = await f.session(person.user.id, "STAFF", false);
        expect((await read(pending, path)).status).toBe(403);
      },
    );
    it("does not restore the enrolled Admin's broad refund-inspection baseline", async () => {
      const person = await f.account("ACCOUNTANT", "ADMIN");
      await grant(person.user.id, "REFUND_APPROVE");
      const actor: AuthenticatedActor = {
        userId: person.user.id,
        role: "ADMIN",
        email: person.user.email,
        sessionId: person.record.id,
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const service = new ManualRefundsService();
      expect(
        await prisma.$transaction((tx) => service.scope(tx, actor, true)),
      ).not.toEqual({});
      expect((await read(person, "/staff/refunds")).status).toBe(200);
    });
    it("retains the existing owner and unenrolled Admin inspection baseline", async () => {
      const legacy = await f.account(null, "ADMIN");
      const service = new ManualRefundsService();
      for (const who of [
        { user: legacy.user, record: legacy.record },
        {
          user: f.owner,
          record: (await f.session(f.owner.id, "SUPER_ADMIN")).record,
        },
      ]) {
        const actor: AuthenticatedActor = {
          userId: who.user.id,
          role: who.user.role,
          email: who.user.email,
          sessionId: who.record.id,
          mfaRequired: true,
          mfaVerifiedAt: new Date(),
        };
        expect(await prisma.$transaction((tx) => service.scope(tx, actor, true))).toEqual(
          {},
        );
      }
    });
    it("shows independent grants only to the owner management view and preserves personal scope separation", async () => {
      const person = await f.account("CUSTOMER_SERVICE");
      await grant(person.user.id, "PRIVACY_REVIEW");
      await grant(person.user.id, "BOOKING_CONFIRM");
      const owner = await f.session(f.owner.id, "SUPER_ADMIN");
      const ownerView = await read(owner, `/admin/workforce/accounts/${person.user.id}`);
      expect(ownerView.status).toBe(200);
      expect(ownerView.body.data.effectiveAccess.independentCapabilities).toEqual([
        "BOOKING_CONFIRM",
        "PRIVACY_REVIEW",
      ]);
      const delegated = await read(
        f.scopedAdmin,
        `/admin/workforce/accounts/${person.user.id}`,
      );
      expect(delegated.status).toBe(200);
      expect(delegated.body.data.effectiveAccess).not.toHaveProperty(
        "independentCapabilities",
      );
      expect(JSON.stringify(delegated.body.data)).not.toContain("PRIVACY_REVIEW");
      expect((await read(person, "/staff/bookings")).status).toBe(403);
      expect((await read(person, "/staff/workforce/bookings")).status).toBe(200);
    });
    it("still checks record ownership, CSRF and independent refund actions beyond the boundary", async () => {
      const person = await f.account("MECHANICAL_TECHNICIAN");
      await grant(person.user.id, "DISPUTE_MANAGE");
      const payment = await prisma.payment.create({
        data: {
          paymentNumber: `WF-${randomUUID()}`,
          purpose: "BOOKING_DEPOSIT",
          bookingId: f.job2.id,
          customerId: f.customer.user.profile!.id,
          amountKobo: 10000n,
          idempotencyKeyHash: createHash("sha256").update(randomUUID()).digest("hex"),
          attempts: {
            create: {
              attemptNumber: 1,
              internalReference: `WF-${randomUUID()}`,
              provider: "PAYSTACK",
              amountKobo: 10000n,
              status: "SUCCESSFUL",
              verificationStatus: "VERIFIED",
              verifiedAmountKobo: 10000n,
              verifiedCurrency: "NGN",
              verifiedAt: new Date(),
              paidAt: new Date(),
              providerReference: `SYNTHETIC-${randomUUID()}`,
              gatewayTransactionId: `SYNTHETIC-${randomUUID()}`,
            },
          },
        },
        include: { attempts: true },
      });
      const dispute = await prisma.paymentDispute.create({
        data: {
          paymentAttemptId: payment.attempts[0]!.id,
          provider: "PAYSTACK",
          providerDisputeId: `WF-${randomUUID()}`,
          status: "AWAITING_RESPONSE",
          category: "OTHER",
          amountKobo: 10000n,
          currency: "NGN",
          openedAt: new Date(),
          primaryUserId: f.owner.id,
          backupUserId: f.operations.user.id,
        },
      });
      const list = await read(person, "/staff/disputes");
      expect(list.status).toBe(200);
      expect(list.body.data.items.some((r: { id: string }) => r.id === dispute.id)).toBe(
        false,
      );
      expect((await read(person, `/staff/disputes/${dispute.id}`)).status).toBe(403);
      expect(
        (
          await request(app)
            .post(`/api/v1/staff/disputes/${dispute.id}/acknowledge`)
            .set({ Cookie: person.headers.Cookie!, Origin: person.headers.Origin! })
            .send({})
        ).status,
      ).toBe(403);
      await prisma.paymentDispute.update({
        where: { id: dispute.id },
        data: { primaryUserId: person.user.id },
      });
      expect((await read(person, `/staff/disputes/${dispute.id}`)).status).toBe(200);
      const actor: AuthenticatedActor = {
        userId: person.user.id,
        role: "STAFF",
        email: person.user.email,
        sessionId: person.record.id,
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const reference = {
        id: randomUUID(),
        resourceType: "DISPUTE",
        resourceId: dispute.id,
        supportMessageId: null,
      };
      const permittedTarget = await prisma.$transaction((tx) =>
        resolveNotificationTargets(tx, actor, [reference]),
      );
      expect(permittedTarget.get(reference.id)?.href).toBe(
        `/admin/payment-disputes/work?selected=${dispute.id}`,
      );
      await prisma.userCapability.updateMany({
        where: { userId: person.user.id, capability: "DISPUTE_MANAGE" },
        data: { revokedAt: new Date() },
      });
      expect(
        (
          await prisma.$transaction((tx) =>
            resolveNotificationTargets(tx, actor, [reference]),
          )
        ).size,
      ).toBe(0);
      expect((await read(person, `/staff/disputes/${dispute.id}`)).status).toBe(403);
      await grant(person.user.id, "REFUND_CHECK");
      const refund = await prisma.refund.create({
        data: {
          refundNumber: `WF-${randomUUID()}`,
          paymentAttemptId: payment.attempts[0]!.id,
          requestedByUserId: person.user.id,
          amountKobo: 10000n,
          reason: "Synthetic independence check",
          idempotencyKeyHash: createHash("sha256").update(randomUUID()).digest("hex"),
        },
      });
      const ownCheck = await request(app)
        .post(`/api/v1/staff/refunds/${refund.id}/check`)
        .set(person.headers)
        .send({
          accepted: true,
          evidenceChecked: true,
          note: "Synthetic independent review must be denied",
        });
      expect(ownCheck.status).toBe(409);
      expect(ownCheck.body.message ?? ownCheck.body.error?.message).toContain(
        "independent checker",
      );
      expect(
        (await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status,
      ).toBe("REQUESTED");
      expect(
        (
          await request(app)
            .post(`/api/v1/staff/refunds/${randomUUID()}/transfer`)
            .set(person.headers)
            .send({})
        ).status,
      ).toBe(403);
    });
  },
);
