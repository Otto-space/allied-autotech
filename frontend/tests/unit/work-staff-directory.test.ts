import { describe, it, expect } from "vitest";
import {
  staffDirectoryQuery,
  staffDirectoryPageParams,
  parseStaffDirectory,
  directoryName,
} from "@/lib/admin/work-staff-directory";
import { directoryRow, id } from "../fixtures/work-staff-directory";
describe("staff directory URL and scoped page", () => {
  it("preserves supported filters and bounded reloadable cursor history", () => {
    const q = staffDirectoryQuery(
      new URLSearchParams(`q=Ada%20Okoro&role=STAFF&status=ACTIVE&branchId=${id(101)}`),
    );
    expect(q.invalid).toBe(false);
    const next = staffDirectoryPageParams(q.params, id(240024));
    expect(staffDirectoryQuery(next).invalid).toBe(false);
    expect(staffDirectoryPageParams(next, undefined, true).toString()).toBe(
      q.params.toString(),
    );
    expect(q.path).toContain("limit=25");
  });
  it("rejects unsupported, duplicate, malformed and cyclic filters", () => {
    for (const s of [
      "role=CUSTOMER",
      "q=a",
      "role=STAFF&role=ADMIN",
      "branchId=bad",
      "q=%00ab",
      `cursor=${id(1)}&_trail=start,${id(1)}`,
      "limit=100",
    ])
      expect(staffDirectoryQuery(new URLSearchParams(s)).invalid).toBe(true);
  });
  it("validates safe ordered records, scope, branch identity and cursor", () => {
    const row = directoryRow(),
      q = new URLSearchParams("role=STAFF");
    expect(parseStaffDirectory({ items: [row] }, q).items).toHaveLength(1);
    for (const data of [
      { items: [row, row] },
      { items: [{ ...row, passwordHash: "private" }] },
      { items: [{ ...row, role: "ADMIN" }] },
      { items: [row], nextCursor: id(999) },
      { items: [{ ...row, staffProfile: { ...row.staffProfile, branchId: id(102) } }] },
    ])
      expect(() => parseStaffDirectory(data, q)).toThrow();
    expect(directoryName(directoryRow(6))).toBe("team.07@example.test");
  });
});
