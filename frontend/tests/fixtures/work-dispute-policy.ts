import type { Page } from "@playwright/test";
import { workInvoiceFixture, id } from "./work-invoices";
import type { PolicyVersion } from "@/lib/api/policy-schemas";
export { id };
export function disputePolicyRow(version = 4): PolicyVersion {
  return {
    id: id(230000 + version),
    key: "disputes",
    version,
    approvalStatus: version === 1 ? "DRAFT_ACCOUNTANT_APPROVAL" : "APPROVED",
    source: "Synthetic written accounting approval for interface verification",
    sourceQuestion: "Q9",
    sourceSignatory: null,
    approvedByUserId: version === 1 ? null : id(302),
    effectiveAt:
      version === 4
        ? "2030-01-05T07:30:00.000Z"
        : version === 3
          ? "2029-01-05T07:30:00.000Z"
          : "2026-01-01T00:00:00.000Z",
    recordedAt: `2026-01-0${version}T09:00:00.000Z`,
    approvalEvidence:
      version === 1
        ? null
        : `Synthetic accounting sign-off FIN-QA-${version}; testing only.`,
    settings:
      version === 1
        ? {}
        : {
            primaryUserId: id(310),
            backupUserId: id(311),
            days: [1, 2, 3, 4, 5],
            openMinute: 480,
            closeMinute: 1080,
            holidays: ["2026-12-25"],
          },
  };
}
export async function workDisputePolicyFixture(page: Page, role = "SUPER_ADMIN") {
  const base = await workInvoiceFixture(page, role),
    state = {
      base,
      grants: [] as string[],
      contactMode: "normal",
      grantMode: "normal",
      grantReads: [] as URL[],
      contactReads: [] as URL[],
      mode: "normal",
      outcome: "normal",
      records: [4, 3, 2, 1].map(disputePolicyRow),
      reads: [] as URL[],
      writes: [] as unknown[],
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic dispute policy QA",
      meta: { requestId: "dispute-policy-test" },
    },
  });
  await page.route("**/api/v1/staff/profile", (r) => {
    state.base.profileReads++;
    if (["error", "denied"].includes(state.base.profileMode))
      return r.fulfill({
        status: state.base.profileMode === "denied" ? 403 : 503,
        json: { success: false, error: { code: "UNAVAILABLE" } },
      });
    return r.fulfill(
      ok({
        id: id(state.base.profileMode === "mismatch" ? 999 : 302),
        email: "workshop@example.test",
        role,
        status: state.base.profileMode === "inactive" ? "SUSPENDED" : "ACTIVE",
        capabilities: state.grants,
        staffProfile: {
          id: id(601),
          firstName: "Ada",
          lastName: "Okoro",
          branchId: id(101),
        },
      }),
    );
  });
  await page.route("**/api/v1/admin/policies/disputes/current", (r) => {
    state.reads.push(new URL(r.request().url()));
    if (["error", "denied"].includes(state.mode))
      return r.fulfill({
        status: state.mode === "denied" ? 403 : 503,
        json: { success: false, error: { code: "UNAVAILABLE" } },
      });
    const history = state.mode === "empty" ? [] : state.records;
    if (new URL(r.request().url()).pathname.endsWith("/current")) {
      const evaluatedAt = new Date().toISOString();
      const eligible = history
        .filter((v) => v.effectiveAt <= evaluatedAt)
        .sort(
          (a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.version - a.version,
        );
      const future = history
        .filter((v) => v.effectiveAt > evaluatedAt)
        .sort(
          (a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || b.version - a.version,
        );
      return r.fulfill(
        ok({
          evaluatedAt,
          current: eligible[0] ?? null,
          latest: history[0] ?? null,
          nextScheduled: future[0] ?? null,
          history,
        }),
      );
    }
    return r.fulfill(ok(history));
  });
  await page.route("**/api/v1/admin/policies", (r) => {
    const body = r.request().postDataJSON();
    state.writes.push(body);
    if (state.outcome === "conflict" || state.outcome === "denied")
      return r.fulfill({
        status: state.outcome === "conflict" ? 409 : 403,
        json: { success: false, error: { code: "CONFLICT" } },
      });
    const saved = {
      ...disputePolicyRow(),
      ...body,
      key: "disputes",
      id: id(230000 + body.expectedVersion + 1),
      version: body.expectedVersion + 1,
      recordedAt: new Date().toISOString(),
    };
    delete saved.kind;
    delete saved.expectedVersion;
    state.records.unshift(saved);
    if (state.outcome === "refresh-error") state.mode = "error";
    if (state.outcome === "lost") return r.abort("failed");
    return r.fulfill(
      ok(
        state.outcome === "wrong-actor" ? { ...saved, approvedByUserId: id(999) } : saved,
      ),
    );
  });
  const contact = (n: number) => ({
    id: id(n),
    email: n === 310 ? "ada.okoro@example.test" : "chidi.okafor@example.test",
    role: "ADMIN",
    status: state.contactMode === "inactive" ? "SUSPENDED" : "ACTIVE",
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    staffProfile: {
      id: id(n + 500),
      firstName: n === 310 ? "Ada" : "Chidi",
      lastName: n === 310 ? "Okoro" : "Okafor",
      branchId: id(101),
    },
  });
  await page.route("**/api/v1/admin/staff**", (r) => {
    const u = new URL(r.request().url());
    state.contactReads.push(u);
    if (u.pathname.endsWith("/staff"))
      return r.fulfill(
        ok({
          items:
            u.searchParams.get("q") === "missing"
              ? []
              : [
                  contact(
                    u.searchParams.has("cursor") || u.searchParams.has("q") ? 311 : 310,
                  ),
                ],
          nextCursor:
            u.searchParams.has("cursor") || u.searchParams.has("q") ? undefined : id(310),
        }),
      );
    return r.fulfill(ok(contact(u.pathname.endsWith(id(311)) ? 311 : 310)));
  });
  await page.route("**/api/v1/admin/capabilities?**", (r) => {
    const url = new URL(r.request().url());
    state.grantReads.push(url);
    if (state.grantMode === "error")
      return r.fulfill({
        status: 503,
        json: { success: false, error: { code: "UNAVAILABLE" } },
      });
    return r.fulfill(
      ok(
        state.grantMode === "revoked"
          ? []
          : [
              {
                id: id(900),
                userId:
                  state.grantMode === "mismatch"
                    ? id(999)
                    : url.searchParams.get("userId"),
                capability: "DISPUTE_MANAGE",
                grantedByUserId: id(302),
                grantedAt: "2026-01-01T00:00:00.000Z",
                revokedAt: null,
              },
            ],
      ),
    );
  });
  return state;
}
