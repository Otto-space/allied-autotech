import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { prisma } from "../../src/config/database.js";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import { BookingReminderWorker } from "../../src/workers/booking-reminder.worker.js";
import { NotificationDeliveryWorker } from "../../src/workers/notification.worker.js";
import { encryptNotificationPayload } from "../../src/common/security/mfa-encryption.js";
import type { TransactionalEmail } from "../../src/providers/messaging/email-provider.port.js";
import { scheduleReminders } from "../../src/modules/service-operations/service-operations.service.js";

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

// Delay entry to the real transaction to reproduce a paused worker without
// mocking its claim SQL, row locks, notification writes or completion writes.
function delayedDatabase(before: () => Promise<void>, rollback = false): PrismaClient {
  return new Proxy(prisma, {
    get(target, property) {
      if (property === "$transaction")
        return async (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
          await before();
          return target.$transaction(async (tx) => {
            const result = await operation(tx);
            if (rollback) throw new Error("Synthetic transaction rollback");
            return result;
          });
        };
      return Reflect.get(target, property);
    },
  });
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Booking reminder claim ownership",
  () => {
    const jobs: string[] = [];
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterEach(async () => {
      await prisma.bookingReminder.updateMany({
        where: { id: { in: jobs }, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
        data: { status: "DEAD_LETTER", lockedAt: null },
      });
      jobs.length = 0;
    });
    afterAll(() => prisma.$disconnect());

    async function fixture(confirmed = true, attempts = 0) {
      const user = await prisma.user.create({
        data: {
          email: `reminder-${randomUUID()}@example.test`,
          passwordHash: "unusable",
          profile: {
            create: { firstName: "Reminder", lastName: "Test", phone: "+2348000000000" },
          },
        },
        include: { profile: true },
      });
      const service = await prisma.service.create({
        data: {
          name: "Reminder test",
          slug: randomUUID(),
          pricingType: "QUOTE_REQUIRED",
        },
      });
      const booking = await prisma.booking.create({
        data: {
          customerId: user.profile!.id,
          serviceId: service.id,
          scheduledAt: new Date(Date.now() + 3_600_000),
          ...(confirmed ? { status: "CONFIRMED", confirmedAt: new Date() } : {}),
        },
      });
      const reminder = await prisma.bookingReminder.create({
        data: {
          bookingId: booking.id,
          kind: "ONE_HOUR",
          scheduleVersion: booking.scheduleVersion,
          scheduledFor: new Date(0),
          attempts,
        },
      });
      jobs.push(reminder.id);
      return { booking, reminder, user };
    }
    const snapshot = (id: string) =>
      prisma.bookingReminder.findUniqueOrThrow({ where: { id } });
    const notificationCount = (bookingId: string) =>
      prisma.notification.count({ where: { resourceId: bookingId } });

    it("uses the saved policy, skips missed custom notices and deduplicates the remainder", async () => {
      const f = await fixture();
      const policy = await prisma.businessPolicyVersion.create({
        data: {
          key: `booking-capacity:${randomUUID()}`,
          version: 1,
          approvalStatus: "APPROVED",
          source: "Synthetic isolated reminder approval",
          sourceQuestion: "D15 isolated fixture",
          approvedByUserId: f.user.id,
          effectiveAt: new Date(0),
          settings: { reminderMinutes: [120, 20, 5] },
        },
      });
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { capacityPolicyVersionId: policy.id },
      });
      // A later policy must not replace the approval saved on this appointment.
      await prisma.businessPolicyVersion.create({
        data: {
          key: policy.key,
          version: 2,
          approvalStatus: "APPROVED",
          source: "Synthetic later version",
          sourceQuestion: "D15 isolated fixture",
          approvedByUserId: f.user.id,
          effectiveAt: new Date(),
          settings: { reminderMinutes: [] },
        },
      });
      await prisma.$transaction((tx) => scheduleReminders(tx, f.booking));
      await prisma.$transaction((tx) => scheduleReminders(tx, f.booking));
      const rows = await prisma.bookingReminder.findMany({
        where: {
          bookingId: f.booking.id,
          kind: { in: ["NOTICE_1", "NOTICE_2", "NOTICE_3"] },
        },
        orderBy: { scheduledFor: "asc" },
      });
      expect(
        rows.map((row) => [
          row.kind,
          (f.booking.scheduledAt.getTime() - row.scheduledFor.getTime()) / 60000,
        ]),
      ).toEqual([
        ["NOTICE_2", 20],
        ["NOTICE_3", 5],
      ]);
      jobs.push(...rows.map((row) => row.id));
    });

    it("an explicitly empty saved reminder schedule creates no notices", async () => {
      const f = await fixture();
      const policy = await prisma.businessPolicyVersion.create({
        data: {
          key: `booking-capacity:${randomUUID()}`,
          version: 1,
          approvalStatus: "APPROVED",
          source: "Synthetic disabled reminder approval",
          sourceQuestion: "D15 isolated fixture",
          approvedByUserId: f.user.id,
          effectiveAt: new Date(0),
          settings: { reminderMinutes: [] },
        },
      });
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { capacityPolicyVersionId: policy.id },
      });
      await prisma.$transaction((tx) => scheduleReminders(tx, f.booking));
      expect(
        await prisma.bookingReminder.count({ where: { bookingId: f.booking.id } }),
      ).toBe(1);
      expect(
        await prisma.bookingReminder.findUniqueOrThrow({ where: { id: f.reminder.id } }),
      ).toMatchObject({ kind: "ONE_HOUR", status: "PENDING" });
    });

    it("bounds the shared inbox and push notification by the appointment time", async () => {
      const f = await fixture();
      expect(await new BookingReminderWorker().runOnce(1)).toEqual({
        sent: 1,
        cancelled: 0,
      });
      const notification = await prisma.notification.findFirstOrThrow({
        where: { resourceType: "BOOKING", resourceId: f.booking.id },
      });
      expect(notification.expiresAt).toEqual(f.booking.scheduledAt);
      expect(await notificationCount(f.booking.id)).toBe(1);
    });

    it("shows Nigeria time when its calendar date differs from UTC", async () => {
      const f = await fixture();
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { scheduledAt: new Date("2048-12-31T23:30:00Z") },
      });
      expect(await new BookingReminderWorker().runOnce(1)).toEqual({
        sent: 1,
        cancelled: 0,
      });
      const notification = await prisma.notification.findFirstOrThrow({
        where: { resourceId: f.booking.id },
      });
      expect(notification.message).toContain("1 January 2049");
      expect(notification.message).toContain("00:30");
      expect(notification.message).toContain("Nigeria time");
      expect(notification.message).not.toContain("2048-12-31T23:30");
    });

    it("cancels a delayed reminder after appointment time without recording absence", async () => {
      const f = await fixture();
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { scheduledAt: new Date(Date.now() - 60_000) },
      });
      expect(await new BookingReminderWorker().runOnce(1)).toEqual({
        sent: 0,
        cancelled: 1,
      });
      expect(await snapshot(f.reminder.id)).toMatchObject({
        status: "CANCELLED",
        lastErrorCode: "APPOINTMENT_TIME_PASSED",
        lockedAt: null,
        nextAttemptAt: null,
        sentAt: null,
      });
      expect(await notificationCount(f.booking.id)).toBe(0);
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toMatchObject({
        status: "CONFIRMED",
        scheduleVersion: f.booking.scheduleVersion,
      });
      expect(await new BookingReminderWorker().runOnce(1)).toEqual({
        sent: 0,
        cancelled: 0,
      });
    });

    it.each([false, true])(
      "rechecks appointment time before the provider boundary (future=%s)",
      async (future) => {
        const f = await fixture();
        const notification = await prisma.notification.create({
          data: {
            userId: f.user.id,
            type: "BOOKING",
            category: "TRANSACTIONAL",
            title: "Synthetic appointment reminder",
            message: "Controlled provider-boundary test; no external delivery.",
            resourceType: "BOOKING",
            resourceId: f.booking.id,
          },
        });
        const eventId = randomUUID();
        const outbox = await prisma.outboxEvent.create({
          data: {
            eventId,
            aggregateType: "Notification",
            aggregateId: notification.id,
            eventType: "notification.delivery.requested",
            payload: {
              encrypted: encryptNotificationPayload({
                channel: "EMAIL",
                recipient: f.user.email,
                title: notification.title,
                message: notification.message,
                bookingAction: {
                  url: "http://localhost:3000/api/v1/public/booking-response?token=synthetic",
                  bookingId: f.booking.id,
                  scheduleVersion: f.booking.scheduleVersion,
                },
              }),
            } as unknown as Prisma.InputJsonValue,
            notificationDelivery: {
              create: { notificationId: notification.id, channel: "EMAIL" },
            },
          },
        });
        // Only time changes: status and schedule version still match the queued job.
        await prisma.booking.update({
          where: { id: f.booking.id },
          data: { scheduledAt: new Date(Date.now() + (future ? 60_000 : -60_000)) },
        });
        const sent: TransactionalEmail[] = [];
        await new NotificationDeliveryWorker(
          {
            async send(message) {
              sent.push(message);
            },
          },
          null,
          prisma,
        ).runOnce(100);
        expect(sent.filter((message) => message.idempotencyKey === eventId)).toHaveLength(
          future ? 1 : 0,
        );
        expect(
          await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outbox.id } }),
        ).toMatchObject({
          status: future ? "PUBLISHED" : "DEAD_LETTER",
          lastError: future ? null : "STALE_BOOKING_REMINDER",
        });
        expect(
          await prisma.notificationDelivery.findUniqueOrThrow({
            where: { outboxEventId: outbox.id },
          }),
        ).toMatchObject({
          status: future ? "PUBLISHED" : "DEAD_LETTER",
          lastErrorCode: future ? null : "STALE_BOOKING_REMINDER",
        });
        expect(
          await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
        ).toMatchObject({
          status: "CONFIRMED",
          scheduleVersion: f.booking.scheduleVersion,
        });
        expect(
          await prisma.bookingAttendanceEvent.count({
            where: { bookingId: f.booking.id },
          }),
        ).toBe(0);
        expect(
          await new NotificationDeliveryWorker(
            {
              async send(message) {
                sent.push(message);
              },
            },
            null,
            prisma,
          ).runOnce(100),
        ).toBe(0);
        expect(sent.filter((message) => message.idempotencyKey === eventId)).toHaveLength(
          future ? 1 : 0,
        );
      },
    );

    for (const confirmed of [true, false]) {
      it.each(["success", "failure"] as const)(
        `stale %s preserves a newer claim (${confirmed ? "confirmed" : "requested"} booking)`,
        async (outcome) => {
          const f = await fixture(confirmed);
          const oldStarted = gate(),
            oldFinish = gate(),
            newStarted = gate(),
            newFinish = gate();
          const oldRun = new BookingReminderWorker(
            delayedDatabase(async () => {
              oldStarted.release();
              await oldFinish.promise;
              if (outcome === "failure") throw new Error("Synthetic delayed failure");
            }),
          ).runOnce(1);
          let newRun: ReturnType<BookingReminderWorker["runOnce"]> | undefined;
          try {
            await oldStarted.promise;
            await prisma.bookingReminder.update({
              where: { id: f.reminder.id },
              data: { lockedAt: new Date(0) },
            });
            newRun = new BookingReminderWorker(
              delayedDatabase(async () => {
                newStarted.release();
                await newFinish.promise;
              }),
            ).runOnce(1);
            await newStarted.promise;
            const owned = await snapshot(f.reminder.id);
            expect(owned).toMatchObject({ status: "PROCESSING", attempts: 2 });
            oldFinish.release();
            expect(await oldRun).toEqual({ sent: 0, cancelled: 0 });
            expect(await snapshot(f.reminder.id)).toEqual(owned);
            expect(await notificationCount(f.booking.id)).toBe(0);
            newFinish.release();
            expect(await newRun).toEqual(
              confirmed ? { sent: 1, cancelled: 0 } : { sent: 0, cancelled: 1 },
            );
            expect(await snapshot(f.reminder.id)).toMatchObject({
              status: confirmed ? "SENT" : "CANCELLED",
              attempts: 2,
              lockedAt: null,
            });
            expect(await notificationCount(f.booking.id)).toBe(confirmed ? 1 : 0);
            expect(await new BookingReminderWorker().runOnce(1)).toEqual({
              sent: 0,
              cancelled: 0,
            });
            expect(await notificationCount(f.booking.id)).toBe(confirmed ? 1 : 0);
          } finally {
            oldFinish.release();
            newFinish.release();
            await Promise.allSettled([oldRun, ...(newRun ? [newRun] : [])]);
          }
        },
      );
    }

    it("rolls back notification enqueue and retries the owned attempt with backoff", async () => {
      const f = await fixture();
      const start = Date.now();
      await new BookingReminderWorker(delayedDatabase(async () => {}, true)).runOnce(1);
      const failed = await snapshot(f.reminder.id);
      expect(failed).toMatchObject({
        status: "FAILED",
        attempts: 1,
        lockedAt: null,
        sentAt: null,
      });
      expect(failed.nextAttemptAt!.getTime()).toBeGreaterThanOrEqual(start + 60_000);
      expect(failed.nextAttemptAt!.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
      expect(await notificationCount(f.booking.id)).toBe(0);
      await new BookingReminderWorker().runOnce(1);
      expect(await snapshot(f.reminder.id)).toEqual(failed);
      await prisma.bookingReminder.update({
        where: { id: f.reminder.id },
        data: { nextAttemptAt: new Date(0) },
      });
      expect(await new BookingReminderWorker().runOnce(1)).toEqual({
        sent: 1,
        cancelled: 0,
      });
      expect(await notificationCount(f.booking.id)).toBe(1);
    });

    it("preserves a fresh eighth attempt and dead-letters it only after lease expiry", async () => {
      const f = await fixture(true, 7);
      const started = gate(),
        finish = gate();
      const run = new BookingReminderWorker(
        delayedDatabase(async () => {
          started.release();
          await finish.promise;
        }),
      ).runOnce(1);
      try {
        await started.promise;
        const active = await snapshot(f.reminder.id);
        expect(active).toMatchObject({ status: "PROCESSING", attempts: 8 });
        await new BookingReminderWorker().runOnce(1);
        expect(await snapshot(f.reminder.id)).toEqual(active);
        await prisma.bookingReminder.update({
          where: { id: f.reminder.id },
          data: { lockedAt: new Date(0) },
        });
        await new BookingReminderWorker().runOnce(1);
        expect(await snapshot(f.reminder.id)).toMatchObject({
          status: "DEAD_LETTER",
          attempts: 8,
          lockedAt: null,
        });
        finish.release();
        expect(await run).toEqual({ sent: 0, cancelled: 0 });
        expect(await notificationCount(f.booking.id)).toBe(0);
      } finally {
        finish.release();
        await run;
      }
    });

    it("an exhausted legacy row cannot abort a batch containing a valid reminder", async () => {
      const exhausted = await fixture(true, 20);
      const valid = await fixture();
      expect(await new BookingReminderWorker().runOnce(100)).toEqual({
        sent: 1,
        cancelled: 0,
      });
      expect(await snapshot(exhausted.reminder.id)).toMatchObject({
        status: "DEAD_LETTER",
        attempts: 20,
      });
      expect(await snapshot(valid.reminder.id)).toMatchObject({
        status: "SENT",
        attempts: 1,
      });
      expect(await notificationCount(exhausted.booking.id)).toBe(0);
    });

    it("the final owned failure is terminal while the final successful attempt enqueues", async () => {
      const failed = await fixture(true, 7);
      await new BookingReminderWorker(delayedDatabase(async () => {}, true)).runOnce(1);
      expect(await snapshot(failed.reminder.id)).toMatchObject({
        status: "DEAD_LETTER",
        attempts: 8,
        lockedAt: null,
        nextAttemptAt: null,
      });
      expect(await notificationCount(failed.booking.id)).toBe(0);
      const successful = await fixture(true, 7);
      expect(await new BookingReminderWorker().runOnce(1)).toEqual({
        sent: 1,
        cancelled: 0,
      });
      expect(await snapshot(successful.reminder.id)).toMatchObject({
        status: "SENT",
        attempts: 8,
      });
      expect(await notificationCount(successful.booking.id)).toBe(1);
    });
  },
);
