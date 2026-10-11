import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { AuditOperationsService } from "../../src/modules/audit/audit.service.js";
import { enqueueNotification } from "../../src/modules/notifications/notifications.service.js";
import { NotificationDeliveryWorker } from "../../src/workers/notification.worker.js";
import { testOwner } from "../helpers/owner.js";

const context = {
  requestId: "notification-retry-test",
  ipAddress: null,
  userAgent: null,
};
const operations = new AuditOperationsService(prisma);
const app = createApp({ checkReadiness: async () => undefined });

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "operational notification retries",
  () => {
    const jobs: string[] = [];
    let administrator: AuthenticatedActor;
    let owner: AuthenticatedActor;
    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          email: `retry-admin-${randomUUID()}@example.test`,
          passwordHash: "unusable",
          role: "ADMIN",
          emailVerifiedAt: new Date(),
        },
      });
      administrator = {
        userId: user.id,
        email: user.email,
        role: "ADMIN",
        sessionId: randomUUID(),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const root = await testOwner("unusable");
      owner = {
        ...administrator,
        userId: root.id,
        email: root.email,
        role: "SUPER_ADMIN",
      };
    });
    afterEach(async () => {
      // Leave no eligible synthetic job for a later test's worker batch.
      await prisma.outboxEvent.updateMany({
        where: { id: { in: jobs }, status: { in: ["PENDING", "FAILED", "PROCESSING"] } },
        data: { status: "DEAD_LETTER", lockedAt: null },
      });
      jobs.length = 0;
    });
    afterAll(async () => prisma.$disconnect());

    async function fixture(
      channel: "EMAIL" | "SMS" = "EMAIL",
      category: "TRANSACTIONAL" | "OPERATIONAL" = "TRANSACTIONAL",
    ) {
      const recipient = await prisma.user.create({
        data: {
          email: `retry-recipient-${randomUUID()}@example.test`,
          passwordHash: "unusable",
          profile: {
            create: {
              firstName: "Retry",
              lastName: "Recipient",
              phone: "+2348000000000",
            },
          },
        },
      });
      const notification = await prisma.$transaction((tx) =>
        enqueueNotification(tx, {
          userId: recipient.id,
          type: "SYSTEM",
          category,
          title: "Synthetic notification retry",
          message: "Private synthetic message",
          deduplicationKey: randomUUID(),
          channels: [channel],
        }),
      );
      const delivery = await prisma.notificationDelivery.findFirstOrThrow({
        where: { notificationId: notification.id, channel },
      });
      const event = await prisma.outboxEvent.findUniqueOrThrow({
        where: { id: delivery.outboxEventId! },
      });
      jobs.push(event.id);
      // Runtime delivery is deliberately disabled in tests, producing a real dead letter.
      expect(event.status).toBe("DEAD_LETTER");
      expect(delivery.status).toBe("DEAD_LETTER");
      return { recipient, event, delivery };
    }
    const retry = (id: string, expectedAttempts = 0) =>
      operations.retryJob(
        administrator,
        "outbox",
        id,
        { expectedAttempts, reason: "Provider configuration repaired" },
        context,
      );
    async function headers(actor: AuthenticatedActor) {
      const token = generateOpaqueToken(),
        csrf = generateOpaqueToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 3_600_000);
      await prisma.session.create({
        data: {
          userId: actor.userId,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          createdAt: now,
          lastRotatedAt: now,
          expiresAt,
          idleExpiresAt: expiresAt,
          mfaRequired: true,
          mfaVerifiedAt: actor.mfaVerifiedAt === null ? null : now,
        },
      });
      return {
        Origin: "http://localhost:3000",
        Cookie: `${sessionCookieName}=${token}`,
        "X-CSRF-Token": csrf,
      };
    }

    it.each(["EMAIL", "SMS"] as const)(
      "recovers a disabled %s delivery through the administrator HTTP retry",
      async (channel) => {
        const f = await fixture(channel);
        const actor = channel === "EMAIL" ? administrator : owner;
        const response = await request(app)
          .post(`/api/v1/admin/operations/jobs/outbox/${f.event.id}/retry`)
          .set(await headers(actor))
          .send({ expectedAttempts: 0, reason: "Provider configuration repaired" });
        expect(response.status).toBe(200);
        expect(response.body.data).toMatchObject({
          id: f.event.id,
          source: "outbox",
          status: "RETRY_REQUESTED",
          attempts: 0,
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          /encrypted|ciphertext|Private synthetic/,
        );
        expect(
          await prisma.notificationDelivery.findUniqueOrThrow({
            where: { id: f.delivery.id },
          }),
        ).toMatchObject({ status: "PENDING", attempts: 0, lastErrorCode: null });
        const sent: string[] = [];
        const worker = new NotificationDeliveryWorker(
          {
            async send(message) {
              sent.push(message.idempotencyKey);
            },
          },
          {
            async send(message) {
              sent.push(message.idempotencyKey);
            },
          },
          prisma,
        );
        await worker.runOnce(100);
        await worker.runOnce(100);
        expect(sent.filter((id) => id === f.event.eventId)).toHaveLength(1);
        expect(
          await prisma.outboxEvent.findUniqueOrThrow({ where: { id: f.event.id } }),
        ).toMatchObject({ status: "PUBLISHED", attempts: 1 });
        expect(
          await prisma.notificationDelivery.findUniqueOrThrow({
            where: { id: f.delivery.id },
          }),
        ).toMatchObject({
          status: "PUBLISHED",
          attempts: 1,
          deliveredAt: expect.any(Date),
        });
        expect(
          await prisma.auditLog.count({
            where: { entityId: f.event.id, action: "STATUS_CHANGE" },
          }),
        ).toBe(1);
      },
    );

    it("allows one concurrent retry, preserves attempt counts and leaves a stale retry unchanged", async () => {
      const f = await fixture();
      await prisma.$transaction([
        prisma.outboxEvent.update({
          where: { id: f.event.id },
          data: { status: "FAILED", attempts: 3 },
        }),
        prisma.notificationDelivery.update({
          where: { id: f.delivery.id },
          data: { status: "FAILED", attempts: 3 },
        }),
      ]);
      await expect(retry(f.event.id, 2)).rejects.toMatchObject({ code: "CONFLICT" });
      const results = await Promise.allSettled([
        retry(f.event.id, 3),
        retry(f.event.id, 3),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      expect(
        await prisma.notificationDelivery.findUniqueOrThrow({
          where: { id: f.delivery.id },
        }),
      ).toMatchObject({ status: "PENDING", attempts: 3, lastErrorCode: null });
      expect(await prisma.auditLog.count({ where: { entityId: f.event.id } })).toBe(1);
    });

    it.each(["PUBLISHED", "PROCESSING"] as const)(
      "rolls back retry when the linked delivery is %s",
      async (status) => {
        const f = await fixture();
        await prisma.notificationDelivery.update({
          where: { id: f.delivery.id },
          data: { status, deliveredAt: status === "PUBLISHED" ? new Date() : null },
        });
        await expect(retry(f.event.id)).rejects.toMatchObject({ code: "CONFLICT" });
        expect(
          await prisma.outboxEvent.findUniqueOrThrow({ where: { id: f.event.id } }),
        ).toMatchObject({ status: "DEAD_LETTER", lastError: "CHANNEL_DISABLED" });
        expect(
          await prisma.notificationDelivery.findUniqueOrThrow({
            where: { id: f.delivery.id },
          }),
        ).toMatchObject({ status });
        expect(await prisma.auditLog.count({ where: { entityId: f.event.id } })).toBe(0);
      },
    );

    it("does not create an unclaimable pending job when its delivery record is missing", async () => {
      const f = await fixture();
      await prisma.notificationDelivery.delete({ where: { id: f.delivery.id } });
      await expect(retry(f.event.id)).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: f.event.id } }))
          .status,
      ).toBe("DEAD_LETTER");
    });

    it("rejects mismatched delivery attempts without changing either record", async () => {
      const f = await fixture();
      await prisma.notificationDelivery.update({
        where: { id: f.delivery.id },
        data: { attempts: 1 },
      });
      await expect(retry(f.event.id)).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        await prisma.outboxEvent.findUniqueOrThrow({ where: { id: f.event.id } }),
      ).toMatchObject({ status: "DEAD_LETTER", attempts: 0 });
      expect(
        await prisma.notificationDelivery.findUniqueOrThrow({
          where: { id: f.delivery.id },
        }),
      ).toMatchObject({ status: "DEAD_LETTER", attempts: 1 });
      expect(await prisma.auditLog.count({ where: { entityId: f.event.id } })).toBe(0);
    });

    it("preserves the accumulated attempt count when manually retrying an exhausted job", async () => {
      const f = await fixture();
      await prisma.$transaction([
        prisma.outboxEvent.update({ where: { id: f.event.id }, data: { attempts: 8 } }),
        prisma.notificationDelivery.update({
          where: { id: f.delivery.id },
          data: { attempts: 8 },
        }),
      ]);
      await retry(f.event.id, 8);
      const keys: string[] = [];
      await new NotificationDeliveryWorker(
        {
          async send(message) {
            keys.push(message.idempotencyKey);
            throw new Error("Synthetic provider outage");
          },
        },
        null,
        prisma,
      ).runOnce(100);
      expect(keys).toContain(f.event.eventId);
      expect(
        await prisma.outboxEvent.findUniqueOrThrow({ where: { id: f.event.id } }),
      ).toMatchObject({ status: "DEAD_LETTER", attempts: 9 });
      expect(
        await prisma.notificationDelivery.findUniqueOrThrow({
          where: { id: f.delivery.id },
        }),
      ).toMatchObject({ status: "DEAD_LETTER", attempts: 9 });
    });

    it("enforces authentication, roles, MFA, CSRF and request bounds before changing jobs", async () => {
      const f = await fixture();
      const path = `/api/v1/admin/operations/jobs/outbox/${f.event.id}/retry`;
      const body = { expectedAttempts: 0, reason: "Synthetic retry" };
      expect((await request(app).post(path).send(body)).status).toBe(401);
      for (const role of ["CUSTOMER", "STAFF"] as const) {
        const user = await prisma.user.create({
          data: {
            email: `retry-denied-${randomUUID()}@example.test`,
            passwordHash: "unusable",
            role,
          },
        });
        const response = await request(app)
          .post(path)
          .set(
            await headers({ ...administrator, userId: user.id, email: user.email, role }),
          )
          .send(body);
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe("FORBIDDEN");
      }
      const pendingMfa = await request(app)
        .post(path)
        .set(await headers({ ...administrator, mfaVerifiedAt: null }))
        .send(body);
      expect(pendingMfa.status).toBe(403);
      expect(pendingMfa.body.error.code).toBe("MFA_REQUIRED");
      const validHeaders = await headers(administrator);
      const missingCsrf = await request(app)
        .post(path)
        .set({ Origin: validHeaders.Origin, Cookie: validHeaders.Cookie })
        .send(body);
      expect(missingCsrf.status).toBe(403);
      expect(missingCsrf.body.error.code).toBe("CSRF_INVALID");
      for (const expectedAttempts of [-1, 0.5, 1_001]) {
        const response = await request(app)
          .post(path)
          .set(validHeaders)
          .send({ ...body, expectedAttempts });
        expect(response.status).toBe(422);
      }
      expect(
        await prisma.outboxEvent.findUniqueOrThrow({ where: { id: f.event.id } }),
      ).toMatchObject({ status: "DEAD_LETTER", attempts: 0 });
      expect(
        await prisma.notificationDelivery.findUniqueOrThrow({
          where: { id: f.delivery.id },
        }),
      ).toMatchObject({ status: "DEAD_LETTER", attempts: 0 });
      expect(await prisma.auditLog.count({ where: { entityId: f.event.id } })).toBe(0);
    });

    it("rechecks recipient consent after an administrator retry", async () => {
      const f = await fixture("EMAIL", "OPERATIONAL");
      await prisma.notificationPreference.create({
        data: {
          userId: f.recipient.id,
          category: "OPERATIONAL",
          channel: "EMAIL",
          enabled: false,
        },
      });
      await retry(f.event.id);
      let sent = 0;
      await new NotificationDeliveryWorker(
        {
          async send() {
            sent++;
          },
        },
        null,
        prisma,
      ).runOnce(100);
      expect(sent).toBe(0);
      expect(
        await prisma.notificationDelivery.findUniqueOrThrow({
          where: { id: f.delivery.id },
        }),
      ).toMatchObject({
        status: "DEAD_LETTER",
        lastErrorCode: "CONSENT_WITHDRAWN",
        attempts: 1,
      });
    });
  },
);
