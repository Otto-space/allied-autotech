import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { serviceOperationConflict } from "./service-operations.errors.js";

/** Delegated implementation defaults, not a claimed verbatim owner decision. */
export const defaultReminderMinutes = [1440, 120, 30] as const;
export const reminderMinutesSchema = z
  .array(z.number().int().min(1).max(10080))
  .max(3)
  .refine((values) => new Set(values).size === values.length, {
    message: "Choose distinct reminder times",
  });

export function reminderSchedule(
  booking: { id: string; scheduledAt: Date; scheduleVersion: number },
  offsets: readonly number[],
  now = Date.now(),
) {
  const kinds = ["NOTICE_1", "NOTICE_2", "NOTICE_3"] as const;
  return [...offsets]
    .sort((a, b) => b - a)
    .map((minutes, index) => ({
      bookingId: booking.id,
      kind: kinds[index]!,
      scheduleVersion: booking.scheduleVersion,
      scheduledFor: new Date(booking.scheduledAt.getTime() - minutes * 60_000),
    }))
    .filter((reminder) => reminder.scheduledFor.getTime() > now);
}

export async function bookingReminderMinutes(
  tx: Prisma.TransactionClient,
  bookingId: string,
): Promise<readonly number[]> {
  // Use the appointment's saved approval, not a newly published branch policy.
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { capacityPolicyVersionId: true },
  });
  if (!booking.capacityPolicyVersionId) return defaultReminderMinutes;
  const policy = await tx.businessPolicyVersion.findUniqueOrThrow({
    where: { id: booking.capacityPolicyVersionId },
    select: { settings: true, approvalStatus: true },
  });
  const settings = policy.settings;
  if (policy.approvalStatus !== "APPROVED")
    throw serviceOperationConflict("Review the approved appointment reminder settings");
  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings) ||
    !Object.hasOwn(settings, "reminderMinutes")
  )
    return defaultReminderMinutes;
  const parsed = reminderMinutesSchema.safeParse(settings["reminderMinutes"]);
  if (!parsed.success)
    throw serviceOperationConflict("Review the approved appointment reminder settings");
  return parsed.data;
}
