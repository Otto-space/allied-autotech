import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import { BookingReminderWorker } from "../../src/workers/booking-reminder.worker.js";

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
      return { booking, reminder };
    }
    const snapshot = (id: string) =>
      prisma.bookingReminder.findUniqueOrThrow({ where: { id } });
    const notificationCount = (bookingId: string) =>
      prisma.notification.count({ where: { resourceId: bookingId } });

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
