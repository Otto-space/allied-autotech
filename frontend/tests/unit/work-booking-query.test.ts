import { describe, expect, it } from "vitest";
import { lagosDateBoundary, workBookingQuery } from "@/lib/work-booking-query";
import { parseWorkBookingList } from "@/lib/api/work-booking-list-schema";
import { workBooking, bookingId } from "../fixtures/work-bookings";
describe("workshop booking list boundaries", () => {
  it("converts inclusive Lagos dates to an exclusive UTC end across year boundaries", () => {
    const q = workBookingQuery(new URLSearchParams("from=2026-12-31&to=2027-01-01"));
    expect(q.invalid).toBe(false);
    expect(q.api.get("scheduledFrom")).toBe("2026-12-30T23:00:00.000Z");
    expect(q.api.get("scheduledTo")).toBe("2027-01-01T23:00:00.000Z");
  });
  it("validates leap days and the complete inclusive 366-day limit", () => {
    expect(lagosDateBoundary("2025-02-29")).toBeNull();
    expect(lagosDateBoundary("2024-02-29")).not.toBeNull();
    expect(
      workBookingQuery(new URLSearchParams("from=2024-01-01&to=2024-12-31")).invalid,
    ).toBe(false);
    for (const value of [
      "from=2024-01-01&to=2025-01-01",
      "from=2026-02-03&to=2026-02-02",
      "from=garbage",
      "to=9999-12-31",
    ])
      expect(workBookingQuery(new URLSearchParams(value)).path).toBeNull();
  });
  it("supports open date bounds without inventing the other bound", () => {
    expect(
      workBookingQuery(new URLSearchParams("from=2026-10-12")).api.has("scheduledTo"),
    ).toBe(false);
    expect(
      workBookingQuery(new URLSearchParams("to=2026-10-12")).api.has("scheduledFrom"),
    ).toBe(false);
  });
  it("rejects repeated filters, unknown statuses, invalid IDs and staff branch overrides", () => {
    for (const query of [
      "status=BOGUS",
      "status=CONFIRMED&status=CANCELLED",
      "cursor=bad",
      "assignedStaffId=bad",
    ])
      expect(workBookingQuery(new URLSearchParams(query)).path).toBeNull();
    expect(
      workBookingQuery(new URLSearchParams({ branchId: bookingId(101) }), false).path,
    ).toBeNull();
  });
  it("keeps the bounded navigation trail out of the API", () => {
    const q = workBookingQuery(
      new URLSearchParams({ cursor: bookingId(5), _trail: "start", status: "COMPLETED" }),
    );
    expect(q.params.get("_trail")).toBe("start");
    expect(q.api.has("_trail")).toBe(false);
    expect(q.api.get("limit")).toBe("25");
    expect(
      workBookingQuery(
        new URLSearchParams({ cursor: bookingId(5), _trail: "bad" }),
      ).params.has("_trail"),
    ).toBe(false);
  });
  it("projects only list fields and rejects malformed cursor, dates, status or duplicate rows", () => {
    const record = workBooking();
    const result = parseWorkBookingList({ items: [record] });
    expect(result.items[0]).not.toHaveProperty("staffNotes");
    expect(result.items[0]).not.toHaveProperty("customerId");
    expect(result.items[0]).not.toHaveProperty("quotes");
    for (const value of [
      { items: [record, record] },
      { items: [record], nextCursor: "bad" },
      { items: [{ ...record, scheduledAt: "yesterday" }] },
      { items: [{ ...record, status: "BOGUS" }] },
    ])
      expect(() => parseWorkBookingList(value)).toThrow();
    expect(
      parseWorkBookingList({
        items: [
          {
            ...record,
            scheduledAt: null,
            branch: null,
            assignedStaff: null,
            vehicle: null,
          },
        ],
      }).items,
    ).toHaveLength(1);
  });
});
