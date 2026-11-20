import { expect, it } from "vitest";
import {
  workReviewInputSchema,
  workReviewOptionsSchema,
  parseWorkReviewReceipt,
  bookingWorkEstimateSchema,
  type WorkReviewOptions,
  type WorkReviewInput,
  type WorkReviewBooking,
} from "../../lib/api/booking-work-review-schemas";
const id = (n: number) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const owner = id(1),
  before: WorkReviewOptions = {
    bookingId: id(2),
    version: 4,
    scheduleVersion: 2,
    status: "IN_PROGRESS",
    branchId: id(3),
    serviceId: id(4),
    staffId: id(5),
    startedAt: "2040-01-01T09:00:00.000Z",
    canReview: true,
    resourcePolicyVersionId: id(6),
    cleanupMinutes: 15,
    requirements: [{ pool: "bay", quantity: 1 }],
    resources: [
      {
        id: id(7),
        name: "Synthetic bay",
        kind: "SPACE",
        status: "AVAILABLE",
        pools: ["bay"],
      },
    ],
    current: null,
  },
  booking: WorkReviewBooking = {
    id: before.bookingId,
    version: before.version,
    scheduleVersion: before.scheduleVersion,
    status: before.status,
    branchId: before.branchId,
    scheduledAt: "2040-01-01T08:30:00.000Z",
    startedAt: before.startedAt,
    assignedStaff: { id: before.staffId! },
  },
  input: WorkReviewInput = {
    expectedVersion: 4,
    resourcePolicyVersionId: id(6),
    remainingMinutes: 45,
    cleanupMinutes: 15,
    resourceIds: [id(7)],
    reason: "Synthetic remaining work and shared space review",
  };
function receipt() {
  return {
    id: booking.id,
    branchId: id(3),
    serviceId: id(4),
    staffId: id(5),
    version: 5,
    scheduleVersion: 2,
    status: "IN_PROGRESS",
    scheduledAt: booking.scheduledAt,
    startedAt: before.startedAt,
    performedByUserId: owner,
    review: {
      id: id(8),
      bookingVersion: 5,
      resourcePolicyVersionId: id(6),
      reviewedAt: "2040-01-01T10:00:00.000Z",
      remainingMinutes: 45,
      cleanupMinutes: 15,
      expectedWorkEndsAt: "2040-01-01T10:45:00.000Z",
      resourceIds: [id(7)],
      reason: input.reason,
      performedByUserId: owner,
    },
  };
}
it("accepts only the reviewed version, physical units and actual work identity without moving the visit", () => {
  expect(parseWorkReviewReceipt(receipt(), before, booking, owner, input).version).toBe(
    5,
  );
  expect(workReviewOptionsSchema.parse(before).canReview).toBe(true);
});
it.each([
  "actor",
  "nested-actor",
  "branch",
  "service",
  "technician",
  "version",
  "schedule",
  "visit",
  "start",
  "status",
  "plan",
  "units",
  "reason",
  "end",
])("does not claim success for a mismatched %s receipt", (field) => {
  const r = receipt();
  switch (field) {
    case "actor":
      r.performedByUserId = id(99);
      break;
    case "nested-actor":
      r.review.performedByUserId = id(99);
      break;
    case "branch":
      r.branchId = id(99);
      break;
    case "service":
      r.serviceId = id(99);
      break;
    case "technician":
      r.staffId = id(99);
      break;
    case "version":
      r.version++;
      break;
    case "schedule":
      r.scheduleVersion++;
      break;
    case "visit":
      r.scheduledAt = "2040-01-02T08:30:00.000Z";
      break;
    case "start":
      r.startedAt = "2040-01-01T09:30:00.000Z";
      break;
    case "status":
      r.status = "COMPLETED";
      break;
    case "plan":
      r.review.resourcePolicyVersionId = id(99);
      break;
    case "units":
      r.review.resourceIds = [id(99)];
      break;
    case "reason":
      r.review.reason = "Different unreviewed reason";
      break;
    case "end":
      r.review.expectedWorkEndsAt = "2040-01-01T10:44:00.000Z";
      break;
  }
  expect(() => parseWorkReviewReceipt(r, before, booking, owner, input)).toThrow();
});
it("does not turn blank work/cleanup into zero, allow duplicate units or accept client timing authority", () => {
  for (const value of [
    { ...input, remainingMinutes: null },
    { ...input, cleanupMinutes: null },
    { ...input, resourceIds: [id(7), id(7)] },
    { ...input, reviewedAt: "2040-01-01T10:00:00.000Z" },
  ])
    expect(workReviewInputSchema.safeParse(value).success).toBe(false);
  expect(
    workReviewInputSchema.parse({ ...input, cleanupMinutes: 0 }).cleanupMinutes,
  ).toBe(0);
});
it("keeps the customer estimate free of private allocation, operator and reason fields", () => {
  const summary = {
    reviewedAt: "2040-01-01T10:00:00.000Z",
    remainingMinutes: 45,
    estimatedWorkEndsAt: "2040-01-01T10:45:00.000Z",
  };
  expect(bookingWorkEstimateSchema.parse(summary)).toEqual(summary);
  for (const key of ["reason", "resourceIds", "performedByUserId"])
    expect(
      bookingWorkEstimateSchema.safeParse({ ...summary, [key]: "private" }).success,
    ).toBe(false);
});
