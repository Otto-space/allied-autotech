import { describe, expect, it } from "vitest";
import {
  bookingsHref,
  workforceBookingsQuery,
  workforceBookingsPageParams,
  parseScopedWorkforceBookings,
} from "../../lib/admin/workforce-bookings";
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
