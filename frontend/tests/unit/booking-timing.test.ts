import { expect, it } from "vitest";
import {
  parseTimingReceipt,
  type TimingBooking,
  type TimingOverride,
} from "../../lib/api/booking-timing-schemas";
const id = (n: number) => `b8000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
it("requires exact identity, version, unchanged start/status, attribution and assessed timing", () => {
  const before: TimingBooking = {
    id: id(1),
    branchId: id(2),
    version: 2,
    scheduleVersion: 1,
    scheduledAt: "2040-01-02T09:00:00.000Z",
    status: "CONFIRMED",
    service: { durationMinutes: 60 },
  };
  const input: TimingOverride = {
    expectedVersion: 2,
    durationMinutes: 45,
    preparationMinutes: 10,
    cleanupMinutes: 15,
    reason: "Assessed synthetic appointment",
    resourceReviewNote: "People and equipment checked",
  };
  const timing = {
    scheduleVersion: 2,
    scheduledAt: before.scheduledAt!,
    durationMinutes: 45,
    preparationMinutes: 10,
    cleanupMinutes: 15,
    source: "APPOINTMENT_OVERRIDE",
    reason: input.reason,
    createdAt: "2040-01-01T09:00:00.000Z",
  };
  const receipt = {
    id: before.id,
    branchId: before.branchId,
    version: 3,
    scheduleVersion: 2,
    scheduledAt: before.scheduledAt,
    status: before.status,
    performedByUserId: id(3),
    timing,
  };
  expect(parseTimingReceipt(receipt, before, id(3), input).version).toBe(3);
  for (const [key, value] of Object.entries({
    id: id(9),
    branchId: id(9),
    version: 2,
    scheduleVersion: 1,
    scheduledAt: "2040-01-03T09:00:00.000Z",
    status: "REQUESTED",
    performedByUserId: id(9),
  }))
    expect(
      () => parseTimingReceipt({ ...receipt, [key]: value }, before, id(3), input),
      key,
    ).toThrow();
  for (const [key, value] of Object.entries({
    durationMinutes: 60,
    preparationMinutes: 0,
    cleanupMinutes: null,
    source: "SERVICE_DEFAULT",
    reason: "Changed reason",
    scheduleVersion: 3,
  }))
    expect(
      () =>
        parseTimingReceipt(
          { ...receipt, timing: { ...timing, [key]: value } },
          before,
          id(3),
          input,
        ),
      key,
    ).toThrow();
  expect(
    parseTimingReceipt(
      { ...receipt, timing: undefined, timingSnapshots: [timing] },
      before,
      id(3),
      input,
    ).scheduleVersion,
  ).toBe(2);
});
