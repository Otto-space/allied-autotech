import { describe, it, expect } from "vitest";
import {
  parseWorkSupport,
  workSupportQuery,
  supportPageParams,
} from "@/lib/admin/work-support";
import { supportRecord, bookingId } from "../fixtures/work-support";
describe("staff support queue", () => {
  it("bounds supported kind-specific query state", () => {
    const q = workSupportQuery(
      new URLSearchParams("kind=complaints&priority=HIGH&status=INVESTIGATING"),
      "ADMIN",
    );
    expect(q.invalid).toBe(false);
    expect(q.path).toContain("/staff/support/complaints?");
    expect(q.path).toContain("limit=25");
    for (const value of [
      "kind=other",
      "kind=complaints&type=SERVICE",
      "priority=HIGH",
      "status=BAD",
      "search=service",
      "status=OPEN&status=CLOSED",
      "cursor=bad",
    ])
      expect(workSupportQuery(new URLSearchParams(value), "ADMIN").invalid).toBe(true);
  });
  it("rejects foreign/unassigned ordinary Staff branch state", () => {
    expect(workSupportQuery(new URLSearchParams(), "STAFF").invalid).toBe(true);
    expect(
      workSupportQuery(
        new URLSearchParams(`branchId=${bookingId(102)}`),
        "STAFF",
        bookingId(101),
      ).invalid,
    ).toBe(true);
    expect(workSupportQuery(new URLSearchParams(), "STAFF", bookingId(101)).invalid).toBe(
      false,
    );
  });
  it("retains filters and UUID trail through paging", () => {
    const q = new URLSearchParams("kind=complaints&priority=HIGH"),
      next = supportPageParams(q, bookingId(60024));
    expect(workSupportQuery(next, "ADMIN").invalid).toBe(false);
    expect(supportPageParams(next, undefined, true).toString()).toBe(q.toString());
  });
  it("preserves complete contact, assignment, exact dates and recorded complaint facts", () => {
    const r = supportRecord("complaints"),
      p = parseWorkSupport({ items: [r] }, "complaints", "ADMIN");
    expect(p.items[0].contact?.email).toBe(r.email);
    expect(p.items[0].createdAt).toBe(r.createdAt);
    expect(p.items[0].assignedStaffId).toBe(r.assignedStaffId);
    expect(p.items[0].kind).toBe("complaints");
    expect(
      parseWorkSupport(
        { items: [{ ...r, name: null, email: null }] },
        "complaints",
        "ADMIN",
      ).items[0].contact?.name,
    ).toBeNull();
  });
  it("rejects malformed, duplicate, inconsistent and filter-mismatched records", () => {
    const row = supportRecord();
    for (const value of [
      { items: [row, row] },
      { items: [{ ...row, assignedStaffId: null }] },
      { items: [{ ...row, branchId: null }] },
      { items: [row], nextCursor: "bad" },
    ])
      expect(() => parseWorkSupport(value, "enquiries", "ADMIN")).toThrow();
    expect(() =>
      parseWorkSupport(
        { items: [row] },
        "enquiries",
        "ADMIN",
        undefined,
        new URLSearchParams("status=CLOSED"),
      ),
    ).toThrow();
    expect(() =>
      parseWorkSupport({ items: [row] }, "enquiries", "STAFF", bookingId(102)),
    ).toThrow();
  });
});
