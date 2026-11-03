import { expect, it } from "vitest";
import {
  parseWorkforceRescheduleReceipt,
  parseRescheduleCandidates,
} from "../../lib/admin/workforce-booking-reschedule";
import { detailId as id, jobDetailData } from "../fixtures/workforce-job-detail-data";
import type { WorkforceBooking } from "../../lib/admin/workforce-bookings";
import type { RescheduleDecision } from "../../lib/api/booking-schemas";
function fixture() {
  const job = jobDetailData(true);
  const pending = {
    id: id(81),
    status: "PENDING" as const,
    source: "CUSTOMER" as const,
    branchId: job.branchId!,
    slotId: id(82),
    startsAt: "2040-01-03T09:00:00.000Z",
    reason: "Requested synthetic change",
    createdAt: "2040-01-01T09:00:00.000Z",
    decidedAt: null,
    decisionReason: null,
  };
  const row = {
    id: job.id,
    branchId: job.branchId,
    assignedStaff: job.assignedStaff,
    status: "CONFIRMED",
    scheduledAt: "2040-01-02T09:00:00.000Z",
    version: 1,
    rescheduleRequests: [pending],
  } as WorkforceBooking;
  const input: RescheduleDecision = {
    requestId: pending.id,
    expectedVersion: 1,
    decision: "APPROVE",
    assignedStaffId: job.assignedStaff!.id,
    reason: "Reviewed replacement request",
    resourceReviewNote: "People and equipment checked",
  };
  const receipt = {
    id: row.id,
    branchId: row.branchId,
    assignedStaffId: input.assignedStaffId,
    status: "CONFIRMED",
    scheduledAt: pending.startsAt,
    version: 3,
    requestId: pending.id,
    requestStatus: "APPROVED",
    decidedAt: "2040-01-01T10:00:00.000Z",
    performedByUserId: job.access.userId,
  };
  return { job, row, input, receipt };
}
it("accepts only an exact attributed approval receipt", () => {
  const { job, row, input, receipt } = fixture();
  expect(
    parseWorkforceRescheduleReceipt(receipt, row, job.access.userId, input).version,
  ).toBe(3);
  for (const [key, value] of Object.entries({
    id: id(99),
    branchId: id(99),
    assignedStaffId: id(99),
    status: "REQUESTED",
    scheduledAt: row.scheduledAt,
    version: 2,
    requestId: id(99),
    requestStatus: "DECLINED",
    performedByUserId: id(99),
    decidedAt: "invalid",
  }))
    expect(
      () =>
        parseWorkforceRescheduleReceipt(
          { ...receipt, [key]: value },
          row,
          job.access.userId,
          input,
        ),
      key,
    ).toThrow();
});
it("requires decline to preserve the current appointment and assignee", () => {
  const { job, row, input, receipt } = fixture();
  input.decision = "DECLINE";
  const declined = {
    ...receipt,
    requestStatus: "DECLINED",
    scheduledAt: row.scheduledAt,
    assignedStaffId: row.assignedStaff!.id,
    version: 2,
  };
  expect(
    parseWorkforceRescheduleReceipt(declined, row, job.access.userId, input)
      .requestStatus,
  ).toBe("DECLINED");
  expect(() =>
    parseWorkforceRescheduleReceipt(
      { ...declined, scheduledAt: receipt.scheduledAt },
      row,
      job.access.userId,
      input,
    ),
  ).toThrow();
  row.rescheduleRequests![0].status = "WITHDRAWN";
  expect(() =>
    parseWorkforceRescheduleReceipt(declined, row, job.access.userId, input),
  ).toThrow();
});
it("binds technician choices to the current request, booking version and access", () => {
  const { job, row, input } = fixture();
  const choices = {
    items: [job.assignedStaff!],
    jobId: row.id,
    jobVersion: row.version,
    branchId: row.branchId,
    requestId: input.requestId,
    generatedAt: job.access.serverTime,
    access: job.access,
  };
  expect(
    parseRescheduleCandidates(choices, row, job.access, input.requestId).items,
  ).toHaveLength(1);
  for (const [key, value] of Object.entries({
    requestId: id(99),
    jobId: id(99),
    jobVersion: 99,
    branchId: id(99),
  }))
    expect(() =>
      parseRescheduleCandidates(
        { ...choices, [key]: value },
        row,
        job.access,
        input.requestId,
      ),
    ).toThrow();
  const foreign = structuredClone(choices);
  foreign.access.userId = id(99);
  expect(() =>
    parseRescheduleCandidates(foreign, row, job.access, input.requestId),
  ).toThrow();
});
