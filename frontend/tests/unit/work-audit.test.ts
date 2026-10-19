import { expect, it } from "vitest";
import { parseWorkAudit } from "@/lib/admin/work-audit";
const row = {
  id: "d0000000-0000-4000-8000-000000000002",
  userId: null,
  user: null,
  action: "UPDATE",
  entityType: "BRANCH",
  entityId: "record",
  requestId: "request",
  createdAt: "2026-10-19T08:00:00.000Z",
  oldValues: null,
  newValues: { nested: [false, 0, null, ""] },
};
it("validates exact applied references, enums and one-sided date scope", () => {
  expect(
    parseWorkAudit(
      { items: [row] },
      { entityId: "record", action: "UPDATE", from: "2026-10-19T07:00:00Z" },
    ).items,
  ).toHaveLength(1);
  for (const query of [
    { entityId: "other" },
    { action: "READ" as const },
    { from: "2026-10-19T09:00:00Z" },
    { to: "2026-10-19T07:00:00Z" },
  ])
    expect(() => parseWorkAudit({ items: [row] }, query)).toThrow();
});
it("rejects duplicates, ascending timestamps/ID ties, unsafe DTO fields and cursor contradictions", () => {
  const previous = { ...row, id: "d0000000-0000-4000-8000-000000000001" };
  expect(parseWorkAudit({ items: [row, previous] }, {}).items).toHaveLength(2);
  for (const value of [
    { items: [row, row] },
    { items: [previous, row] },
    { items: [{ ...row, ipAddress: "private" }] },
    { items: [{ ...row, oldValues: [] }] },
    { items: [], nextCursor: row.id },
    { items: [row], nextCursor: previous.id },
  ])
    expect(() => parseWorkAudit(value, {})).toThrow();
  expect(() =>
    parseWorkAudit({ items: [row], nextCursor: row.id }, { cursor: row.id }),
  ).toThrow();
});
