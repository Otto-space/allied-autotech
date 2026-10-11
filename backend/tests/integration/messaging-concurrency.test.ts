import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { createNodePostgresSslConfiguration } from "../../src/config/database-tls.js";
import { encryptIdentityPayload } from "../../src/common/security/mfa-encryption.js";
import { identityEventTypes } from "../../src/modules/identity/identity.events.js";
import { enqueueNotification } from "../../src/modules/notifications/notifications.service.js";
import type { EmailProvider } from "../../src/providers/messaging/email-provider.port.js";
import { IdentityOutboxWorker } from "../../src/workers/outbox.worker.js";
import { NotificationDeliveryWorker } from "../../src/workers/notification.worker.js";

type Kind = "identity" | "notification";
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
function worker(kind: Kind, provider: EmailProvider, database = prisma) {
  return kind === "identity"
    ? new IdentityOutboxWorker(provider, database)
    : new NotificationDeliveryWorker(provider, null, database);
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "messaging claim ownership",
  () => {
    const jobs: string[] = [];
    afterEach(async () => {
      await prisma.outboxEvent.updateMany({
        where: { id: { in: jobs }, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
        data: { status: "DEAD_LETTER", lockedAt: null },
      });
      jobs.length = 0;
    });
    afterAll(async () => prisma.$disconnect());

    async function fixture(kind: Kind, order = 1) {
      const user = await prisma.user.create({
        data: { email: `claim-${randomUUID()}@example.test`, passwordHash: "unusable" },
      });
      if (kind === "identity") {
        const encrypted = encryptIdentityPayload({
          template: "verify-email",
          to: user.email,
          link: "http://localhost:3000/verify-email#token=synthetic-concurrency-token",
        });
        const event = await prisma.outboxEvent.create({
          data: {
            eventId: randomUUID(),
            aggregateType: "User",
            aggregateId: user.id,
            eventType: identityEventTypes.verificationEmailRequested,
            payload: { encrypted: { ...encrypted } },
            createdAt: new Date(order * 1000),
          },
        });
        jobs.push(event.id);
        return event;
      }
      const notification = await prisma.$transaction((tx) =>
        enqueueNotification(tx, {
          userId: user.id,
          type: "SYSTEM",
          category: "TRANSACTIONAL",
          title: "Synthetic concurrency",
          message: "Synthetic notification",
          deduplicationKey: randomUUID(),
          channels: ["EMAIL"],
        }),
      );
      const delivery = await prisma.notificationDelivery.findFirstOrThrow({
        where: { notificationId: notification.id, channel: "EMAIL" },
      });
      const [event] = await prisma.$transaction([
        prisma.outboxEvent.update({
          where: { id: delivery.outboxEventId! },
          data: { status: "PENDING", lastError: null, createdAt: new Date(order * 1000) },
        }),
        prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: { status: "PENDING", lastErrorCode: null },
        }),
      ]);
      jobs.push(event.id);
      return event;
    }
    const snapshot = (id: string) =>
      prisma.outboxEvent.findUniqueOrThrow({
        where: { id },
        include: { notificationDelivery: true },
      });

    for (const kind of ["identity", "notification"] as const) {
      it.each(["success", "failure"] as const)(
        `${kind}: stale %s leaves a newer in-flight claim intact`,
        async (outcome) => {
          const event = await fixture(kind);
          const oldStarted = gate(),
            oldFinish = gate(),
            newStarted = gate(),
            newFinish = gate();
          const keys: string[] = [];
          const oldRun = worker(kind, {
            async send(message) {
              keys.push(message.idempotencyKey);
              oldStarted.release();
              await oldFinish.promise;
              if (outcome === "failure") throw new Error("Synthetic late failure");
            },
          }).runOnce(1);
          let newRun: Promise<number> | undefined;
          try {
            await oldStarted.promise;
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: { lockedAt: new Date(0) },
            });
            newRun = worker(kind, {
              async send(message) {
                keys.push(message.idempotencyKey);
                newStarted.release();
                await newFinish.promise;
              },
            }).runOnce(1);
            await newStarted.promise;
            const owned = await snapshot(event.id);
            expect(owned).toMatchObject({ status: "PROCESSING", attempts: 2 });
            oldFinish.release();
            await oldRun;
            expect(await snapshot(event.id)).toEqual(owned);
            newFinish.release();
            await newRun;
            const completed = await snapshot(event.id);
            expect(completed).toMatchObject({
              status: "PUBLISHED",
              attempts: 2,
              lockedAt: null,
            });
            if (kind === "notification")
              expect(completed.notificationDelivery).toMatchObject({
                status: "PUBLISHED",
                attempts: 2,
                deliveredAt: expect.any(Date),
              });
            expect(keys).toEqual([event.eventId, event.eventId]);
          } finally {
            oldFinish.release();
            newFinish.release();
            await Promise.allSettled([oldRun, ...(newRun ? [newRun] : [])]);
          }
        },
      );

      it(`${kind}: does not dispatch stale items retained in a batch after another worker completed them`, async () => {
        const first = await fixture(kind, 1),
          second = await fixture(kind, 2);
        const oldSent: string[] = [],
          newSent: string[] = [];
        await worker(kind, {
          async send(message) {
            oldSent.push(message.idempotencyKey);
            if (oldSent.length !== 1) return;
            await prisma.outboxEvent.updateMany({
              where: { id: { in: [first.id, second.id] } },
              data: { lockedAt: new Date(0) },
            });
            await worker(kind, {
              async send(replacement) {
                newSent.push(replacement.idempotencyKey);
              },
            }).runOnce(2);
          },
        }).runOnce(2);
        expect(oldSent).toHaveLength(1);
        expect(newSent.sort()).toEqual([first.eventId, second.eventId].sort());
        for (const event of [first, second])
          expect(await snapshot(event.id)).toMatchObject({
            status: "PUBLISHED",
            attempts: 2,
          });
      });
      it.each(["UTC", "Africa/Lagos", "America/New_York"])(
        `${kind}: respects scheduling, leases and retry backoff in database timezone %s`,
        async (timezone) => {
          const database = new PrismaClient({
            adapter: new PrismaPg({
              host: env.DB_HOST,
              port: env.DB_PORT,
              database: env.DB_NAME,
              user: env.DB_USER,
              password: env.DB_PASSWORD,
              ssl: createNodePostgresSslConfiguration(env),
              max: 1,
              options: `-c timezone=${timezone}`,
            }),
          });
          const event = await fixture(kind);
          const keys: string[] = [];
          const runner = worker(
            kind,
            {
              async send(message) {
                keys.push(message.idempotencyKey);
                throw new Error("Synthetic retryable failure");
              },
            },
            database,
          );
          try {
            const zone = await database.$queryRaw<
              Array<{ timezone: string }>
            >`SELECT current_setting('TimeZone') AS timezone`;
            expect(zone[0]?.timezone).toBe(timezone);
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: { availableAt: new Date(Date.now() + 300_000) },
            });
            await runner.runOnce(1);
            expect(keys).not.toContain(event.eventId);
            expect(await snapshot(event.id)).toMatchObject({
              status: "PENDING",
              attempts: 0,
            });
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: { status: "PROCESSING", attempts: 1, lockedAt: new Date() },
            });
            if (kind === "notification")
              await prisma.notificationDelivery.update({
                where: { outboxEventId: event.id },
                data: { status: "PROCESSING", attempts: 1 },
              });
            await runner.runOnce(1);
            expect(keys).not.toContain(event.eventId);
            expect(await snapshot(event.id)).toMatchObject({
              status: "PROCESSING",
              attempts: 1,
            });
            await prisma.outboxEvent.update({
              where: { id: event.id },
              data: { lockedAt: new Date(0) },
            });
            await runner.runOnce(1);
            const failed = await snapshot(event.id);
            expect(failed).toMatchObject({
              status: "FAILED",
              attempts: 2,
              lockedAt: null,
            });
            expect(failed.availableAt.getTime()).toBeGreaterThan(Date.now());
            expect(keys.filter((key) => key === event.eventId)).toHaveLength(1);
            await runner.runOnce(1);
            expect(keys.filter((key) => key === event.eventId)).toHaveLength(1);
            expect(await snapshot(event.id)).toEqual(failed);
          } finally {
            await database.$disconnect();
          }
        },
      );
    }

    it.each(["success", "failure"] as const)(
      "notification: %s cannot partially finalize an inconsistent delivery",
      async (outcome) => {
        const event = await fixture("notification");
        let interrupted: Awaited<ReturnType<typeof snapshot>> | undefined;
        await worker("notification", {
          async send() {
            await prisma.notificationDelivery.update({
              where: { outboxEventId: event.id },
              data: { attempts: 2 },
            });
            interrupted = await snapshot(event.id);
            if (outcome === "failure")
              throw new Error("Synthetic failure after delivery state changed");
          },
        }).runOnce(1);
        expect(interrupted).toBeDefined();
        expect(await snapshot(event.id)).toEqual(interrupted);
      },
    );
  },
);
