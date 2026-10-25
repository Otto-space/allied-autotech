import { randomUUID } from "node:crypto";
import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { workforceFixture } from "../fixtures/workforce.js";
import { NotificationsRepository } from "../../src/modules/notifications/notifications.repository.js";
import { notifySupportTeam } from "../../src/modules/notifications/team-notifications.js";
import { enqueueNotification } from "../../src/modules/notifications/notifications.service.js";
import { NotificationDeliveryWorker } from "../../src/workers/notification.worker.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "notification experience contracts on isolated PostgreSQL",
  () => {
    const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
    let f: Awaited<ReturnType<typeof workforceFixture>>;
    beforeAll(async () => {
      f = await workforceFixture();
    });
    afterAll(() => prisma.$disconnect());
    const root = (role: string) =>
      `/api/v1/${role === "CUSTOMER" ? "customers" : "staff"}/notifications`;
    const notice = (userId: string, reference = false) =>
      prisma.notification.create({
        data: {
          userId,
          type: "SYSTEM",
          category: reference ? "OPERATIONAL" : "SECURITY",
          title: "Private fixture title",
          message: "Confidential fixture content",
          ...(reference ? { resourceType: "WORKFORCE_JOB", resourceId: f.job1.id } : {}),
        },
      });

    it("owns list/detail/count/read/unread/bulk for every role and all eight responsibility templates", async () => {
      const owner = { user: f.owner, ...(await f.session(f.owner.id, "SUPER_ADMIN")) };
      for (const identity of [
        f.customer,
        f.mechanical1,
        f.electrical,
        f.lead,
        f.sales,
        f.cashier,
        f.accountant,
        f.care,
        f.operations,
        owner,
      ]) {
        const row = await notice(identity.user.id),
          base = root(identity.user.role);
        const get = (url: string) => request(app).get(url).set(identity.headers);
        const post = (url: string) =>
          request(app).post(url).set(identity.headers).send({});
        expect(
          (await get(base)).body.data.items.some((r: { id: string }) => r.id === row.id),
        ).toBe(true);
        expect((await get(`${base}/summary`)).body.data.unreadCount).toBeGreaterThan(0);
        await get(`${base}/${row.id}`).expect(200);
        const first = await post(`${base}/${row.id}/read`).expect(200);
        const repeated = await post(`${base}/${row.id}/read`).expect(200);
        expect(first.body.data.readAt).toBe(repeated.body.data.readAt);
        for (let n = 0; n < 2; n++)
          expect(
            (await post(`${base}/${row.id}/unread`).expect(200)).body.data.readAt,
          ).toBeNull();
        const bulk = await post(`${base}/read-all`).expect(200);
        expect(Date.parse(bulk.body.data.cutoff)).toBeGreaterThan(0);
        const foreign = await notice(f.stranger.user.id);
        await get(`${base}/${foreign.id}`).expect(404);
        await post(`${base}/${foreign.id}/read`).expect(404);
        await post(`${base}/${foreign.id}/unread`).expect(404);
        await get(`${base}?userId=${f.stranger.user.id}`).expect(422);
        await get(`${base}/summary?userId=${f.stranger.user.id}`).expect(422);
        expect(
          (await prisma.notification.findUniqueOrThrow({ where: { id: foreign.id } }))
            .readAt,
        ).toBeNull();
        await request(app)
          .post(`${base}/${row.id}/unread`)
          .set({ Cookie: identity.headers.Cookie, Origin: identity.headers.Origin })
          .send({})
          .expect(403);
      }
    });

    it("redacts revoked source content/identifiers on list/detail/read responses and summary groups, retaining the database record", async () => {
      const row = await notice(f.mechanical1.user.id, true),
        base = root("STAFF");
      const get = (url: string) => request(app).get(url).set(f.mechanical1.headers);
      expect((await get(`${base}/${row.id}`)).body.data.destination).toBeTruthy();
      await prisma.booking.update({
        where: { id: f.job1.id },
        data: { assignedStaffId: f.mechanical2.user.staffProfile!.id },
      });
      for (const response of [
        await get(base),
        await get(`${base}/${row.id}`),
        await request(app)
          .post(`${base}/${row.id}/read`)
          .set(f.mechanical1.headers)
          .send({}),
      ]) {
        expect(response.status).toBe(200);
        const projected = response.body.data.items?.find((item: { id: string }) => item.id === row.id) ?? response.body.data;
        expect(JSON.stringify(projected)).not.toContain(
          "Confidential fixture content",
        );
        expect(JSON.stringify(projected)).not.toContain(f.job1.id);
      }
      const item = (await get(`${base}/${row.id}`)).body.data;
      expect(item).toMatchObject({
        title: "Update no longer available",
        resourceType: null,
        resourceId: null,
        destination: null,
      });
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).message,
      ).toBe("Confidential fixture content");
      await prisma.booking.update({
        where: { id: f.job1.id },
        data: { assignedStaffId: f.mechanical1.user.staffProfile!.id },
      });
    });

    it("bulk cutoff excludes a later arrival and affects only the owned inbox, including earlier pages", async () => {
      const cutoff = new Date();
      const late = await prisma.notification.create({
        data: {
          userId: f.customer.user.id,
          type: "SYSTEM",
          category: "SECURITY",
          title: "Later update",
          message: "Later",
          createdAt: new Date(cutoff.getTime() + 1000),
        },
      });
      const first = await notice(f.customer.user.id);
      await prisma.notification.update({
        where: { id: first.id },
        data: { createdAt: new Date(cutoff.getTime() - 1000) },
      });
      await prisma.$transaction((tx) =>
        new NotificationsRepository(prisma).markAllRead(f.customer.user.id, tx, cutoff),
      );
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: late.id } })).readAt,
      ).toBeNull();
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: first.id } })).readAt,
      ).toEqual(cutoff);
    });

    it("routes support recipients by actual scope and temporary vacancy coverage, deduplicates and excludes internal content", async () => {
      const input = {
        kind: "ENQUIRY" as const,
        id: f.enquiry.id,
        event: `fixture:${randomUUID()}`,
        title: "Customer conversation updated",
      };
      await prisma.$transaction((tx) => notifySupportTeam(tx, input));
      await prisma.$transaction((tx) => notifySupportTeam(tx, input));
      const rows = await prisma.notification.findMany({
        where: { resourceId: f.enquiry.id },
      });
      for (const recipient of [
        f.owner,
        f.care.user,
        f.sales.user,
        f.cashier.user,
        f.operations.user,
      ])
        expect(rows.filter((r) => r.userId === recipient.id)).toHaveLength(1);
      for (const recipient of [
        f.customer,
        f.mechanical1,
        f.electrical,
        f.lead,
        f.accountant,
      ])
        expect(rows.some((r) => r.userId === recipient.user.id)).toBe(false);
      expect(JSON.stringify(rows)).not.toContain(f.enquiry.message);
      await prisma.workforceAssignment.updateMany({
        where: { id: { in: [f.salesCover.id, f.careCover.id] } },
        data: { revokedAt: new Date() },
      });
      await prisma.$transaction((tx) =>
        notifySupportTeam(tx, { ...input, event: `fixture:${randomUUID()}` }),
      );
      expect(
        await prisma.notification.count({
          where: { resourceId: f.enquiry.id, userId: f.operations.user.id },
        }),
      ).toBe(1);
    });

    it("stops disabled delivery at the first attempt without sending or changing inbox read state", async () => {
      const row = await prisma.$transaction((tx) =>
        enqueueNotification(tx, {
          userId: f.customer.user.id,
          type: "SYSTEM",
          category: "OPERATIONAL",
          title: "Synthetic delivery",
          message: "Synthetic",
          deduplicationKey: randomUUID(),
          channels: ["EMAIL"],
        }),
      );
      const delivery = await prisma.notificationDelivery.findFirstOrThrow({
        where: { notificationId: row.id },
      });
      await prisma.outboxEvent.update({
        where: { id: delivery.outboxEventId! },
        data: { status: "PENDING", availableAt: new Date(0) },
      });
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "PENDING" },
      });
      await new NotificationDeliveryWorker(null, null, prisma).runOnce(100);
      expect(
        await prisma.notificationDelivery.findUniqueOrThrow({
          where: { id: delivery.id },
        }),
      ).toMatchObject({
        status: "DEAD_LETTER",
        lastErrorCode: "CHANNEL_DISABLED",
        attempts: 1,
      });
      expect(
        (await prisma.notification.findUniqueOrThrow({ where: { id: row.id } })).readAt,
      ).toBeNull();
    });
  },
);
