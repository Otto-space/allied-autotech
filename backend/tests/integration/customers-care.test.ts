import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture, fixturePassword } from "../fixtures/workforce.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Customers and Customer Care contracts",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>,
      admin: Awaited<ReturnType<Awaited<ReturnType<typeof workforceFixture>>["account"]>>,
      owner: Awaited<ReturnType<Awaited<ReturnType<typeof workforceFixture>>["session"]>>;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      f = await workforceFixture();
      admin = await f.account(null, "ADMIN");
      owner = await f.session(f.owner.id, "SUPER_ADMIN");
    }, 60000);
    afterAll(async () => prisma.$disconnect());
    const change = (
      id: string,
      headers: Record<string, string>,
      expectedStatus = "ACTIVE",
      status = "SUSPENDED",
      reason = "Synthetic reviewed account restriction",
    ) =>
      request(app)
        .post(`/api/v1/admin/customers/${id}/account-status`)
        .set(headers)
        .send({ expectedStatus, status, reason });
    it("requires administrator, assurance, CSRF, bounded reason and current customer role", async () => {
      const id = f.customer.user.profile!.id;
      for (const account of [f.customer, f.care, f.operations])
        expect((await change(id, account.headers)).status).toBe(403);
      const noCsrf = { ...admin.headers };
      delete noCsrf["X-CSRF-Token"];
      expect((await change(id, noCsrf)).status).toBe(403);
      expect(
        (await change(id, admin.headers, "ACTIVE", "SUSPENDED", "short")).status,
      ).toBe(422);
      const pending = await f.session(admin.user.id, "ADMIN", false);
      expect((await change(id, pending.headers)).status).toBe(403);
      const promoted = await f.account(null, "CUSTOMER");
      await prisma.user.update({
        where: { id: promoted.user.id },
        data: { role: "STAFF" },
      });
      expect((await change(promoted.user.profile!.id, admin.headers)).status).toBe(404);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: promoted.user.id } })).status,
      ).toBe("ACTIVE");
    });
    it.each(["ADMIN", "SUPER_ADMIN"] as const)(
      "%s suspends with audit, ends sessions and tokens, and reactivates without reviving sessions",
      async (role) => {
        const target = await f.account(null, "CUSTOMER"),
          id = target.user.profile!.id,
          headers = role === "ADMIN" ? admin.headers : owner.headers;
        const now = new Date(Date.now() + 3600000);
        await prisma.passwordResetToken.create({
          data: { userId: target.user.id, tokenHash: randomUUID(), expiresAt: now },
        });
        await prisma.emailVerificationToken.create({
          data: { userId: target.user.id, tokenHash: randomUUID(), expiresAt: now },
        });
        const result = await change(id, headers);
        expect(result.status).toBe(200);
        expect(result.body.data).toMatchObject({
          customerId: id,
          status: "SUSPENDED",
          revokedSessions: 1,
        });
        expect(
          (await request(app).get("/api/v1/auth/session").set(target.headers)).body.error
            .code,
        ).toBe("ACCOUNT_SUSPENDED");
        const login = await request(app)
          .post("/api/v1/auth/login")
          .set("Origin", "http://localhost:3000")
          .send({ email: target.user.email, password: fixturePassword });
        expect(login.status).toBe(401);
        expect(login.body.error.code).toBe("ACCOUNT_SUSPENDED");
        expect(
          await prisma.passwordResetToken.count({
            where: { userId: target.user.id, revokedAt: null },
          }),
        ).toBe(0);
        expect(
          await prisma.emailVerificationToken.count({
            where: { userId: target.user.id, revokedAt: null },
          }),
        ).toBe(0);
        const audit = await prisma.auditLog.findFirstOrThrow({
          where: { entityId: id, action: "UPDATE" },
        });
        expect(audit.userId).toBe(role === "ADMIN" ? admin.user.id : f.owner.id);
        expect(audit.oldValues).toEqual({ status: "ACTIVE" });
        expect(audit.newValues).toMatchObject({
          status: "SUSPENDED",
          targetUserId: target.user.id,
          reason: "Synthetic reviewed account restriction",
          revokedSessions: 1,
        });
        expect((await change(id, headers)).status).toBe(409);
        expect(
          (
            await change(
              id,
              headers,
              "SUSPENDED",
              "ACTIVE",
              "Synthetic reviewed account reactivation",
            )
          ).status,
        ).toBe(200);
        expect(
          (await request(app).get("/api/v1/auth/session").set(target.headers)).status,
        ).toBe(401);
        expect(
          (
            await request(app)
              .post("/api/v1/auth/login")
              .set("Origin", "http://localhost:3000")
              .send({ email: target.user.email, password: fixturePassword })
          ).status,
        ).toBe(200);
        expect(await prisma.customerProfile.count({ where: { id } })).toBe(1);
      },
    );
    it("serializes two reviewed transitions and rejects a deactivated target", async () => {
      const target = await f.account(null, "CUSTOMER"),
        id = target.user.profile!.id;
      const results = await Promise.all([
        change(id, admin.headers),
        change(id, owner.headers),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await prisma.auditLog.count({ where: { entityId: id, action: "UPDATE" } }),
      ).toBe(1);
      await prisma.user.update({
        where: { id: target.user.id },
        data: { status: "DEACTIVATED" },
      });
      expect((await change(id, admin.headers, "SUSPENDED", "ACTIVE")).status).toBe(409);
    });
    it("cannot issue a surviving session when sign-in races suspension", async () => {
      const target = await f.account(null, "CUSTOMER");
      const [suspended] = await Promise.all([
        change(target.user.profile!.id, admin.headers),
        request(app)
          .post("/api/v1/auth/login")
          .set("Origin", "http://localhost:3000")
          .send({ email: target.user.email, password: fixturePassword }),
      ]);
      expect(suspended.status).toBe(200);
      expect(
        await prisma.session.count({
          where: { userId: target.user.id, revokedAt: null },
        }),
      ).toBe(0);
    });
    it("exposes current contact to scoped Customer Care without widening sales fields, and dismisses complaint notices", async () => {
      const care = await request(app)
        .get(`/api/v1/staff/workforce/enquiries/${f.generalEnquiry.id}`)
        .set(f.care.headers);
      expect(care.status).toBe(200);
      expect(care.body.data.contact).toMatchObject({
        email: f.customer.user.email,
        customerId: f.customer.user.profile!.id,
      });
      const sales = await request(app)
        .get(`/api/v1/staff/workforce/enquiries/${f.enquiry.id}`)
        .set(f.sales.headers);
      expect(sales.status).toBe(200);
      expect(sales.body.data).not.toHaveProperty("contact");
      expect(sales.body.data).not.toHaveProperty("customer");
      const complaint = await prisma.complaint.create({
        data: {
          branchId: f.home.id,
          customerId: f.customer.user.profile!.id,
          subject: "Synthetic care issue",
          description: "Synthetic request for help",
          name: "Synthetic",
          email: f.customer.user.email,
        },
      });
      const row = await delivery(complaint.id);
      const detail = await request(app)
        .get(`/api/v1/staff/workforce/complaints/${complaint.id}`)
        .set(f.care.headers);
      expect(detail.status).toBe(200);
      expect(detail.body.data.contact.email).toBe(f.customer.user.email);
      const item = detail.body.data.emailDeliveries.items.find(
        (i: { id: string }) => i.id === row.id,
      );
      const result = await request(app)
        .post(
          `/api/v1/staff/workforce/complaints/${complaint.id}/email-deliveries/dismiss`,
        )
        .set(f.care.headers)
        .send({ notices: [{ id: row.id, revision: item.noticeRevision }] });
      expect(result.status).toBe(200);
      expect(result.body.data.items[0].noticeDismissed).toBe(true);
    });
    async function delivery(id: string) {
      return prisma.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "SupportCustomerEmail",
          aggregateId: id,
          eventType: "support.customer-email.requested",
          payload: {},
          status: "DEAD_LETTER",
          lastError: "RETRY_EXHAUSTED",
          attempts: 3,
        },
      });
    }
    const read = (id: string, headers = admin.headers) =>
      request(app)
        .get(`/api/v1/staff/support/enquiries/${id}/email-deliveries`)
        .set(headers);
    const dismiss = (
      id: string,
      notices: unknown,
      headers = admin.headers,
      managed = false,
    ) =>
      request(app)
        .post(
          `/api/v1/staff/${managed ? "workforce" : "support"}/enquiries/${id}/email-deliveries/dismiss`,
        )
        .set(headers)
        .send({ notices });
    it("persists own revision dismissal, remains idempotent, keeps failure history, and resurfaces a new attempt", async () => {
      const row = await delivery(f.generalEnquiry.id),
        before = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: row.id } });
      const item = (await read(f.generalEnquiry.id)).body.data.items.find(
        (i: { id: string }) => i.id === row.id,
      );
      expect(item).toMatchObject({
        status: "FAILED",
        noticeEligible: true,
        noticeDismissed: false,
      });
      const notice = { id: item.id, revision: item.noticeRevision };
      for (let n = 0; n < 2; n++)
        expect((await dismiss(f.generalEnquiry.id, [notice])).status).toBe(200);
      expect(
        (await read(f.generalEnquiry.id)).body.data.items.find(
          (i: { id: string }) => i.id === row.id,
        ).noticeDismissed,
      ).toBe(true);
      expect(
        (await read(f.generalEnquiry.id, owner.headers)).body.data.items.find(
          (i: { id: string }) => i.id === row.id,
        ).noticeDismissed,
      ).toBe(false);
      expect(
        await prisma.outboxEvent.findUniqueOrThrow({ where: { id: row.id } }),
      ).toEqual(before);
      await prisma.outboxEvent.update({ where: { id: row.id }, data: { attempts: 4 } });
      const updated = (await read(f.generalEnquiry.id)).body.data.items.find(
        (i: { id: string }) => i.id === row.id,
      );
      expect(updated.noticeRevision).not.toBe(item.noticeRevision);
      expect(updated.noticeDismissed).toBe(false);
      expect(updated.status).toBe("FAILED");
      expect((await dismiss(f.generalEnquiry.id, [notice])).status).toBe(409);
    });
    it("rejects foreign/stale batches atomically and does not dismiss successful delivery", async () => {
      const a = await delivery(f.generalEnquiry.id),
        b = await delivery(f.enquiry.id);
      const items = (await read(f.generalEnquiry.id)).body.data.items,
        item = items.find((i: { id: string }) => i.id === a.id);
      expect(
        (
          await dismiss(f.generalEnquiry.id, [
            { id: a.id, revision: item.noticeRevision },
            { id: b.id, revision: item.noticeRevision },
          ])
        ).status,
      ).toBe(409);
      expect(
        await prisma.supportDeliveryNoticeDismissal.count({
          where: { deliveryId: a.id },
        }),
      ).toBe(0);
      await prisma.outboxEvent.update({
        where: { id: a.id },
        data: { status: "PUBLISHED", lastError: null, publishedAt: new Date() },
      });
      const successful = (await read(f.generalEnquiry.id)).body.data.items.find(
        (i: { id: string }) => i.id === a.id,
      );
      expect(successful.noticeEligible).toBe(false);
      expect(
        (
          await dismiss(f.generalEnquiry.id, [
            { id: a.id, revision: successful.noticeRevision },
          ])
        ).status,
      ).toBe(409);
    });
    it("authorizes Customer Service in current scope, denies customers/technicians/sales/foreign branch and preserves legacy boundary", async () => {
      const row = await delivery(f.generalEnquiry.id),
        item = (await read(f.generalEnquiry.id)).body.data.items.find(
          (i: { id: string }) => i.id === row.id,
        ),
        notices = [{ id: row.id, revision: item.noticeRevision }];
      expect(
        (await dismiss(f.generalEnquiry.id, notices, f.care.headers, true)).status,
      ).toBe(200);
      for (const account of [f.customer, f.mechanical1, f.sales])
        expect(
          (await dismiss(f.generalEnquiry.id, notices, account.headers, true)).status,
        ).toBe(403);
      const foreign = await f.account("CUSTOMER_SERVICE", "STAFF", f.other.id);
      expect(
        (await dismiss(f.generalEnquiry.id, notices, foreign.headers, true)).status,
      ).toBe(404);
      expect((await dismiss(f.generalEnquiry.id, notices, f.care.headers)).status).toBe(
        403,
      );
      expect(
        await prisma.outboxEvent.count({
          where: { id: row.id, status: "DEAD_LETTER", attempts: 3 },
        }),
      ).toBe(1);
    });
  },
);
