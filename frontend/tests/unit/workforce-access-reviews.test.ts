import { expect, it } from "vitest";
import {
  parseWorkforceReview,
  type WorkforceReviewKind,
} from "@/lib/api/workforce-directory-schemas";
const id = (n: number) => `af000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stamp = "2026-11-13T12:00:00.000Z";
function page(kind: WorkforceReviewKind = "COVER_ENDING", owner = true) {
  return {
    generatedAt: stamp,
    review: {
      kind,
      scope: owner ? "ALL_PRIVILEGED_ACCOUNTS" : "DELEGATED_STAFF_AND_DUTIES",
      ...(kind === "COVER_ENDING" ? { windowEndsAt: "2026-11-20T12:00:00.000Z" } : {}),
    },
    ...(owner
      ? {}
      : {
          managementBranches: [
            { id: id(2), name: "Synthetic permitted branch", isActive: true },
          ],
        }),
    items: [
      {
        userId: id(1),
        name: "Synthetic colleague",
        email: "colleague@example.test",
        role: "STAFF",
        status: "ACTIVE",
        verified: true,
        managed: true,
        position: "CUSTOMER_SERVICE",
        version: 1,
        accountBranch: { id: id(2), name: "Synthetic permitted branch", isActive: true },
        responsibilities: [],
        responsibilitiesMore: false,
        canInspect: true,
        reviewMatchesMore: false,
        reviewMatches: [
          {
            assignmentId: id(3),
            template: "CUSTOMER_SERVICE",
            templateVersion: 1,
            branch: { id: id(2), name: "Synthetic permitted branch", isActive: true },
            scope: "BRANCH",
            temporary: true,
            startsAt: "2026-11-12T12:00:00.000Z",
            expiresAt: "2026-11-14T12:00:00.000Z",
            revokedAt: null as string | null,
          },
        ],
      },
    ],
  };
}
it("binds review metadata and ending window to the requested server-evaluated review", () => {
  expect(parseWorkforceReview(page(), "COVER_ENDING", true).items).toHaveLength(1);
  expect(() => parseWorkforceReview(page(), "REMOVED", true)).toThrow();
  expect(() => parseWorkforceReview(page(), "COVER_ENDING", false)).toThrow();
  expect(() => parseWorkforceReview(page(), "COVER_ENDING", true, 1)).toThrow();
  const p = page();
  p.review.windowEndsAt = undefined;
  expect(() => parseWorkforceReview(p, "COVER_ENDING", true)).toThrow();
});
it("checks each recorded state without confusing ended and removed duties with current access", () => {
  for (const kind of ["OPEN_ENDED_COVER", "SCHEDULED", "ENDED", "REMOVED"] as const) {
    const p = page(kind),
      a = p.items[0]!.reviewMatches[0]!;
    if (kind === "OPEN_ENDED_COVER") (a.expiresAt as string | null) = null;
    if (kind === "SCHEDULED") a.startsAt = "2026-11-14T00:00:00.000Z";
    if (kind === "ENDED") a.expiresAt = "2026-11-13T00:00:00.000Z";
    if (kind === "REMOVED") a.revokedAt = "2026-11-13T01:00:00.000Z";
    expect(parseWorkforceReview(p, kind, true).items).toHaveLength(1);
    if (kind === "REMOVED") a.revokedAt = null;
    else a.revokedAt = "2026-11-13T01:00:00.000Z";
    expect(() => parseWorkforceReview(p, kind, true)).toThrow();
  }
});
it("rejects inactive, future, regular, ended and removed records from an active ending-cover result", () => {
  for (const edit of [
    (p: ReturnType<typeof page>) => {
      p.items[0]!.status = "SUSPENDED";
    },
    (p: ReturnType<typeof page>) => {
      p.items[0]!.verified = false;
    },
    (p: ReturnType<typeof page>) => {
      p.items[0]!.reviewMatches[0]!.temporary = false;
    },
    (p: ReturnType<typeof page>) => {
      p.items[0]!.reviewMatches[0]!.branch.isActive = false;
    },
    (p: ReturnType<typeof page>) => {
      p.items[0]!.reviewMatches[0]!.startsAt = "2026-11-14T00:00:00Z";
    },
    (p: ReturnType<typeof page>) => {
      p.items[0]!.reviewMatches[0]!.expiresAt = stamp;
    },
  ]) {
    const p = page();
    edit(p);
    expect(() => parseWorkforceReview(p, "COVER_ENDING", true)).toThrow();
  }
});
it("rejects copied branch scope, duplicate people or records, and unavailable pinned duty meanings", () => {
  for (const edit of [
    (p: ReturnType<typeof page>) => {
      p.items[0]!.accountBranch.id = id(99);
    },
    (p: ReturnType<typeof page>) => {
      p.items[0]!.reviewMatches[0]!.branch.id = id(99);
    },
    (p: ReturnType<typeof page>) => {
      p.items.push(structuredClone(p.items[0]!));
    },
    (p: ReturnType<typeof page>) => {
      p.items[0]!.reviewMatches.push(structuredClone(p.items[0]!.reviewMatches[0]!));
    },
    (p: ReturnType<typeof page>) => {
      p.items[0]!.reviewMatches[0]!.templateVersion = 99;
    },
    (p: ReturnType<typeof page>) => {
      p.items[0]!.reviewMatches[0]!.scope = "ASSIGNED";
    },
  ]) {
    const p = page("COVER_ENDING", false);
    edit(p);
    expect(() => parseWorkforceReview(p, "COVER_ENDING", false)).toThrow();
  }
});
it("requires explicit Staff-only setup states and excludes legitimate administrator baselines", () => {
  for (const kind of ["UNASSIGNED", "EARLIER_STAFF_SETUP"] as const) {
    const p = page(kind);
    p.items[0]!.reviewMatches = [];
    p.items[0]!.managed = kind === "UNASSIGNED";
    expect(parseWorkforceReview(p, kind, true).items).toHaveLength(1);
    p.items[0]!.role = "ADMIN";
    expect(() => parseWorkforceReview(p, kind, true)).toThrow();
  }
});
it("accepts pinned assigned-record sales and technician duties without accepting branch-wide scope", () => {
  for (const template of [
    "SALES_CASHIER",
    "ELECTRICAL_TECHNICIAN",
    "MECHANICAL_TECHNICIAN",
  ]) {
    for (const templateVersion of [1, 2]) {
      const p = page(),
        a = p.items[0]!.reviewMatches[0]!;
      a.template = template;
      a.templateVersion = templateVersion;
      a.scope = "ASSIGNED";
      expect(parseWorkforceReview(p, "COVER_ENDING", true).items).toHaveLength(1);
      a.scope = "BRANCH";
      expect(() => parseWorkforceReview(p, "COVER_ENDING", true)).toThrow();
    }
  }
});
