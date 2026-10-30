import { describe, expect, it } from "vitest";
import {
  bookingsHref,
  workforceBookingsQuery,
  workforceBookingsPageParams,
  parseScopedWorkforceBookings,
  parseWorkforceBookingDetail,
  parseBookingConfirmationReceipt,
} from "../../lib/admin/workforce-bookings";
import { ApiError } from "../../lib/api/client";
import { workforceAllows, workforceActionPredicates } from "../../lib/workforce-registry";
const id = (n: number) => `b7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function data() {
  const stamp = "2026-10-19T08:00:00.000Z";
  return {
    generatedAt: stamp,
    access: {
      managed: true,
      userId: id(1),
      staffId: id(2),
      version: 1,
      position: "OPERATIONS",
      department: "Services",
      permissions: ["BOOKINGS_READ"],
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: stamp,
      assignments: [
        {
          id: id(3),
          userId: id(1),
          branchId: id(4),
          template: "OPERATIONS",
          scope: "BRANCH",
          temporary: false,
          startsAt: stamp,
          expiresAt: null,
          reason: "Assigned diagnostic responsibility",
          assignedByUserId: id(5),
          createdAt: stamp,
          revokedAt: null,
          revokedByUserId: null,
          revocationReason: null,
        },
      ],
    },
    items: [
      {
        id: id(6),
        branchId: id(4),
        scheduledAt: stamp,
        status: "CONFIRMED",
        version: 0,
        branch: { id: id(4), name: "Stadium Road" },
        customer: { firstName: "Ada", lastName: "Okoro", phone: "+2348000000000" },
        service: { name: "Engine diagnostics" },
        vehicle: null,
      },
    ],
  };
}
describe("workforce bookings query and scope", () => {
  it("preserves proposal identity separately from the current appointment", () => {
    const value = data();
    const detail = {
      ...value.items[0],
      access: value.access,
      generatedAt: value.generatedAt,
      alternativeStartsAt: "2026-10-26T09:00:00.000Z",
      alternativeReason: "A longer workshop visit is needed.",
      alternativeVersion: 0,
    };
    const row = parseWorkforceBookingDetail(detail, detail.id).row;
    expect(row.scheduledAt).toBe(value.items[0].scheduledAt);
    expect(row.alternativeStartsAt).toBe(detail.alternativeStartsAt);
    expect(row.alternativeReason).toBe(detail.alternativeReason);
    expect(row.alternativeVersion).toBe(0);
    expect(() =>
      parseWorkforceBookingDetail({ ...detail, branchId: id(99) }, detail.id),
    ).toThrow();
    expect(() =>
      parseWorkforceBookingDetail(
        { ...detail, alternativeStartsAt: "invalid" },
        detail.id,
      ),
    ).toThrow();
  });

  it("requires both the explicit confirmation grant and the applicable booking scope", () => {
    const access = parseScopedWorkforceBookings(data()).access;
    access.accessRevision = "a".repeat(64);
    access.nextChangeAt = null;
    access.capabilityScopes = [
      { capability: "BOOKINGS_READ", branchId: id(4), scope: "BRANCH" },
    ];
    const predicate = workforceActionPredicates.bookingConfirm;
    expect(workforceAllows(access, predicate, { branchId: id(4) })).toBe(false);
    access.independentCapabilities = ["BOOKING_CONFIRM"];
    expect(workforceAllows(access, predicate, { branchId: id(4) })).toBe(true);
    expect(workforceAllows(access, predicate, { branchId: id(99) })).toBe(false);
    access.permissions = [];
    expect(workforceAllows(access, predicate, { branchId: id(4) })).toBe(false);
  });
  it("binds a confirmation receipt to the inspected appointment, actor, version and review", () => {
    const value = data(),
      original = value.items[0];
    const row = parseWorkforceBookingDetail(
      {
        ...original,
        status: "REQUESTED",
        service: { ...original.service, durationMinutes: 60 },
        assignedStaff: { id: id(7), firstName: "Synthetic", lastName: "Technician" },
        confirmedAt: null,
        access: value.access,
        generatedAt: value.generatedAt,
      },
      original.id,
    ).row;
    const receipt = {
      id: row.id,
      branchId: row.branchId,
      assignedStaffId: row.assignedStaff!.id,
      scheduledAt: row.scheduledAt,
      status: "CONFIRMED",
      version: row.version + 1,
      confirmedAt: value.generatedAt,
      performedByUserId: id(1),
      capacityPolicyVersionId: id(8),
      resourceReviewNote: "Synthetic people and equipment review",
    };
    expect(
      parseBookingConfirmationReceipt(receipt, row, id(1), receipt.resourceReviewNote)
        .version,
    ).toBe(1);
    for (const changed of [
      { performedByUserId: id(99) },
      { branchId: id(99) },
      { assignedStaffId: id(99) },
      { version: 9 },
      { resourceReviewNote: "Different reviewed appointment note" },
      { scheduledAt: "2026-10-20T10:00:00Z" },
    ])
      expect(() =>
        parseBookingConfirmationReceipt(
          { ...receipt, ...changed },
          row,
          id(1),
          receipt.resourceReviewNote,
        ),
      ).toThrow();
    expect(() =>
      parseBookingConfirmationReceipt(
        receipt,
        { ...row, assignedStaff: null },
        id(1),
        receipt.resourceReviewNote,
      ),
    ).toThrow();
    expect(() =>
      parseWorkforceBookingDetail(
        { ...original, access: value.access, generatedAt: value.generatedAt },
        id(99),
      ),
    ).toThrow();
  });
  it("shows only reviewed business-configuration recovery messages", () => {
    const error = (code: string) =>
      new ApiError(409, {
        error: {
          code,
          message: "Untrusted private server text",
          fields: { confirmation: ["untrusted private field"] },
        },
      });
    expect(error("BOOKING_CAPACITY_POLICY_REQUIRED").message).toContain(
      "authorised policy owner",
    );
    expect(error("BOOKING_CAPACITY_FULL").message).toContain("capacity is full");
    expect(error("BOOKING_CALENDAR_CLOSED").message).toContain(
      "approved workshop calendar",
    );
    expect(error("BOOKING_ASSIGNMENT_REQUIRED").message).toContain("Assigned staff");
    expect(error("UNKNOWN_PRIVATE_REASON").message).not.toContain("Untrusted");
    expect(error("__proto__").message).not.toContain("Untrusted");
    expect(error("BOOKING_CAPACITY_POLICY_REQUIRED").fields).toBeUndefined();
  });
  it("normalizes supported filters and keeps trail out of the API request", () => {
    const query = workforceBookingsQuery(
      new URLSearchParams({
        q: "  Honda %_  ",
        status: "CONFIRMED",
        cursor: id(9),
        _trail: "start",
      }),
    );
    expect(query.invalid).toBe(false);
    expect(query.path).toContain("q=Honda+%25_");
    expect(query.path).toContain("limit=25");
    expect(query.path).not.toContain("trail");
    expect(bookingsHref(query.params)).toContain("_trail=start");
  });
  it("rejects unsupported, duplicate, unsafe and malformed query values", () => {
    for (const raw of [
      "q=x&q=y",
      "branchId=x",
      "status=UNKNOWN",
      "status=toString",
      "cursor=bad",
      "_trail=start",
      `q=${"x".repeat(121)}`,
      "q=a%00b",
      `cursor=${id(9)}&_trail=start,${id(9)}`,
    ])
      expect(workforceBookingsQuery(new URLSearchParams(raw)).path).toBeNull();
  });
  it("preserves filters through next and previous paging", () => {
    const first = new URLSearchParams({ q: "Honda", status: "CONFIRMED" }),
      next = workforceBookingsPageParams(first, id(7)),
      third = workforceBookingsPageParams(next, id(8));
    expect(workforceBookingsPageParams(third, undefined, true).toString()).toBe(
      next.toString(),
    );
    expect(workforceBookingsPageParams(next, undefined, true).toString()).toBe(
      first.toString(),
    );
  });
  it("accepts branch bookings and missing vehicle", () => {
    expect(parseScopedWorkforceBookings(data()).items).toHaveLength(1);
  });
  it("rejects foreign branches, mismatched references and inactive or unauthorized assignments", () => {
    for (const kind of [
      "branch",
      "reference",
      "owner",
      "template",
      "scope",
      "revoked",
      "expired",
      "future",
    ]) {
      const value = data();
      if (kind === "branch") value.items[0].branchId = id(99);
      if (kind === "reference") value.items[0].branch.id = id(99);
      if (kind === "scope") value.access.assignments[0].scope = "ASSIGNED";
      if (kind === "revoked")
        Object.assign(value.access.assignments[0], { revokedAt: value.generatedAt });
      if (kind === "expired")
        Object.assign(value.access.assignments[0], { expiresAt: value.generatedAt });
      if (kind === "future")
        value.access.assignments[0].startsAt = "2027-01-01T00:00:00.000Z";
      if (kind === "owner") value.access.assignments[0].userId = id(99);
      if (kind === "template") value.access.assignments[0].template = "ACCOUNTANT";
      expect(() => parseScopedWorkforceBookings(value)).toThrow();
    }
  });
  it("rejects repeated records, malformed paging and missing bookings permission", () => {
    const value = data();
    expect(() =>
      parseScopedWorkforceBookings({ ...value, items: [...value.items, ...value.items] }),
    ).toThrow();
    expect(() => parseScopedWorkforceBookings({ ...value, nextCursor: id(6) })).toThrow();
    value.access.permissions = [];
    expect(() => parseScopedWorkforceBookings(value)).toThrow();
  });
  it("allows Customer Service branch visibility", () => {
    const value = data();
    value.access.assignments[0].template = "CUSTOMER_SERVICE";
    value.access.assignments[0].scope = "BRANCH";

    expect(parseScopedWorkforceBookings(value).items).toHaveLength(1);
  });
});
