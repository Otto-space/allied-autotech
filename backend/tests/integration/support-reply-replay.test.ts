import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import * as audit from "../../src/modules/audit/audit.service.js";
import * as notifications from "../../src/modules/notifications/notifications.service.js";
import { reviewSourceCustomer } from "../helpers/review-sources.js";
import { replyKey, supportReplyFixture } from "../helpers/support-reply.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "durable customer reply recovery",
  () => {
    let app = createApp();
    beforeEach(() => {
      app = createApp();
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(() => prisma.$disconnect());
    type Fixture = Awaited<ReturnType<typeof supportReplyFixture>>;
    const url = (f: Fixture) =>
      `/api/v1/customers/support/${f.kind === "enquiry" ? "enquiries" : "complaints"}/${f.recordId}/messages`;
    const target = (f: Fixture) =>
      f.kind === "enquiry" ? { enquiryId: f.recordId } : { complaintId: f.recordId };
    const post = (
      f: Fixture,
      key = replyKey(),
      body: unknown = { message: "Original reply" },
    ) =>
      request(app)
        .post(url(f))
        .set("Cookie", f.cookie)
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", f.csrf)
        .set("Idempotency-Key", key)
        .send(body);
    async function counts(f: Fixture) {
      const notes = await prisma.notification.findMany({
        where: { resourceId: f.recordId },
        select: { id: true },
      });
      return {
        messages: await prisma.supportMessage.count({ where: target(f) }),
        audits: await prisma.auditLog.count({
          where: { userId: f.user.id, entityId: f.recordId, action: "CREATE" },
        }),
        receipts: await prisma.idempotencyRecord.count({
          where: { scope: `support-reply:${f.kind}:${f.recordId}:${f.user.id}` },
        }),
        notifications: notes.length,
        deliveries: await prisma.notificationDelivery.count({
          where: { notificationId: { in: notes.map((n) => n.id) } },
        }),
        outbox: await prisma.outboxEvent.count({
          where: {
            aggregateId: { in: notes.map((n) => n.id) },
            aggregateType: "Notification",
          },
        }),
      };
    }
    const once = {
      messages: 1,
      audits: 1,
      receipts: 1,
      notifications: 1,
      deliveries: 1,
      outbox: 1,
    };
    const empty = {
      messages: 0,
      audits: 0,
      receipts: 0,
      notifications: 0,
      deliveries: 0,
      outbox: 0,
    };
    async function close(f: Fixture) {
      const data = {
        status: "CLOSED" as const,
        resolvedAt: new Date(),
        closedAt: new Date(),
        version: { increment: 1 },
      };
      if (f.kind === "enquiry")
        await prisma.enquiry.update({ where: { id: f.recordId }, data });
      else
        await prisma.complaint.update({
          where: { id: f.recordId },
          data: { ...data, resolution: "Synthetic resolution" },
        });
    }
    for (const kind of ["enquiry", "complaint"] as const) {
      it(`${kind}: response recovery after closure preserves one reply, audit and notification intent`, async () => {
        const f = await supportReplyFixture(kind),
          key = replyKey();
        const original = await post(f, key);
        expect(original.status).toBe(201);
        expect(original.body.data.replayed).toBe(false);
        await close(f);
        await prisma.branch.update({
          where: { id: f.branchId },
          data: { isActive: false },
        });
        const replay = await post(f, key, { message: "  Original reply  " });
        expect(replay.status).toBe(201);
        expect(replay.body.data).toEqual({ ...original.body.data, replayed: true });
        expect(Object.keys(replay.body.data).sort()).toEqual(
          ["id", "authorType", "visibility", "body", "createdAt", "replayed"].sort(),
        );
        expect(replay.headers["cache-control"]).toContain("no-store");
        expect((await post(f)).status).toBe(409);
        expect(await counts(f)).toEqual(once);
      });
      it(`${kind}: concurrent identical replies create once`, async () => {
        const f = await supportReplyFixture(kind),
          key = replyKey();
        const results = await Promise.all([post(f, key), post(f, key), post(f, key)]);
        expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
        expect(new Set(results.map((r) => r.body.data.id)).size).toBe(1);
        expect(results.filter((r) => !r.body.data.replayed)).toHaveLength(1);
        expect(await counts(f)).toEqual(once);
      });
      it(`${kind}: body mismatch and a foreign actor cannot replay the original reply`, async () => {
        const f = await supportReplyFixture(kind),
          key = replyKey();
        await post(f, key);
        expect((await post(f, key, { message: "Changed reply" })).body.error.code).toBe(
          "IDEMPOTENCY_CONFLICT",
        );
        const other = await reviewSourceCustomer();
        const denied = await post({ ...f, ...other }, key);
        expect(denied.status).toBe(404);
        expect(denied.body.data).toBeUndefined();
        expect(await counts(f)).toEqual(once);
      });
      it(`${kind}: revoked conversation ownership denies replay`, async () => {
        const f = await supportReplyFixture(kind),
          key = replyKey();
        await post(f, key);
        const other = await reviewSourceCustomer();
        if (kind === "enquiry")
          await prisma.enquiry.update({
            where: { id: f.recordId },
            data: { customerId: other.customerId },
          });
        else
          await prisma.complaint.update({
            where: { id: f.recordId },
            data: { customerId: other.customerId },
          });
        expect((await post(f, key)).status).toBe(404);
        expect(await counts(f)).toEqual(once);
      });
      for (const failure of ["audit", "notification"] as const)
        it(`${kind}: ${failure} failure rolls back every effect and allows original recovery`, async () => {
          const f = await supportReplyFixture(kind),
            key = replyKey();
          const spy =
            failure === "audit"
              ? vi.spyOn(audit, "appendAuditEvent")
              : vi.spyOn(notifications, "enqueueNotification");
          spy.mockRejectedValueOnce(new Error("Synthetic failure"));
          expect((await post(f, key)).status).toBe(500);
          expect(await counts(f)).toEqual(empty);
          spy.mockRestore();
          expect((await post(f, key)).status).toBe(201);
          expect((await post(f, key)).body.data.replayed).toBe(true);
          expect(await counts(f)).toEqual(once);
        });
      it(`${kind}: expired keys stay rejected after cleanup and future keys are rejected`, async () => {
        const f = await supportReplyFixture(kind),
          key = replyKey(Date.now() - 86400001),
          scope = `support-reply:${kind}:${f.recordId}:${f.user.id}`;
        await prisma.idempotencyRecord.create({
          data: {
            scope,
            userId: f.user.id,
            keyHash: createHash("sha256").update(key).digest("hex"),
            requestHash: createHash("sha256").update("expired").digest("hex"),
            status: "COMPLETED",
            responseStatus: 201,
            responseBody: { resourceId: randomUUID() },
            createdAt: new Date(Date.now() - 86400001),
            completedAt: new Date(Date.now() - 86400000),
            expiresAt: new Date(Date.now() - 1),
          },
        });
        expect((await post(f, key)).body.error.code).toBe("IDEMPOTENCY_EXPIRED");
        await prisma.idempotencyRecord.deleteMany({ where: { scope } });
        expect((await post(f, key)).body.error.code).toBe("IDEMPOTENCY_EXPIRED");
        expect((await post(f, replyKey(Date.now() + 120000))).body.error.code).toBe(
          "IDEMPOTENCY_EXPIRED",
        );
        expect(await counts(f)).toEqual(empty);
      });
      it(`${kind}: required header, strict customer body, authentication and CSRF are enforced`, async () => {
        const f = await supportReplyFixture(kind);
        expect((await request(app).post(url(f)).send({ message: "Hello" })).status).toBe(
          401,
        );
        expect(
          (
            await request(app)
              .post(url(f))
              .set("Cookie", f.cookie)
              .send({ message: "Hello" })
          ).status,
        ).toBe(403);
        expect(
          (
            await request(app)
              .post(url(f))
              .set("Cookie", f.cookie)
              .set("Origin", "http://localhost:3000")
              .set("X-CSRF-Token", f.csrf)
              .send({ message: "Hello" })
          ).status,
        ).toBe(422);
        expect((await post(f, "bad-key")).status).toBe(422);
        expect(
          (await post(f, replyKey(), { message: "Hello", visibility: "INTERNAL" }))
            .status,
        ).toBe(422);
        expect(await counts(f)).toEqual(empty);
      });
      it(`${kind}: corrupted internal-message receipt cannot disclose private staff text`, async () => {
        const f = await supportReplyFixture(kind),
          key = replyKey();
        await post(f, key);
        const internal = await prisma.supportMessage.create({
          data: {
            ...target(f),
            authorUserId: f.staffUserId,
            authorType: "STAFF",
            visibility: "INTERNAL",
            body: "PRIVATE_SENTINEL",
          },
        });
        await prisma.idempotencyRecord.updateMany({
          where: { scope: `support-reply:${kind}:${f.recordId}:${f.user.id}` },
          data: { responseBody: { resourceId: internal.id } },
        });
        const denied = await post(f, key);
        expect(denied.status).toBe(409);
        expect(JSON.stringify(denied.body)).not.toContain("PRIVATE_SENTINEL");
        expect(await counts(f)).toEqual({ ...once, messages: 2 });
      });
    }
  },
);
