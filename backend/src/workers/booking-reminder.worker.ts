import { env } from "../config/env.js";
import { issueBookingActionToken } from "../common/security/booking-action-token.js";
import { safeErrorAttributes } from "../common/observability/safe-error.js";
import { prisma } from "../config/database.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { enqueueNotification } from "../modules/notifications/notifications.service.js";
import { isCurrentBookingReminder } from "./booking-reminder-current.js";

interface ClaimedReminder {
  id: string;
  attempts: number;
}

const appointmentDateTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
});

export class BookingReminderWorker {
  constructor(private readonly database: PrismaClient = prisma) {}

  async runOnce(batchSize = 25): Promise<{ sent: number; cancelled: number }> {
    const limit = Math.max(1, Math.min(batchSize, 100));
    // A crashed final attempt must not exceed the retry budget or prevent the
    // rest of the batch from being claimed. Preserve a still-active final lease.
    await this.database.bookingReminder.updateMany({
      where: {
        attempts: { gte: 8 },
        OR: [
          { status: { in: ["PENDING", "FAILED"] } },
          { status: "PROCESSING", lockedAt: { lt: new Date(Date.now() - 600_000) } },
        ],
      },
      data: {
        status: "DEAD_LETTER",
        lockedAt: null,
        nextAttemptAt: null,
        lastErrorCode: "REMINDER_RETRY_EXHAUSTED",
      },
    });
    const claimed = await this.database.$queryRaw<ClaimedReminder[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "BookingReminder"
        WHERE (
          ("status" IN ('PENDING', 'FAILED') AND COALESCE("nextAttemptAt", "scheduledFor") <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
          OR ("status" = 'PROCESSING' AND "lockedAt" < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '10 minutes')
        ) AND "attempts" < 8
        ORDER BY "scheduledFor" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "BookingReminder" reminder
      SET "status" = 'PROCESSING', "lockedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
          "attempts" = reminder."attempts" + 1, "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      FROM candidates
      WHERE reminder."id" = candidates."id"
      RETURNING reminder."id", reminder."attempts"
    `);
    let sent = 0;
    let cancelled = 0;
    for (const claim of claimed) {
      try {
        const result = await this.deliver(claim);
        if (result === "sent") sent += 1;
        else if (result === "cancelled") cancelled += 1;
      } catch (error: unknown) {
        await this.fail(claim, error);
      }
    }
    return { sent, cancelled };
  }

  private async deliver({
    id,
    attempts,
  }: ClaimedReminder): Promise<"sent" | "cancelled" | "superseded"> {
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "BookingReminder" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const reminder = await transaction.bookingReminder.findUnique({
        where: { id },
        select: {
          id: true,
          kind: true,
          status: true,
          attempts: true,
          scheduleVersion: true,
          booking: {
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              scheduleVersion: true,
              customer: { select: { userId: true } },
            },
          },
        },
      });
      // The row lock protects enqueue and completion together. A delayed batch
      // item may proceed only if no newer worker has taken ownership.
      if (
        reminder === null ||
        reminder.status !== "PROCESSING" ||
        reminder.attempts !== attempts
      )
        return "superseded";
      const now = new Date();
      if (
        !isCurrentBookingReminder(
          reminder.booking,
          reminder.scheduleVersion,
          now.getTime(),
        )
      ) {
        await transaction.bookingReminder.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            lockedAt: null,
            nextAttemptAt: null,
            lastErrorCode:
              reminder.booking.scheduledAt.getTime() <= now.getTime()
                ? "APPOINTMENT_TIME_PASSED"
                : null,
          },
        });
        return "cancelled";
      }
      const token = issueBookingActionToken({
        bookingId: reminder.booking.id,
        userId: reminder.booking.customer.userId,
        scheduleVersion: reminder.scheduleVersion,
        expiresAt: reminder.booking.scheduledAt.getTime() + 2 * 3_600_000,
      });
      const actionUrl = new URL(
        "/api/v1/public/booking-response",
        env.FRONTEND_URL[0] ?? "http://localhost:3000",
      );
      actionUrl.searchParams.set("token", token);
      await enqueueNotification(transaction, {
        userId: reminder.booking.customer.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: "Appointment reminder",
        message: `Your Allied AutoTech appointment is scheduled for ${appointmentDateTime.format(reminder.booking.scheduledAt)} Nigeria time. Sign in to your booking to confirm attendance or cancel without a cancellation fee. No response does not cancel your appointment.`,
        resourceType: "BOOKING",
        resourceId: reminder.booking.id,
        expiresAt: reminder.booking.scheduledAt,
        deduplicationKey: `booking:${reminder.booking.id}:reminder:${reminder.scheduleVersion}:${reminder.kind}`,
        channels: ["EMAIL"],
        bookingAction: {
          url: actionUrl.toString(),
          bookingId: reminder.booking.id,
          scheduleVersion: reminder.scheduleVersion,
        },
      });
      await transaction.bookingReminder.update({
        where: { id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lockedAt: null,
          nextAttemptAt: null,
          lastErrorCode: null,
        },
      });
      return "sent";
    });
  }

  private async fail({ id, attempts }: ClaimedReminder, error: unknown): Promise<void> {
    const safe = safeErrorAttributes(error);
    const dead = attempts >= 8;
    const delay = Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 3_600_000);
    await this.database.bookingReminder.updateMany({
      where: { id, status: "PROCESSING", attempts },
      data: {
        status: dead ? "DEAD_LETTER" : "FAILED",
        lockedAt: null,
        nextAttemptAt: dead ? null : new Date(Date.now() + delay),
        lastErrorCode: safe.errorCode ?? safe.errorName ?? "REMINDER_DELIVERY_FAILED",
      },
    });
  }
}
