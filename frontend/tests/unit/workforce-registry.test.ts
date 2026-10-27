import { describe, expect, it } from "vitest";
import { workforceTemplates } from "../../../backend/src/modules/organization/workforce-catalogue";
import { learningArticles } from "../../../backend/src/modules/learning/learning.content";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { workforceNavigation } from "@/lib/workforce-navigation";
import {
  workforceAccessKey,
  workforceActionPredicates,
  workforceAllows,
  workforceDestination,
  workforceDestinations,
  permittedWorkforceDestinations,
} from "@/lib/workforce-registry";

const id = (n: number) => `a7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function access(template: keyof typeof workforceTemplates): WorkforceAccess {
  const definition = workforceTemplates[template];
  return parseWorkforceAccess({
    managed: true,
    userId: id(1),
    staffId: id(2),
    position: template,
    department: definition.department,
    version: 0,
    assignments: [
      {
        id: id(3),
        userId: id(1),
        template,
        templateVersion: 1,
        branchId: id(4),
        scope: definition.scope,
        startsAt: "2026-10-01T00:00:00Z",
        expiresAt: null,
        revokedAt: null,
        temporary: false,
        reason: "Synthetic reviewed responsibility",
        createdAt: "2026-10-01T00:00:00Z",
        assignedByUserId: id(9),
        revokedByUserId: null,
        revocationReason: null,
      },
    ],
    permissions: [...definition.actions],
    canManageAssignments: false,
    canInviteAdmins: false,
    accessRevision: "a".repeat(64),
    nextChangeAt: null,
    capabilityScopes: definition.actions.map((capability) => ({
      capability,
      branchId: id(4),
      scope: definition.scope,
    })),
    serverTime: "2026-10-26T10:00:00Z",
  });
}
describe("maintained workforce route and scope policy", () => {
  it("keeps explicit grants separate from branch responsibilities and record authority", () => {
    const a = access("ACCOUNTANT");
    expect(
      workforceNavigation(a)
        .flatMap((g) => g.links)
        .some((l) => l.href === "/admin/refunds"),
    ).toBe(false);
    a.independentCapabilities = [
      "REFUND_CHECK",
      "DISPUTE_MANAGE",
      "PRIVACY_REVIEW",
      "FINANCE_POLICY_APPROVE",
    ];
    expect(
      permittedWorkforceDestinations(a)
        .filter((d) => d.predicate.scope === "independent")
        .map((d) => d.id),
    ).toEqual(["privacy", "refunds", "disputes", "financialPolicy"]);
    expect(a.permissions).toEqual(["FINANCE_READ"]);
    const key = workforceAccessKey(a);
    const refund = workforceDestination("/admin/refunds")!;
    expect(workforceAllows(a, refund.predicate, { branchId: id(4) })).toBe(false);
    a.independentCapabilities = [];
    a.permissions.push("REFUND_CHECK");
    expect(workforceAllows(a, refund.predicate)).toBe(false);
    expect(workforceAccessKey(a)).not.toBe(key);
    expect(() =>
      parseWorkforceAccess({ ...a, independentCapabilities: ["UNKNOWN_GRANT"] }),
    ).toThrow();
    expect(() =>
      parseWorkforceAccess({
        ...a,
        independentCapabilities: ["REFUND_CHECK", "REFUND_CHECK"],
      }),
    ).toThrow();
  });
  it.each([
    ["OPERATIONS", ["bookings", "fitment", "orders"]],
    ["CUSTOMER_SERVICE", ["bookings", "enquiries", "complaints", "orders"]],
    ["SALES_SUPERVISOR", ["enquiries", "fitment", "orders"]],
    ["SALES_CASHIER", ["enquiries"]],
    ["ACCOUNTANT", ["finance"]],
    ["WORKSHOP_LEAD", ["jobs", "fitment"]],
    ["ELECTRICAL_TECHNICIAN", ["jobs"]],
    ["MECHANICAL_TECHNICIAN", ["jobs"]],
  ] as const)(
    "%s advertises exactly the pages its server projection permits",
    (template, expected) => {
      const a = access(template);
      const allowed = permittedWorkforceDestinations(a);
      expect(allowed.map((entry) => entry.id)).toEqual([
        "overview",
        ...expected,
        "security",
        "notifications",
      ]);
      expect(
        workforceNavigation(a).flatMap((group) => group.links.map((link) => link.href)),
      ).toEqual(allowed.map((entry) => entry.href));
      for (const entry of workforceDestinations) {
        expect(workforceDestination(entry.href)?.id).toBe(entry.id);
        expect(workforceAllows(a, workforceDestination(entry.href)!.predicate)).toBe(
          allowed.includes(entry),
        );
      }
    },
  );
  it("binds AND predicates to the record branch and assigned person", () => {
    const a = access("MECHANICAL_TECHNICIAN");
    expect(
      workforceAllows(a, workforceActionPredicates.jobWork, {
        branchId: id(4),
        assignedStaffId: id(2),
      }),
    ).toBe(true);
    expect(
      workforceAllows(a, workforceActionPredicates.jobWork, {
        branchId: id(4),
        assignedStaffId: id(99),
      }),
    ).toBe(false);
    expect(
      workforceAllows(a, workforceActionPredicates.jobWork, {
        branchId: id(99),
        assignedStaffId: id(2),
      }),
    ).toBe(false);
    a.capabilityScopes!.find((g) => g.capability === "JOBS_UPDATE")!.branchId = id(99);
    expect(
      workforceAllows(a, workforceActionPredicates.jobWork, {
        branchId: id(4),
        assignedStaffId: id(2),
      }),
    ).toBe(false);
  });
  it("does not infer duties from position or delegation and keeps personal tools", () => {
    const a = access("MECHANICAL_TECHNICIAN");
    a.permissions = [];
    a.assignments = [];
    a.capabilityScopes = [];
    a.position = "CUSTOMER_SERVICE";
    a.canManageAssignments = true;
    expect(permittedWorkforceDestinations(a).map((entry) => entry.id)).toEqual([
      "overview",
      "access",
      "security",
      "notifications",
    ]);
    expect(workforceNavigation(a).some((group) => group.id === "support")).toBe(false);
    a.managed = false;
    expect(permittedWorkforceDestinations(a)).toEqual([]);
  });
  it("accepts registered UUID detail paths without overmatching forbidden or malformed destinations", () => {
    expect(workforceDestination(`/admin/workforce/jobs/${id(8)}`)?.id).toBe("jobs");
    expect(workforceDestination(`/admin/workforce/access/${id(8)}`)?.id).toBe("access");
    expect(workforceDestination("/admin/workforce")?.id).toBe("overview");
    for (const path of [
      "/admin/payments",
      "/admin/workforce/jobs-archive",
      "/admin/workforce/jobs/../finance",
      "/admin/workforce/jobs/%2e%2e",
      `/admin/workforce/jobs/${id(8)}/work`,
      "/admin?redirect=https://example.test",
      "//example.test/admin",
    ])
      expect(workforceDestination(path)).toBeUndefined();
  });
  it("has stable unique ordering and only maintained learning references", () => {
    expect(new Set(workforceDestinations.map((d) => d.id)).size).toBe(
      workforceDestinations.length,
    );
    expect(new Set(workforceDestinations.map((d) => d.href)).size).toBe(
      workforceDestinations.length,
    );
    expect(workforceDestinations.map((d) => d.order)).toEqual(
      [...workforceDestinations.map((d) => d.order)].sort((a, b) => a - b),
    );
    const articles = new Set(learningArticles.map((a) => a.id));
    for (const entry of workforceDestinations)
      for (const article of entry.articleIds) expect(articles.has(article)).toBe(true);
  });
  it("invalidates changed scope and metadata even when version, IDs or opaque proof are unchanged", () => {
    const a = access("CUSTOMER_SERVICE"),
      b = structuredClone(a);
    b.serverTime = "2026-10-26T11:00:00Z";
    b.assignments.reverse();
    b.permissions.reverse();
    b.capabilityScopes!.reverse();
    expect(workforceAccessKey(a)).toBe(workforceAccessKey(b));
    b.assignments[0].branchId = id(99);
    expect(workforceAccessKey(a)).not.toBe(workforceAccessKey(b));
    b.assignments[0].branchId = a.assignments[0].branchId;
    b.capabilityScopes![0].scope = "ASSIGNED";
    expect(workforceAccessKey(a)).not.toBe(workforceAccessKey(b));
  });
  it("rejects incomplete, foreign or stale current projections while preserving old-server compatibility", () => {
    const a = access("CUSTOMER_SERVICE");
    expect(() => parseWorkforceAccess({ ...a, nextChangeAt: undefined })).toThrow();
    expect(() =>
      parseWorkforceAccess({
        ...a,
        capabilityScopes: [
          { capability: "FINANCE_READ", branchId: id(99), scope: "BRANCH" },
        ],
      }),
    ).toThrow();
    expect(() => parseWorkforceAccess({ ...a, nextChangeAt: a.serverTime })).toThrow();
    const old = { ...a };
    delete old.accessRevision;
    delete old.nextChangeAt;
    delete old.capabilityScopes;
    expect(parseWorkforceAccess(old).permissions).toEqual(a.permissions);
  });
});
