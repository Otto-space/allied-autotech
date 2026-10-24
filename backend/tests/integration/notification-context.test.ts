import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "isolated authorized notification context",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    const customerBase = "/api/v1/customers/notifications";
    const staffBase = "/api/v1/staff/notifications";
    const get = (path: string, identity = f.customer) =>
      request(app).get(path).set(identity.headers);
    const post = (path: string, body: unknown, identity = f.customer) =>
      request(app).post(path).set(identity.headers).send(body);
    async function notice(
      userId: string,
      resourceType: string,
      resourceId: string,
      supportMessageId?: string,
      expiresAt?: Date,
    ) {
      return prisma.notification.create({
        data: {
          userId,
          type: "SYSTEM",
          category: "OPERATIONAL",
          title: "Synthetic record update",
          message: "Review the current synthetic record",
          resourceType,
          resourceId,
          ...(supportMessageId ? { supportMessageId } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        },
      });
    }
    const context = (type: string, id: string) =>
      `context?resourceType=${type}&resourceId=${id}`;
    beforeAll(async () => {
      f = await workforceFixture();
    }, 30000);
    afterAll(() => prisma.$disconnect());

    it("counts distinct authorized records, resolves one directly and keeps every multiple-record update in a queue", async () => {
      const first = await notice(f.customer.user.id, "BOOKING", f.job1.id);
      await notice(f.customer.user.id, "BOOKING", f.job1.id);
      await notice(f.customer.user.id, "BOOKING", randomUUID());
      const summary = await get(`${customerBase}/summary`);
      expect(summary.status, JSON.stringify(summary.body)).toBe(200);
      expect(summary.body.data.destinations).toEqual([
        {
          section: "/dashboard/bookings",
          count: 2,
          recordCount: 1,
          href: expect.stringMatching(/^\/dashboard\/notifications\?notification=/),
        },
      ]);
      expect(
        (await get(`${customerBase}/${first.id}`)).body.data.destination,
      ).toMatchObject({
        section: "/dashboard/bookings",
        href: `/dashboard/bookings/${f.job1.id}`,
      });
      await notice(f.customer.user.id, "BOOKING", f.job2.id);
      const multiple = await get(`${customerBase}/summary`);
      expect(multiple.body.data.destinations[0]).toMatchObject({
        count: 3,
        recordCount: 2,
        href: "/dashboard/notifications?attention=%2Fdashboard%2Fbookings",
      });
      const page = await get(
        `${customerBase}/attention?section=%2Fdashboard%2Fbookings&limit=1`,
      );
      expect(page.status).toBe(200);
      expect(page.body.data.items).toHaveLength(1);
      expect(page.body.data.nextCursor).toBe(page.body.data.items[0].id);
      const next = await get(
        `${customerBase}/attention?section=%2Fdashboard%2Fbookings&limit=1&cursor=${page.body.data.nextCursor}`,
      );
      expect(next.body.data.items[0].id).not.toBe(page.body.data.items[0].id);
      expect(
        (await get(`${customerBase}/attention?section=%2Fadmin%2Fbookings`)).body.data
          .items,
      ).toEqual([]);
      expect(
        (await get(`${customerBase}/attention?section=https://example.test`)).status,
      ).toBe(422);
      expect(
        await prisma.notification.count({
          where: { userId: f.customer.user.id, readAt: { not: null } },
        }),
      ).toBe(0);
    });

    it("reads only the exact recipient and target, preserves the original read time and never completes work", async () => {
      const item = await notice(f.customer.user.id, "BOOKING", f.job1.id);
      const unrelated = await notice(f.customer.user.id, "BOOKING", f.job2.id);
      const foreign = await notice(f.stranger.user.id, "BOOKING", f.job1.id);
      const body = {
        resourceType: "BOOKING",
        resourceId: f.job1.id,
        notificationIds: [item.id],
      };
      expect(
        (
          await get(`${customerBase}/${context("BOOKING", f.job1.id)}`)
        ).body.data.items.some((n: { id: string }) => n.id === item.id),
      ).toBe(true);
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).readAt,
      ).toBeNull();
      for (const notificationIds of [[foreign.id], [unrelated.id], [item.id, foreign.id]])
        expect(
          (await post(`${customerBase}/read-context`, { ...body, notificationIds }))
            .status,
        ).toBe(404);
      const status = (
        await prisma.booking.findUniqueOrThrow({ where: { id: f.job1.id } })
      ).status;
      const results = await Promise.all([
        post(`${customerBase}/read-context`, body),
        post(`${customerBase}/read-context`, body),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      expect(results.reduce((sum, r) => sum + r.body.data.updated, 0)).toBe(1);
      const readAt = (
        await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })
      ).readAt;
      expect((await post(`${customerBase}/read-context`, body)).body.data.updated).toBe(
        0,
      );
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).readAt,
      ).toEqual(readAt);
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: unrelated.id } }))
          .readAt,
      ).toBeNull();
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: foreign.id } }))
          .readAt,
      ).toBeNull();
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: f.job1.id } })).status,
      ).toBe(status);
    });

    it("rejects inaccessible targets, malformed context, expired notices and missing CSRF", async () => {
      const item = await notice(
        f.customer.user.id,
        "BOOKING",
        f.job1.id,
        undefined,
        new Date(Date.now() - 10000),
      );
      expect(
        (await get(`${customerBase}/${context("BOOKING", f.job1.id)}`, f.stranger))
          .status,
      ).toBe(404);
      expect(
        (
          await get(
            `${customerBase}/context?resourceType=https://example.test&resourceId=${f.job1.id}`,
          )
        ).status,
      ).toBe(422);
      expect(
        (
          await post(`${customerBase}/read-context`, {
            resourceType: "BOOKING",
            resourceId: f.job1.id,
            notificationIds: [item.id],
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post(`${customerBase}/read-context`)
            .set({ Cookie: f.customer.headers.Cookie, Origin: f.customer.headers.Origin })
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (await get(`${staffBase}/context?resourceType=BOOKING&resourceId=${f.job1.id}`))
          .status,
      ).toBe(403);
      expect((await get(`${customerBase}/${item.id}`)).status).toBe(404);
    });

    it("keeps conversation read changes specific to the displayed message and rejects private or mismatched message links", async () => {
      const message = await prisma.supportMessage.create({
        data: {
          enquiryId: f.enquiry.id,
          authorUserId: f.care.user.id,
          authorType: "STAFF",
          visibility: "CUSTOMER",
          kind: "REPLY",
          body: "Synthetic visible reply",
        },
      });
      const later = await prisma.supportMessage.create({
        data: {
          enquiryId: f.enquiry.id,
          authorUserId: f.care.user.id,
          authorType: "STAFF",
          visibility: "CUSTOMER",
          kind: "REPLY",
          body: "Synthetic later reply",
        },
      });
      const internal = await prisma.supportMessage.create({
        data: {
          enquiryId: f.enquiry.id,
          authorUserId: f.care.user.id,
          authorType: "STAFF",
          visibility: "INTERNAL",
          kind: "INTERNAL_NOTE",
          body: "Synthetic private note",
        },
      });
      const first = await notice(f.customer.user.id, "ENQUIRY", f.enquiry.id, message.id);
      const second = await notice(f.customer.user.id, "ENQUIRY", f.enquiry.id, later.id);
      const hidden = await notice(
        f.customer.user.id,
        "ENQUIRY",
        f.enquiry.id,
        internal.id,
      );
      const wrong = await notice(
        f.customer.user.id,
        "ENQUIRY",
        f.generalEnquiry.id,
        message.id,
      );
      const result = await get(`${customerBase}/${context("ENQUIRY", f.enquiry.id)}`);
      expect(result.body.data.items.map((n: { id: string }) => n.id).sort()).toEqual(
        [first.id, second.id].sort(),
      );
      expect(
        result.body.data.items.find((n: { id: string }) => n.id === first.id).destination
          .href,
      ).toBe(
        `/dashboard/support/enquiries/${f.enquiry.id}?messageId=${message.id}#support-entry-${message.id}`,
      );
      expect(
        (
          await post(`${customerBase}/read-context`, {
            resourceType: "ENQUIRY",
            resourceId: f.enquiry.id,
            notificationIds: [first.id],
          })
        ).status,
      ).toBe(200);
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: second.id } }))
          .readAt,
      ).toBeNull();
      for (const entry of [hidden, wrong])
        expect(
          (
            await post(`${customerBase}/read-context`, {
              resourceType: entry.resourceType,
              resourceId: entry.resourceId,
              notificationIds: [entry.id],
            })
          ).status,
        ).toBe(404);
    });

    it("applies branch and assigned-job scope to staff notifications and exposes only permitted booking fields", async () => {
      const own = await notice(f.mechanical1.user.id, "WORKFORCE_JOB", f.job1.id);
      await notice(f.mechanical1.user.id, "WORKFORCE_JOB", f.job2.id);
      await notice(f.mechanical1.user.id, "WORKFORCE_JOB", f.foreignJob.id);
      const result = await get(`${staffBase}/summary`, f.mechanical1);
      expect(result.status).toBe(200);
      expect(result.body.data.destinations).toEqual([
        {
          section: "/admin/workforce/jobs",
          count: 1,
          recordCount: 1,
          href: `/admin/notifications?notification=${own.id}`,
        },
      ]);
      expect(
        (await get(`${staffBase}/${context("WORKFORCE_JOB", f.job2.id)}`, f.mechanical1))
          .status,
      ).toBe(404);
      expect(
        (
          await post(
            `${staffBase}/read-context`,
            {
              resourceType: "WORKFORCE_JOB",
              resourceId: f.job2.id,
              notificationIds: [own.id],
            },
            f.mechanical1,
          )
        ).status,
      ).toBe(404);
      const booking = await get(
        `/api/v1/staff/workforce/bookings/${f.job1.id}`,
        f.operations,
      );
      expect(booking.status, JSON.stringify(booking.body)).toBe(200);
      expect(booking.body.data.id).toBe(f.job1.id);
      for (const key of ["staffNotes", "workOrder", "customerNotes"])
        expect(booking.body.data).not.toHaveProperty(key);
      expect(
        (await get(`/api/v1/staff/workforce/bookings/${f.foreignJob.id}`, f.operations))
          .status,
      ).toBe(404);
      expect(
        (await get(`/api/v1/staff/workforce/bookings/${f.job1.id}`, f.mechanical1))
          .status,
      ).toBe(403);
    });

    it("removes action links immediately after reassignment and anchors a real older support reply outside the first page", async () => {
      const old = await prisma.supportMessage.create({
        data: {
          enquiryId: f.enquiry.id,
          authorUserId: f.care.user.id,
          authorType: "STAFF",
          visibility: "CUSTOMER",
          kind: "REPLY",
          body: "Synthetic older anchored reply",
          createdAt: new Date("2020-01-01T00:00:00Z"),
        },
      });
      const item = await notice(f.cashier.user.id, "ENQUIRY", f.enquiry.id, old.id);
      const detail = await get(`${staffBase}/${item.id}`, f.cashier);
      expect(detail.body.data.destination.href).toBe(
        `/admin/workforce/enquiries?selected=${f.enquiry.id}&messageId=${old.id}#support-entry-${old.id}`,
      );
      const anchor = await get(
        `/api/v1/staff/workforce/enquiries/${f.enquiry.id}?messageId=${old.id}&limit=1`,
        f.cashier,
      );
      expect(anchor.status, JSON.stringify(anchor.body)).toBe(200);
      expect(anchor.body.data.messages.items[0].id).toBe(old.id);
      const privateMessage = await prisma.supportMessage.findFirstOrThrow({
        where: { enquiryId: f.enquiry.id, visibility: "INTERNAL" },
      });
      expect(
        (
          await get(
            `/api/v1/staff/workforce/enquiries/${f.enquiry.id}?messageId=${privateMessage.id}`,
            f.cashier,
          )
        ).status,
      ).toBe(404);
      await prisma.enquiry.update({
        where: { id: f.enquiry.id },
        data: { assignedStaffId: f.sales.user.staffProfile!.id },
      });
      expect(
        (await get(`${staffBase}/${item.id}`, f.cashier)).body.data.destination,
      ).toBeNull();
      expect(
        (await get(`${staffBase}/summary`, f.cashier)).body.data.destinations,
      ).toEqual([]);
      expect(
        (
          await post(
            `${staffBase}/read-context`,
            {
              resourceType: "ENQUIRY",
              resourceId: f.enquiry.id,
              notificationIds: [item.id],
            },
            f.cashier,
          )
        ).status,
      ).toBe(404);
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: item.id } })).readAt,
      ).toBeNull();
    });

    it("finds an older displayed message beyond 100 other notices and drains large record contexts in bounded batches", async () => {
      const messages = await prisma.supportMessage.findMany({
        where: { enquiryId: f.enquiry.id, visibility: "CUSTOMER" },
        orderBy: { createdAt: "asc" },
        take: 2,
      });
      const older = await notice(
        f.customer.user.id,
        "ENQUIRY",
        f.enquiry.id,
        messages[0]!.id,
      );
      await prisma.notification.update({
        where: { id: older.id },
        data: { createdAt: new Date("2020-01-01T00:00:00Z") },
      });
      await prisma.notification.createMany({
        data: Array.from({ length: 105 }, () => ({
          userId: f.customer.user.id,
          type: "SYSTEM" as const,
          category: "OPERATIONAL" as const,
          title: "Synthetic newer reply",
          message: "Synthetic context fixture",
          resourceType: "ENQUIRY",
          resourceId: f.enquiry.id,
          supportMessageId: messages[1]!.id,
        })),
      });
      const related = await get(
        `${customerBase}/${context("ENQUIRY", f.enquiry.id)}&messageIds=${messages[0]!.id}`,
      );
      expect(related.status, JSON.stringify(related.body)).toBe(200);
      expect(related.body.data.items.some((n: { id: string }) => n.id === older.id)).toBe(
        true,
      );
      expect(
        related.body.data.items.every(
          (n: { supportMessageId: string | null }) =>
            !n.supportMessageId || n.supportMessageId === messages[0]!.id,
        ),
      ).toBe(true);
      expect(
        (
          await get(
            `${customerBase}/${context("ENQUIRY", f.enquiry.id)}&messageIds=invalid`,
          )
        ).status,
      ).toBe(422);
      const ids = Array.from({ length: 130 }, () => randomUUID());
      await prisma.notification.createMany({
        data: ids.map((id) => ({
          id,
          userId: f.customer.user.id,
          type: "BOOKING" as const,
          category: "TRANSACTIONAL" as const,
          title: "Synthetic batch notice",
          message: "Synthetic bounded context",
          resourceType: "Booking",
          resourceId: f.job2.id,
        })),
      });
      let batches = 0;
      for (;;) {
        const response = await get(`${customerBase}/${context("BOOKING", f.job2.id)}`);
        expect(response.status).toBe(200);
        const rows = response.body.data.items;
        if (!rows.length) break;
        expect(rows.length).toBeLessThanOrEqual(100);
        expect(
          (
            await post(`${customerBase}/read-context`, {
              resourceType: "BOOKING",
              resourceId: f.job2.id,
              notificationIds: rows.map((n: { id: string }) => n.id),
            })
          ).status,
        ).toBe(200);
        batches++;
        expect(batches).toBeLessThan(4);
      }
      expect(batches).toBe(2);
      expect(
        await prisma.notification.count({
          where: { id: { in: ids }, readAt: { not: null } },
        }),
      ).toBe(130);
    });

    it("checks branch-scoped finance, invoice roles and current refund/dispute grants before exposing or reading targets", async () => {
      const legacy = await f.account(null),
        admin = await f.account(null, "ADMIN");
      async function payment(bookingId: string) {
        await prisma.serviceQuote.create({
          data: {
            bookingId,
            createdByStaffId: f.lead.user.staffProfile!.id,
            quoteNumber: `NOTICE-${randomUUID().slice(0, 24)}`,
            status: "ACCEPTED",
            acceptedAt: new Date(),
            subtotalKobo: 10000n,
            totalKobo: 10000n,
          },
        });
        const invoice = await prisma.invoice.create({
          data: {
            customerId: f.customer.user.profile!.id,
            bookingId,
            invoiceNumber: `NOTICE-${randomUUID()}`,
            subtotalKobo: 10000n,
            totalKobo: 10000n,
          },
        });
        const payment = await prisma.payment.create({
          data: {
            customerId: f.customer.user.profile!.id,
            invoiceId: invoice.id,
            paymentNumber: `NOTICE-${randomUUID()}`,
            purpose: "SERVICE_INVOICE",
            amountKobo: 10000n,
            idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
          },
        });
        return { invoice, payment };
      }
      const own = await payment(f.job1.id),
        foreign = await payment(f.foreignJob.id);
      const financial = await notice(f.accountant.user.id, "PAYMENT", own.payment.id);
      const blocked = await notice(f.accountant.user.id, "PAYMENT", foreign.payment.id);
      expect(
        (await get(`${staffBase}/${financial.id}`, f.accountant)).body.data.destination,
      ).toMatchObject({
        section: "/admin/workforce/finance",
        href: `/admin/workforce/finance?selected=${own.payment.id}`,
      });
      expect(
        (await get(`${staffBase}/${blocked.id}`, f.accountant)).body.data.destination,
      ).toBeNull();
      expect(
        (
          await get(
            `${staffBase}/${context("PAYMENT", foreign.payment.id)}`,
            f.accountant,
          )
        ).status,
      ).toBe(404);
      const invoiceNotice = await notice(legacy.user.id, "INVOICE", own.invoice.id);
      expect(
        (await get(`${staffBase}/${invoiceNotice.id}`, legacy)).body.data.destination,
      ).toBeNull();
      expect(
        (await get(`${customerBase}/${context("INVOICE", own.invoice.id)}`)).status,
      ).toBe(200);
      expect(
        (await get(`${customerBase}/${context("INVOICE", own.invoice.id)}`, f.stranger))
          .status,
      ).toBe(404);
      const adminInvoice = await notice(admin.user.id, "INVOICE", own.invoice.id);
      expect(
        (await get(`${staffBase}/${adminInvoice.id}`, admin)).body.data.destination.href,
      ).toBe(`/admin/invoices/${own.invoice.id}`);
      const attempt = await prisma.paymentAttempt.create({
        data: {
          paymentId: own.payment.id,
          attemptNumber: 1,
          internalReference: `NOTICE-${randomUUID()}`,
          provider: "PAYSTACK",
          amountKobo: 10000n,
          status: "SUCCESSFUL",
          verificationStatus: "VERIFIED",
          verifiedAmountKobo: 10000n,
          verifiedCurrency: "NGN",
          paidAt: new Date(),
          verifiedAt: new Date(),
          providerReference: `synthetic-${randomUUID()}`,
          gatewayTransactionId: `synthetic-${randomUUID()}`,
        },
      });
      await prisma.payment.update({
        where: { id: own.payment.id },
        data: {
          status: "SUCCEEDED",
          settledAttemptId: attempt.id,
          succeededAt: new Date(),
        },
      });
      const refund = await prisma.refund.create({
        data: {
          requestedByUserId: f.owner.id,
          paymentAttemptId: attempt.id,
          refundNumber: `NOTICE-${randomUUID()}`,
          amountKobo: 1000n,
          reason: "Synthetic scope fixture",
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
        },
      });
      const dispute = await prisma.paymentDispute.create({
        data: {
          paymentAttemptId: attempt.id,
          provider: "PAYSTACK",
          providerDisputeId: `NOTICE-${randomUUID()}`,
          status: "AWAITING_RESPONSE",
          category: "OTHER",
          amountKobo: 10000n,
          openedAt: new Date(),
          primaryUserId: legacy.user.id,
        },
      });
      const refundNotice = await notice(legacy.user.id, "REFUND", refund.id),
        disputeNotice = await notice(legacy.user.id, "DISPUTE", dispute.id);
      expect(
        (await get(`${staffBase}/${refundNotice.id}`, legacy)).body.data.destination,
      ).toBeNull();
      expect(
        (await get(`${staffBase}/${disputeNotice.id}`, legacy)).body.data.destination,
      ).toBeNull();
      const grants = await Promise.all(
        ["REFUND_APPROVE", "DISPUTE_MANAGE"].map((capability) =>
          prisma.userCapability.create({
            data: { userId: legacy.user.id, grantedByUserId: f.owner.id, capability },
          }),
        ),
      );
      expect(
        (await get(`${staffBase}/${refundNotice.id}`, legacy)).body.data.destination.href,
      ).toBe(`/admin/refunds?refundId=${refund.id}`);
      expect(
        (await get(`${staffBase}/${disputeNotice.id}`, legacy)).body.data.destination
          .href,
      ).toBe(`/admin/payment-disputes/work?selected=${dispute.id}`);
      await prisma.userCapability.updateMany({
        where: { id: { in: grants.map((g) => g.id) } },
        data: { revokedAt: new Date() },
      });
      for (const [type, resourceId, id] of [
        ["REFUND", refund.id, refundNotice.id],
        ["DISPUTE", dispute.id, disputeNotice.id],
      ]) {
        expect(
          (await get(`${staffBase}/${id}`, legacy)).body.data.destination,
        ).toBeNull();
        expect(
          (
            await post(
              `${staffBase}/read-context`,
              { resourceType: type, resourceId, notificationIds: [id] },
              legacy,
            )
          ).status,
        ).toBe(404);
        expect(
          (await prisma.notification.findUniqueOrThrow({ where: { id } })).readAt,
        ).toBeNull();
      }
      expect(
        (await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } })).status,
      ).toBe("REQUESTED");
      expect(
        (await prisma.paymentDispute.findUniqueOrThrow({ where: { id: dispute.id } }))
          .status,
      ).toBe("AWAITING_RESPONSE");
    });
  },
);
