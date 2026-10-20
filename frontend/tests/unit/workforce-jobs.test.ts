import { describe, expect, it } from "vitest";
import {
  jobsHref,
  workforceJobsQuery,
  workforceJobsPageParams,
  parseScopedWorkforceJobs,
} from "../../lib/admin/workforce-jobs";
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
      position: "ELECTRICAL_TECHNICIAN",
      department: "Services",
      permissions: ["JOBS_READ"],
      canManageAssignments: false,
      canInviteAdmins: false,
      serverTime: stamp,
      assignments: [
        {
          id: id(3),
          userId: id(1),
          branchId: id(4),
          template: "ELECTRICAL_TECHNICIAN",
          scope: "ASSIGNED",
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
        assignedStaffId: id(2),
        customerNotes: null,
        service: { name: "Engine diagnostics" },
        vehicle: null,
        workOrder: null,
      },
    ],
  };
}
describe("workforce jobs query and scope", () => {
  it("normalizes supported filters and keeps trail out of the API request", () => {
    const query = workforceJobsQuery(
      new URLSearchParams({
        q: "  Honda %_  ",
        workStatus: "APPROVED",
        cursor: id(9),
        _trail: "start",
      }),
    );
    expect(query.invalid).toBe(false);
    expect(query.path).toContain("q=Honda+%25_");
    expect(query.path).toContain("limit=25");
    expect(query.path).not.toContain("trail");
    expect(jobsHref(query.params)).toContain("_trail=start");
  });
  it("rejects unsupported, duplicate, unsafe and malformed query values", () => {
    for (const raw of [
      "q=x&q=y",
      "branchId=x",
      "workStatus=UNKNOWN",
      "workStatus=toString",
      "cursor=bad",
      "_trail=start",
      `q=${"x".repeat(121)}`,
      "q=a%00b",
      `cursor=${id(9)}&_trail=start,${id(9)}`,
    ])
      expect(workforceJobsQuery(new URLSearchParams(raw)).path).toBeNull();
  });
  it("preserves filters through next and previous paging", () => {
    const first = new URLSearchParams({ q: "Honda", workStatus: "APPROVED" }),
      next = workforceJobsPageParams(first, id(7)),
      third = workforceJobsPageParams(next, id(8));
    expect(workforceJobsPageParams(third, undefined, true).toString()).toBe(
      next.toString(),
    );
    expect(workforceJobsPageParams(next, undefined, true).toString()).toBe(
      first.toString(),
    );
  });
  it("accepts own assigned jobs and missing optional vehicle/work order", () => {
    expect(parseScopedWorkforceJobs(data()).items).toHaveLength(1);
  });
  it("rejects foreign branch, assignee, owner and nontechnical assignment projections", () => {
    for (const kind of ["branch", "assignee", "owner", "template"]) {
      const value = data();
      if (kind === "branch") value.items[0].branchId = id(99);
      if (kind === "assignee") value.items[0].assignedStaffId = id(99);
      if (kind === "owner") value.access.assignments[0].userId = id(99);
      if (kind === "template") value.access.assignments[0].template = "ACCOUNTANT";
      expect(() => parseScopedWorkforceJobs(value)).toThrow();
    }
  });
  it("rejects repeated records, malformed paging and missing jobs permission", () => {
    const value = data();
    expect(() =>
      parseScopedWorkforceJobs({ ...value, items: [...value.items, ...value.items] }),
    ).toThrow();
    expect(() => parseScopedWorkforceJobs({ ...value, nextCursor: id(6) })).toThrow();
    value.access.permissions = [];
    expect(() => parseScopedWorkforceJobs(value)).toThrow();
  });
  it("allows branch-wide lead visibility without assigning that job to the lead", () => {
    const value = data();
    value.access.assignments[0].template = "WORKSHOP_LEAD";
    value.access.assignments[0].scope = "BRANCH";
    value.items[0].assignedStaffId = id(99);
    expect(parseScopedWorkforceJobs(value).items).toHaveLength(1);
  });
});
