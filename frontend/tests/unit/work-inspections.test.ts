// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { inspectionFixture, inspectionId as id } from "../fixtures/inspection";
import {
  clearInspectionPending,
  forgetInspectionDrafts,
  inspectionPageParams,
  inspectionPendingKey,
  inspectionSnapshot,
  markInspectionPending,
  parseWorkInspections,
  readInspectionPending,
  redactInspectionChanges,
  validateInspectionReceipt,
  workInspectionsQuery,
} from "@/lib/admin/work-inspections";
import { draftKey, setDraftIdentity } from "@/lib/forms/drafts";
const owner = id(5),
  role = "STAFF";
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
});
afterEach(() => {
  setDraftIdentity(null);
  vi.restoreAllMocks();
});
describe("workshop inspection boundaries", () => {
  it("reuses supported status/trail parsing with scoped branch and strict keys", () => {
    const query = workInspectionsQuery(
      new URLSearchParams(
        `status=REQUESTED&branchId=${id(3)}&cursor=${id(9)}&_trail=start`,
      ),
      role,
      id(3),
    );
    expect(query.invalid).toBe(false);
    expect(query.api.get("limit")).toBe("25");
    expect(query.api.has("_trail")).toBe(false);
    for (const text of [
      "status=no",
      "search=Camry",
      "status=REQUESTED&status=COMPLETED",
      `branchId=${id(4)}`,
      "cursor=no",
    ])
      expect(
        workInspectionsQuery(new URLSearchParams(text), role, id(3)).path,
      ).toBeNull();
    const next = inspectionPageParams(query.params, id(10));
    expect(next.get("_trail")).toBe(`start,${id(9)}`);
    expect(inspectionPageParams(next, undefined, true).toString()).toBe(
      query.params.toString(),
    );
  });
  it("checks unique rows, scope, exact timestamps, intervals and assignment consistency", () => {
    const row = inspectionFixture();
    row.preferredStartAt = "2026-10-17T09:00:37.123Z";
    expect(parseWorkInspections({ items: [row] }, id(3)).items[0].preferredStartAt).toBe(
      row.preferredStartAt,
    );
    for (const items of [
      [row, row],
      [{ ...row, version: -1 }],
      [{ ...row, preferredStartAt: "bad" }],
      [{ ...row, assignedStaffId: id(7) }],
      [{ ...row, scheduledStartAt: row.preferredStartAt }],
    ])
      expect(() => parseWorkInspections({ items }, id(3))).toThrow();
    expect(() => parseWorkInspections({ items: [row] }, id(4))).toThrow();
    expect(() =>
      parseWorkInspections(
        { items: [row] },
        id(3),
        new URLSearchParams("status=COMPLETED"),
      ),
    ).toThrow();
  });
  it("validates exact transition identity/version/assignment/schedule/reason", () => {
    const before = parseWorkInspections({ items: [inspectionFixture()] }).items[0],
      staff = { id: id(7), firstName: "Synthetic", lastName: "Staff" },
      body = {
        status: "CONFIRMED",
        scheduledStartAt: "2026-10-20T10:00:00+01:00",
        scheduledEndAt: "2026-10-20T11:00:00+01:00",
      },
      saved = {
        ...before,
        status: "CONFIRMED",
        version: 3,
        assignedStaffId: staff.id,
        assignedStaff: staff,
        scheduledStartAt: "2026-10-20T09:00:00Z",
        scheduledEndAt: "2026-10-20T10:00:00Z",
      },
      reply = (data: unknown) => ({ success: true, data });
    expect(validateInspectionReceipt(reply(saved), before, body, staff.id).version).toBe(
      3,
    );
    for (const patch of [
      { id: id(100) },
      { version: 2 },
      { status: "COMPLETED" },
      { assignedStaffId: null, assignedStaff: null },
      { scheduledEndAt: "2026-10-20T12:00:00Z" },
    ])
      expect(() =>
        validateInspectionReceipt(reply({ ...saved, ...patch }), before, body, staff.id),
      ).toThrow();
    expect(() =>
      validateInspectionReceipt(
        reply({ ...saved, status: "CANCELLED", cancellationReason: "Wrong" }),
        before,
        { status: "CANCELLED", reason: "Reviewed" },
        staff.id,
      ),
    ).toThrow();
    expect(inspectionSnapshot(before)).not.toBe(
      inspectionSnapshot({ ...before, version: 3 }),
    );
  });
  it("persists minimal owned recovery and redacts without permitting replay", () => {
    const marker = markInspectionPending(owner, role, id(1), 2),
      key = inspectionPendingKey(owner, role);
    expect(Object.keys(JSON.parse(sessionStorage.getItem(key)!)).sort()).toEqual([
      "id",
      "token",
      "version",
    ]);
    expect(() => markInspectionPending(owner, role, id(1), 2)).toThrow();
    expect(() => clearInspectionPending(owner, role, id(99))).toThrow();
    clearInspectionPending(owner, role, marker.token);
    expect(readInspectionPending(owner, role)).toBeUndefined();
    markInspectionPending(owner, role, id(1), 2);
    redactInspectionChanges();
    expect(sessionStorage.getItem(key)).toBe("pending");
    expect(readInspectionPending(owner, role)).toBe("unknown");
  });
  it("explicit reconciliation clears only this owner's inspection drafts", () => {
    const own = draftKey(`${owner}:${role}`, "/admin/inspections", "form"),
      otherPage = draftKey(`${owner}:${role}`, "/admin/vehicles", "form"),
      otherOwner = draftKey("other:STAFF", "/admin/inspections", "form");
    for (const key of [own, otherPage, otherOwner]) sessionStorage.setItem(key, "{}");
    forgetInspectionDrafts(owner, role);
    expect(sessionStorage.getItem(own)).toBeNull();
    expect(sessionStorage.getItem(otherPage)).toBe("{}");
    expect(sessionStorage.getItem(otherOwner)).toBe("{}");
  });
  it("fails closed on unavailable recovery storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(readInspectionPending(owner, role)).toBe("unknown");
    expect(() => markInspectionPending(owner, role, id(1), 2)).toThrow();
  });
});
