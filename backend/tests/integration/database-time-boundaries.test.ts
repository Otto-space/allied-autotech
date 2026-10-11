import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Options } from "express-rate-limit";
import { prisma } from "../../src/config/database.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { PostgresRateLimitStore } from "../../src/common/middleware/postgres-rate-limit-store.js";
import { IdentityOutboxWorker } from "../../src/workers/outbox.worker.js";
import { ExpirationWorker } from "../../src/workers/expiration.worker.js";
import { BookingReminderWorker } from "../../src/workers/booking-reminder.worker.js";
import { PaymentWebhookRetryWorker } from "../../src/workers/webhook-retry.worker.js";
import { OperationalAlertsWorker } from "../../src/workers/operational-alerts.worker.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { providerUnavailable } from "../../src/common/errors/provider-error-mapper.js";
import { databaseTimezones, timezoneDatabase } from "../helpers/timezone-database.js";

const hash = () => hashToken("session", randomUUID());
const nowOffset = (ms: number) => new Date(Date.now() + ms);
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "UTC database boundaries",
  () => {
    afterAll(async () => prisma.$disconnect());
    it("uses UTC for every connection in the application pool, including database defaults", async () => {
      const rows = await prisma.$queryRaw<Array<{ zone: string; timestamp: Date }>>`
      SELECT current_setting('TimeZone') AS zone, CURRENT_TIMESTAMP::timestamp AS timestamp`;
      expect(rows[0]?.zone).toBe("UTC");
      expect(Math.abs(rows[0]!.timestamp.getTime() - Date.now())).toBeLessThan(5_000);
    });
    for (const timezone of databaseTimezones) {
      describe(timezone, () => {
        const database = timezoneDatabase(timezone);
        afterAll(async () => database.$disconnect());
        it.each(["throttle", "mfa", "invitation"] as const)(
          "cleans only expired %s records",
          async (kind) => {
            const user = await prisma.user.create({
              data: {
                email: `${randomUUID()}@example.test`,
                passwordHash: "unusable",
                role: "ADMIN",
              },
            });
            const session = await prisma.session.create({
              data: {
                userId: user.id,
                tokenHash: hash(),
                expiresAt: nowOffset(3_600_000),
                idleExpiresAt: nowOffset(3_600_000),
              },
            });
            const create = async (expired: boolean) => {
              const expiresAt = nowOffset(
                (kind === "invitation" ? -30 * 86_400_000 : 0) +
                  (expired ? -300_000 : 300_000),
              );
              const createdAt = new Date(expiresAt.getTime() - 86_400_000);
              if (kind === "throttle")
                return prisma.authenticationThrottle.create({
                  data: { keyHash: hash(), createdAt, expiresAt, failedCount: 5 },
                });
              if (kind === "mfa")
                return prisma.mfaChallenge.create({
                  data: {
                    userId: user.id,
                    sessionId: session.id,
                    purpose: "AUTHENTICATION",
                    challengeHash: hash(),
                    createdAt,
                    expiresAt,
                  },
                });
              const recipient = await prisma.user.create({
                data: { email: `${randomUUID()}@example.test`, passwordHash: "unusable" },
              });
              return prisma.privilegedInvitation.create({
                data: {
                  email: recipient.email,
                  role: "ADMIN",
                  tokenHash: hash(),
                  invitedById: user.id,
                  recipientId: recipient.id,
                  createdAt,
                  expiresAt,
                },
              });
            };
            const expired = await create(true),
              retained = await create(false);
            await new IdentityOutboxWorker(null, database).cleanupExpiredIdentityState(
              2000,
            );
            const remaining =
              kind === "throttle"
                ? await prisma.authenticationThrottle.findMany({
                    where: { id: { in: [expired.id, retained.id] } },
                  })
                : kind === "mfa"
                  ? await prisma.mfaChallenge.findMany({
                      where: { id: { in: [expired.id, retained.id] } },
                    })
                  : await prisma.privilegedInvitation.findMany({
                      where: { id: { in: [expired.id, retained.id] } },
                    });
            expect(remaining.map((row) => row.id)).toEqual([retained.id]);
          },
        );

        it("retains unexpired idempotency receipts", async () => {
          const create = (offset: number) =>
            prisma.idempotencyRecord.create({
              data: {
                scope: "timezone-test",
                keyHash: hash(),
                requestHash: hash(),
                createdAt: nowOffset(-86_400_000),
                expiresAt: nowOffset(offset),
              },
            });
          const expired = await create(-300_000),
            retained = await create(300_000);
          await new ExpirationWorker(database).runOnce(100);
          const rows = await prisma.idempotencyRecord.findMany({
            where: { id: { in: [expired.id, retained.id] } },
          });
          expect(rows.map((row) => row.id)).toEqual([retained.id]);
        });

        it("returns the actual rate-limit reset time and shares one window across timezones", async () => {
          const scope = randomUUID(),
            key = randomUUID();
          const store = new PostgresRateLimitStore(scope, database);
          const utcStore = new PostgresRateLimitStore(scope, prisma);
          store.init({ windowMs: 60_000 } as Options);
          utcStore.init({ windowMs: 60_000 } as Options);
          const before = Date.now();
          const first = await store.increment(key);
          expect(first.totalHits).toBe(1);
          expect(first.resetTime.getTime()).toBeGreaterThanOrEqual(before + 59_000);
          expect(first.resetTime.getTime()).toBeLessThanOrEqual(Date.now() + 61_000);
          expect(await utcStore.increment(key)).toEqual({
            totalHits: 2,
            resetTime: first.resetTime,
          });
          expect(await store.increment(key)).toEqual({
            totalHits: 3,
            resetTime: first.resetTime,
          });
          await prisma.rateLimitBucket.update({
            where: { key: hashToken("rate-limit", `${scope}:${key}`) },
            data: { resetAt: nowOffset(-300_000) },
          });
          expect((await store.increment(key)).totalHits).toBe(1);
        });

        it("honors webhook retry deadlines, fresh leases and backoff", async () => {
          const event = await prisma.paymentWebhookEvent.create({
            data: {
              provider: "PAYSTACK",
              signatureVerifiedAt: new Date(),
              eventType: "charge.success",
              deduplicationKey: hash(),
              payloadSha256: hash(),
              status: "FAILED",
              failedAt: new Date(),
              nextAttemptAt: nowOffset(300_000),
              receivedAt: new Date(0),
              redactedPayload: {
                eventType: "charge.success",
                providerEventId: null,
                resourceId: null,
                reference: randomUUID(),
                status: "success",
                amountKobo: "100",
                currency: "NGN",
                gatewayTransactionId: null,
                paidAt: null,
                providerFeeKobo: null,
                method: null,
                category: null,
                responseDueAt: null,
              },
            },
          });
          const service = new PaymentsService(database);
          const ingest = vi
            .spyOn(service, "ingestWebhook")
            .mockRejectedValue(providerUnavailable());
          const worker = new PaymentWebhookRetryWorker(database, service);
          const ownCalls = () =>
            ingest.mock.calls.filter(([, digest]) => digest === event.payloadSha256);
          try {
            await worker.runOnce(1);
            expect(ownCalls()).toHaveLength(0);
            await prisma.paymentWebhookEvent.update({
              where: { id: event.id },
              data: { status: "PROCESSING", lockedAt: new Date() },
            });
            await worker.runOnce(1);
            expect(ownCalls()).toHaveLength(0);
            await prisma.paymentWebhookEvent.update({
              where: { id: event.id },
              data: { lockedAt: new Date(0) },
            });
            await worker.runOnce(1);
            expect(ownCalls()).toHaveLength(1);
            const failed = await prisma.paymentWebhookEvent.findUniqueOrThrow({
              where: { id: event.id },
            });
            expect(failed).toMatchObject({ status: "FAILED", processingAttempts: 1 });
            await worker.runOnce(1);
            expect(ownCalls()).toHaveLength(1);
            expect(
              await prisma.paymentWebhookEvent.findUniqueOrThrow({
                where: { id: event.id },
              }),
            ).toEqual(failed);
          } finally {
            await prisma.paymentWebhookEvent.update({
              where: { id: event.id },
              data: { status: "DEAD_LETTER", lockedAt: null },
            });
            ingest.mockRestore();
          }
        });

        it("does not enqueue reminders before their schedule or reclaim fresh leases", async () => {
          const user = await prisma.user.create({
            data: {
              email: `${randomUUID()}@example.test`,
              passwordHash: "unusable",
              profile: {
                create: { firstName: "Time", lastName: "Test", phone: "+2348000000000" },
              },
            },
            include: { profile: true },
          });
          const service = await prisma.service.create({
            data: {
              name: "Time fixture",
              slug: randomUUID(),
              pricingType: "QUOTE_REQUIRED",
            },
          });
          const booking = await prisma.booking.create({
            data: {
              customerId: user.profile!.id,
              serviceId: service.id,
              scheduledAt: nowOffset(86_400_000),
            },
          });
          const reminder = await prisma.bookingReminder.create({
            data: {
              bookingId: booking.id,
              kind: "ONE_HOUR",
              scheduleVersion: booking.scheduleVersion,
              scheduledFor: nowOffset(300_000),
            },
          });
          const worker = new BookingReminderWorker(database);
          try {
            await worker.runOnce(100);
            expect(
              await prisma.bookingReminder.findUniqueOrThrow({
                where: { id: reminder.id },
              }),
            ).toMatchObject({ status: "PENDING", attempts: 0 });
            await prisma.bookingReminder.update({
              where: { id: reminder.id },
              data: { status: "PROCESSING", lockedAt: new Date() },
            });
            await worker.runOnce(100);
            expect(
              await prisma.bookingReminder.findUniqueOrThrow({
                where: { id: reminder.id },
              }),
            ).toMatchObject({ status: "PROCESSING", attempts: 0 });
            await prisma.bookingReminder.update({
              where: { id: reminder.id },
              data: { lockedAt: new Date(0) },
            });
            await worker.runOnce(100);
            expect(
              await prisma.bookingReminder.findUniqueOrThrow({
                where: { id: reminder.id },
              }),
            ).toMatchObject({ status: "CANCELLED", attempts: 1 });
            expect(
              await prisma.notification.count({ where: { resourceId: booking.id } }),
            ).toBe(0);
          } finally {
            await prisma.bookingReminder.update({
              where: { id: reminder.id },
              data: { status: "CANCELLED", cancelledAt: new Date(), lockedAt: null },
            });
          }
        });

        it("records alert resolution as a UTC instant", async () => {
          const complaint = await prisma.complaint.create({
            data: {
              name: "Time test",
              email: "time@example.test",
              subject: "Synthetic",
              description: "Synthetic clock case",
              acknowledgedAt: new Date(),
            },
          });
          const alert = await prisma.operationalAlert.create({
            data: {
              key: randomUUID(),
              category: "URGENT_COMPLAINT_OVERDUE",
              resourceId: complaint.id,
              message: "Synthetic",
            },
          });
          const before = Date.now();
          await new OperationalAlertsWorker(database).runOnce();
          const resolved = await prisma.operationalAlert.findUniqueOrThrow({
            where: { id: alert.id },
          });
          expect(resolved.resolvedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
          expect(resolved.resolvedAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
        });
      });
    }
  },
);
