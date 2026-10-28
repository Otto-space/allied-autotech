import { describe, expect, it } from "vitest";
import {
  accessPreviewFingerprint,
  effectiveWorkforceGrants,
  workforceGrantChanges,
  type GrantAssignment,
  type GrantVisibility,
} from "../../src/modules/organization/workforce-effective-access.js";
const now = new Date("2026-10-26T10:00:00Z");
function assignment(
  id: string,
  template = "CUSTOMER_SERVICE",
  scope = "BRANCH",
  branchId = "a",
): GrantAssignment {
  return {
    id,
    template,
    templateVersion: 1,
    scope,
    branchId,
    startsAt: new Date("2026-10-01T00:00:00Z"),
    expiresAt: null,
    revokedAt: null,
  };
}
function visibility(ids: string[]): GrantVisibility {
  return {
    eligible: true,
    capabilities: null,
    visibleAssignmentIds: new Set(ids),
    branches: [
      { id: "a", name: "Branch A", isActive: true },
      { id: "b", name: "Branch B", isActive: true },
    ],
  };
}
describe("responsibility access provenance", () => {
  it("binds semantic preview values without depending on request-object property order", () => {
    expect(
      accessPreviewFingerprint({
        userId: "target",
        input: { template: "CUSTOMER_SERVICE", branchId: "a" },
      }),
    ).toBe(
      accessPreviewFingerprint({
        input: { branchId: "a", template: "CUSTOMER_SERVICE" },
        userId: "target",
      }),
    );
    expect(accessPreviewFingerprint({ branchId: "a" })).not.toBe(
      accessPreviewFingerprint({ branchId: "b" }),
    );
  });
  it("clips a private branch-wide grant to the viewer's assigned-work management envelope", () => {
    const rows = [assignment("hidden-lead", "WORKSHOP_LEAD")];
    const v = {
      ...visibility([]),
      capabilities: new Set(["JOBS_READ"] as const),
      maximumScopes: new Map([["JOBS_READ", "ASSIGNED"]] as const),
    };
    expect(effectiveWorkforceGrants(rows, v, now)).toEqual([
      {
        capability: "JOBS_READ",
        label: "View workshop jobs",
        branch: { id: "a", name: "Branch A" },
        scope: "ASSIGNED",
        sources: [
          {
            assignmentId: null,
            label: "Another active responsibility",
            scope: "ASSIGNED",
            kind: "OTHER",
          },
        ],
      },
    ]);
  });
  it("retains overlapping access and names the remaining grant without mixing branches", () => {
    const rows = [
      assignment("first"),
      assignment("second"),
      assignment("foreign", "CUSTOMER_SERVICE", "BRANCH", "b"),
    ];
    const v = visibility(rows.map((r) => r.id));
    const before = effectiveWorkforceGrants(rows, v, now),
      after = effectiveWorkforceGrants(rows.slice(1), v, now);
    const change = workforceGrantChanges(before, after);
    expect(change.removed).toEqual([]);
    expect(
      change.retained
        .find((r) => r.capability === "CUSTOMER_ENQUIRIES" && r.branch.id === "a")
        ?.sources.map((s) => s.assignmentId),
    ).toEqual(["second"]);
    expect(
      after.filter((r) => r.capability === "CUSTOMER_ENQUIRIES").map((r) => r.branch.id),
    ).toEqual(["a", "b"]);
  });
  it("reduces branch-wide work to assigned work without claiming all access was removed", () => {
    const lead = assignment("lead", "WORKSHOP_LEAD"),
      tech = assignment("tech", "MECHANICAL_TECHNICIAN", "ASSIGNED");
    const v = visibility(["lead", "tech"]);
    const change = workforceGrantChanges(
      effectiveWorkforceGrants([lead, tech], v, now),
      effectiveWorkforceGrants([tech], v, now),
    );
    expect(change.removed.find((r) => r.capability === "JOBS_READ")?.scope).toBe(
      "BRANCH",
    );
    expect(
      change.removed
        .find((r) => r.capability === "JOBS_READ")
        ?.sources.map((s) => s.assignmentId),
    ).toEqual(["lead"]);
    expect(change.retained.find((r) => r.capability === "JOBS_READ")).toMatchObject({
      scope: "ASSIGNED",
      sources: [{ assignmentId: "tech" }],
    });
    expect(change.added).toEqual([]);
    const reverse = workforceGrantChanges(
      effectiveWorkforceGrants([tech], v, now),
      effectiveWorkforceGrants([lead, tech], v, now),
    );
    expect(reverse.added.find((r) => r.capability === "JOBS_READ")?.scope).toBe("BRANCH");
    expect(
      reverse.added
        .find((r) => r.capability === "JOBS_READ")
        ?.sources.map((s) => s.assignmentId),
    ).toEqual(["lead"]);
    expect(reverse.retained.find((r) => r.capability === "JOBS_READ")?.scope).toBe(
      "ASSIGNED",
    );
  });
  it("explains only authorised capabilities and redacts private overlapping grant sources", () => {
    const rows = [
      assignment("care"),
      assignment("secret", "OPERATIONS"),
      assignment("finance", "ACCOUNTANT"),
    ];
    const v = {
      ...visibility(["care"]),
      capabilities: new Set(["ORDERS_READ"] as const),
    };
    const remaining = effectiveWorkforceGrants(rows.slice(1), v, now);
    expect(remaining).toEqual([
      {
        capability: "ORDERS_READ",
        label: "View order progress",
        branch: { id: "a", name: "Branch A" },
        scope: "BRANCH",
        sources: [
          {
            assignmentId: null,
            label: "Another active responsibility",
            scope: "BRANCH",
            kind: "OTHER",
          },
        ],
      },
    ]);
    expect(JSON.stringify(remaining)).not.toContain("secret");
    expect(JSON.stringify(remaining)).not.toContain("finance");
  });
  it("fails closed at expiry, inactive branches, unknown versions/scopes and inactive accounts", () => {
    const rows = [
      { ...assignment("expired"), expiresAt: now },
      { ...assignment("future"), startsAt: new Date(now.getTime() + 1) },
      { ...assignment("unknown"), templateVersion: 99 },
      assignment("bad-scope", "CUSTOMER_SERVICE", "ASSIGNED"),
      { ...assignment("revoked"), revokedAt: now },
      assignment("inactive-branch", "CUSTOMER_SERVICE", "BRANCH", "c"),
    ];
    expect(
      effectiveWorkforceGrants(rows, visibility(rows.map((r) => r.id)), now),
    ).toEqual([]);
    expect(
      effectiveWorkforceGrants(
        [assignment("valid")],
        { ...visibility(["valid"]), eligible: false },
        now,
      ),
    ).toEqual([]);
  });
  it("is deterministic across database ordering and never exposes a persisted ID for a proposal", () => {
    const first = assignment("one"),
      second = assignment("two");
    expect(
      effectiveWorkforceGrants([first, second], visibility(["one", "two"]), now),
    ).toEqual(effectiveWorkforceGrants([second, first], visibility(["one", "two"]), now));
    expect(
      effectiveWorkforceGrants([first], visibility(["one"]), now, "one")[0]?.sources[0],
    ).toMatchObject({ assignmentId: null, kind: "PROPOSED" });
  });
});
