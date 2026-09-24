import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { approvedPolicy } from "../policies/policies.service.js";
import { serviceOperationConflict } from "./service-operations.errors.js";

export const capacitySettingsSchema = z
  .object({
    dailyLimit: z.number().int().min(1).max(1000),
    openingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    opensAt: z.literal("08:00"),
    closesAt: z.literal("18:00"),
    holidays: z.array(z.iso.date()).max(366),
    timezone: z.literal("Africa/Lagos"),
  })
  .strict();

export async function assertBookingCapacity(
  tx: Prisma.TransactionClient,
  booking: {
    id: string;
    branchId: string | null;
    scheduledAt: Date;
    service: { durationMinutes: number | null };
  },
  resourceReviewNote: string | undefined,
) {
  if (!booking.branchId || !resourceReviewNote || resourceReviewNote.trim().length < 10)
    throw serviceOperationConflict(
      "Staff must record people and equipment review before confirmation",
    );
  const policy = await approvedPolicy(tx, `booking-capacity:${booking.branchId}`);
  const parsed = capacitySettingsSchema.safeParse(policy.settings);
  if (!parsed.success)
    throw serviceOperationConflict(
      "Approved branch capacity and opening calendar are not configured",
    );
  const settings = parsed.data;
  const local = new Date(booking.scheduledAt.getTime() + 3_600_000);
  const day = local.toISOString().slice(0, 10);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  if (
    !settings.openingDays.includes(local.getUTCDay()) ||
    settings.holidays.includes(day) ||
    minutes < 480 ||
    minutes + (booking.service.durationMinutes ?? 0) > 1080
  )
    throw serviceOperationConflict(
      "Appointment is outside the approved workshop calendar",
    );
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`branch-capacity:${booking.branchId}:${day}`}, 0))`;
  const start = new Date(`${day}T00:00:00+01:00`);
  const end = new Date(start.getTime() + 86_400_000);
  const confirmed = await tx.booking.count({
    where: {
      branchId: booking.branchId,
      id: { not: booking.id },
      scheduledAt: { gte: start, lt: end },
      status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] },
    },
  });
  if (confirmed >= settings.dailyLimit)
    throw serviceOperationConflict("Approved branch daily capacity is full");
  await tx.booking.update({
    where: { id: booking.id },
    data: { capacityPolicyVersionId: policy.id, resourceReviewNote },
  });
}
