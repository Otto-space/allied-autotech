import { describe, expect, it } from "vitest";
import {
  auditFilterSchema,
  auditQuery,
  emptyAuditFilters,
} from "@/lib/forms/audit-filters";
describe("audit date boundaries", () => {
  it("allows exactly 90 days and rejects one minute more on the end field", () => {
    const value = {
      ...emptyAuditFilters,
      from: "2026-01-01T10:00",
      to: "2026-04-01T10:00",
    };
    expect(auditFilterSchema.safeParse(value).success).toBe(true);
    const result = auditFilterSchema.safeParse({ ...value, to: "2026-04-01T10:01" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["to"]);
  });
  it("rejects reversed boundaries and nonexistent calendar dates", () => {
    expect(
      auditFilterSchema.safeParse({
        ...emptyAuditFilters,
        from: "2026-04-01T10:00",
        to: "2026-01-01T10:00",
      }).success,
    ).toBe(false);
    expect(
      auditFilterSchema.safeParse({ ...emptyAuditFilters, from: "2026-02-30T10:00" })
        .success,
    ).toBe(false);
  });
  it("preserves one-sided Lagos ranges and trims optional references", () => {
    const parsed = auditFilterSchema.parse({
      ...emptyAuditFilters,
      from: "2026-01-01T10:00",
      entityId: "  private-reference  ",
      requestId: "   ",
    });
    expect(auditQuery(parsed)).toEqual({
      limit: 25,
      from: "2026-01-01T10:00:00+01:00",
      entityId: "private-reference",
    });
    expect(
      auditQuery(
        auditFilterSchema.parse({ ...emptyAuditFilters, to: "2026-09-17T23:59" }),
      ),
    ).toEqual({ limit: 25, to: "2026-09-17T23:59:00+01:00" });
  });
});
