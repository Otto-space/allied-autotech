import { describe, expect, it } from "vitest";
import {
  parseWorkforceOverview,
  type WorkforceOverview,
} from "../../lib/api/workforce-schemas";
import { sameWorkforceScope } from "../../lib/admin/workforce-overview";
const id = (n: number) => `b5000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture(): WorkforceOverview {
  const stamp = "2026-10-19T08:00:00.000Z";
  return {
    counts: { jobs: 0 },
    generatedAt: stamp,
    branches: [{ id: id(3), name: "Stadium Road workshop" }],
    access: {
      managed: true,
      userId: id(1),
      staffId: id(2),
      version: 1,
      position: "MECHANICAL_TECHNICIAN",
      department: "Services",
      permissions: ["JOBS_READ", "JOBS_UPDATE"],
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: stamp,
      assignments: [
        {
          id: id(4),
          userId: id(1),
          branchId: id(3),
          template: "MECHANICAL_TECHNICIAN",
          scope: "ASSIGNED",
          temporary: false,
          reason: "Assigned workshop responsibility",
          startsAt: stamp,
          expiresAt: null,
          assignedByUserId: id(5),
          createdAt: stamp,
          revokedAt: null,
          revokedByUserId: null,
          revocationReason: null,
        },
      ],
    },
  };
}
describe("workforce overview scope and projection", () => {
  it("preserves valid zero totals and named assigned branches", () => {
    expect(parseWorkforceOverview(fixture())).toEqual(fixture());
  });
  it("rejects unknown or unauthorized counters and missing permitted counters", () => {
    const data = fixture();
    for (const counts of [{ jobs: 0, payments: 40 }, { jobs: 0, orders: 7 }, {}])
      expect(() => parseWorkforceOverview({ ...data, counts })).toThrow();
  });
  it("rejects invalid and unsafe numeric counts", () => {
    for (const jobs of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "3"])
      expect(() => parseWorkforceOverview({ ...fixture(), counts: { jobs } })).toThrow();
  });
  it("rejects missing, extra and duplicate branch projections", () => {
    const data = fixture();
    for (const branches of [
      [],
      [{ id: id(99), name: "Foreign" }],
      [...data.branches, ...data.branches],
    ])
      expect(() => parseWorkforceOverview({ ...data, branches })).toThrow();
  });
  it("rejects another account's assignment", () => {
    const data = fixture();
    data.access.assignments[0].userId = id(99);
    expect(() => parseWorkforceOverview(data)).toThrow();
  });
  it("accepts a managed account with no operational assignments without invented totals", () => {
    const data = fixture();
    data.access.assignments = [];
    data.access.permissions = [];
    data.branches = [];
    data.counts = {};
    expect(parseWorkforceOverview(data).counts).toEqual({});
  });
  it("checks actor, revision, staff identity, assignments and privileges against the shell", () => {
    const { access } = fixture();
    for (const changed of [
      { ...access, userId: id(99) },
      { ...access, staffId: id(99) },
      { ...access, version: 2 },
      { ...access, permissions: [] },
      { ...access, assignments: [] },
      { ...access, canManageAssignments: true },
      { ...access, managed: false },
    ])
      expect(sameWorkforceScope(access, changed)).toBe(false);
    expect(
      sameWorkforceScope(access, {
        ...access,
        permissions: [...access.permissions].reverse(),
      }),
    ).toBe(true);
  });
});
