import { z } from "zod";
import { parseWorkforceJobCandidates } from "./workforce-job-detail";
import { sameWorkforceScope } from "./workforce-overview";
import type { WorkforceBooking } from "./workforce-bookings";
import type { WorkforceAccess } from "../api/workforce-schemas";
import type { RescheduleDecision } from "../api/booking-schemas";
const receiptSchema = z.object({
  id: z.uuid(),
  branchId: z.uuid().nullable(),
  assignedStaffId: z.uuid().nullable(),
  status: z.string(),
  scheduledAt: z.iso.datetime(),
  version: z.number().int().positive(),
  requestId: z.uuid(),
  requestStatus: z.enum(["APPROVED", "DECLINED"]),
  decidedAt: z.iso.datetime(),
  performedByUserId: z.uuid(),
});
export function parseWorkforceRescheduleReceipt(
  value: unknown,
  before: WorkforceBooking,
  owner: string,
  input: RescheduleDecision,
) {
  const receipt = receiptSchema.parse(value);
  const pending = before.rescheduleRequests?.find(
    (request) => request.id === input.requestId && request.status === "PENDING",
  );
  const approved = input.decision === "APPROVE";
  if (
    !pending ||
    receipt.id !== before.id ||
    receipt.requestId !== pending.id ||
    receipt.performedByUserId !== owner ||
    receipt.requestStatus !== (approved ? "APPROVED" : "DECLINED") ||
    receipt.version !== before.version + (approved ? 2 : 1) ||
    receipt.status !== (approved ? "CONFIRMED" : before.status) ||
    receipt.scheduledAt !== (approved ? pending.startsAt : before.scheduledAt) ||
    receipt.branchId !== (approved ? pending.branchId : before.branchId) ||
    receipt.assignedStaffId !==
      (approved ? input.assignedStaffId : (before.assignedStaff?.id ?? null))
  )
    throw Error("Reschedule decision receipt could not be verified");
  return receipt;
}
export function parseRescheduleCandidates(
  value: unknown,
  row: WorkforceBooking,
  access: WorkforceAccess,
  requestId: string,
) {
  const data = parseWorkforceJobCandidates(value);
  const context = z.object({ requestId: z.uuid() }).parse(value);
  const pending = row.rescheduleRequests?.find(
    (request) => request.id === requestId && request.status === "PENDING",
  );
  if (
    !pending ||
    context.requestId !== requestId ||
    data.jobId !== row.id ||
    data.jobVersion !== row.version ||
    data.branchId !== pending.branchId ||
    !sameWorkforceScope(access, data.access)
  )
    throw Error(
      "Technician choices no longer match this requested change. Refresh the booking.",
    );
  return data;
}
