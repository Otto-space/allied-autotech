import { safeErrorAttributes } from "../common/observability/safe-error.js";
import { prisma } from "../config/database.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { enqueueNotification } from "../modules/notifications/notifications.service.js";

interface ClaimedReminder {
  id: string;
}

const reminderLabels = {
  SEVEN_DAYS: "7 days",
  THREE_DAYS: "72 hours",
  TWO_DAYS: "48 hours",
  ONE_DAY: "24 hours",
} as const;

export class BookingReminderWorker {
  constructor(private readonly database: PrismaClient = prisma) {}

  async runOnce(batchSize = 25): Promise<{ sent: number; cancelled: number }> {
    const limit = Math.max(1, Math.min(batchSize, 100));
    const claimed = await this.database.$queryRaw<ClaimedReminder[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "BookingReminder"
        WHERE (
          ("status" IN ('PENDING', 'FAILED') AND COALESCE("nextAttemptAt", "scheduledFor") <= CURRENT_TIMESTAMP)
          OR ("status" = 'PROCESSING' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
        )
        ORDER BY "scheduledFor" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "BookingReminder" reminder
      SET "status" = 'PROCESSING', "lockedAt" = CURRENT_TIMESTAMP,
          "attempts" = reminder."attempts" + 1, "updatedAt" = CURRENT_TIMESTAMP
      FROM candidates
      WHERE reminder."id" = candidates."id"
      RETURNING reminder."id"
    `);
    let sent = 0;
    let cancelled = 0;
    for (const { id } of claimed) {
      try {
        const result = await this.deliver(id);
        if (result === "sent") sent += 1;
        else cancelled += 1;
      } catch (error: unknown) {
        await this.fail(id, error);
      }
    }
    return { sent, cancelled };
  }

  private async deliver(id: string): Promise<"sent" | "cancelled"> {
    return this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "BookingReminder" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const reminder = await transaction.bookingReminder.findUnique({
        where: { id },
        select: {
          id: true,
          kind: true,
          status: true,
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
      if (reminder === null || reminder.status !== "PROCESSING") return "cancelled";
      if (
        reminder.booking.status !== "CONFIRMED" ||
        reminder.booking.scheduleVersion !== reminder.scheduleVersion
      ) {
        await transaction.bookingReminder.update({
          where: { id },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            lockedAt: null,
            nextAttemptAt: null,
          },
        });
        return "cancelled";
      }
      await enqueueNotification(transaction, {
        userId: reminder.booking.customer.userId,
        type: "BOOKING",
        category: "TRANSACTIONAL",
        title: `Appointment reminder: ${reminderLabels[reminder.kind]}`,
        message: `Your Allied AutoTech appointment is scheduled for ${reminder.booking.scheduledAt.toISOString()}. If you cannot attend, use your one permitted reschedule at least 24 hours before the appointment. The 30% deposit is non-refundable for cancellation or no-show.`,
        resourceType: "BOOKING",
        resourceId: reminder.booking.id,
        deduplicationKey: `booking:${reminder.booking.id}:reminder:${reminder.scheduleVersion}:${reminder.kind}`,
        channels: ["EMAIL"],
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

  private async fail(id: string, error: unknown): Promise<void> {
    const safe = safeErrorAttributes(error);
    const reminder = await this.database.bookingReminder.findUnique({
      where: { id },
      select: { attempts: true },
    });
    if (reminder === null) return;
    const dead = reminder.attempts >= 8;
    const delay = Math.min(60_000 * 2 ** Math.max(0, reminder.attempts - 1), 3_600_000);
    await this.database.bookingReminder.updateMany({
      where: { id, status: "PROCESSING" },
      data: {
        status: dead ? "DEAD_LETTER" : "FAILED",
        lockedAt: null,
        nextAttemptAt: dead ? null : new Date(Date.now() + delay),
        lastErrorCode: safe.errorCode ?? safe.errorName ?? "REMINDER_DELIVERY_FAILED",
      },
    });
  }
}
