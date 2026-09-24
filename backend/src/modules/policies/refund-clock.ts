import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { policySnapshot } from "./policies.service.js";

const clock = z.object({
  startEvent: z.enum(["REQUESTED", "APPROVED", "TRANSFER_RECORDED"]),
  businessDays: z.literal(10),
  countingConvention: z.literal("EXCLUDE_START_SAME_LOCAL_TIME"),
  bankingDays: z.array(z.number().int().min(0).max(6)).min(1),
  holidays: z.array(z.iso.date()),
  timezone: z.literal("Africa/Lagos"),
});
export function bankRefundDueAt(
  start: Date,
  days: readonly number[],
  holidays: readonly string[],
) {
  if (!days.length) throw new Error("Approved banking calendar required");
  let cursor = new Date(start);
  let remaining = 10;
  for (let i = 0; i < 1000 && remaining; i++) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    const local = new Date(cursor.getTime() + 3_600_000);
    if (
      days.includes(local.getUTCDay()) &&
      !holidays.includes(local.toISOString().slice(0, 10))
    )
      remaining--;
  }
  if (remaining) throw new Error("Insufficient banking calendar");
  return cursor;
}
export async function snapshotRefundClock(tx: Prisma.TransactionClient, id: string) {
  const refund = await tx.refund.findUniqueOrThrow({
    where: { id },
    include: { paymentAttempt: true },
  });
  if (refund.dueAt || refund.paymentAttempt.provider !== "MANUAL") return;
  const policy = await tx.businessPolicyVersion.findFirst({
    where: {
      key: "bank_refund_clock",
      approvalStatus: "APPROVED",
      effectiveAt: { lte: refund.requestedAt },
    },
    orderBy: { version: "desc" },
  });
  const parsed = policy ? clock.safeParse(policy.settings) : null;
  if (!policy || !parsed?.success) return;
  const start =
    parsed.data.startEvent === "REQUESTED"
      ? refund.requestedAt
      : parsed.data.startEvent === "APPROVED"
        ? refund.approvedAt
        : refund.transferRecordedAt;
  if (!start) return;
  await tx.refund.updateMany({
    where: { id, dueAt: null },
    data: {
      dueAt: bankRefundDueAt(start, parsed.data.bankingDays, parsed.data.holidays),
      clockPolicySnapshot: policySnapshot(policy),
      clockStatus: "APPROVED_CLOCK_SNAPSHOTTED",
    },
  });
}
