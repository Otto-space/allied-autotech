import type { Page } from "@playwright/test";
import { workInvoiceFixture, id } from "./work-invoices";
export { id };
export function invitationRow(n = 0) {
  const status = (["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] as const)[n % 4];
  return {
    id: id(260000 + n),
    email: [
      "ada.okoro@example.test",
      "chidi.obi@example.test",
      "amara.eze@example.test",
      "emeka.udo@example.test",
    ][n % 4]!,
    role: "ADMIN" as const,
    recipientId: id(270000 + n),
    invitedById: id(302),
    status,
    createdAt: "2026-10-18T08:00:00.000Z",
    expiresAt:
      status === "EXPIRED" ? "2026-10-18T10:00:00.000Z" : "2026-10-25T08:00:00.000Z",
    usedAt: status === "ACCEPTED" ? "2026-10-18T09:00:00.000Z" : null,
    revokedAt: status === "REVOKED" ? "2026-10-18T09:00:00.000Z" : null,
  };
}
export async function workStaffInvitationsFixture(page: Page, role = "ADMIN") {
  const base = await workInvoiceFixture(page, role);
  const state = {
    base,
    mode: "normal",
    candidateMode: "normal",
    writeMode: "reject",
    candidateRole: "CUSTOMER" as "CUSTOMER" | "STAFF",
    rows: Array.from({ length: 4 }, (_, n) => invitationRow(n)),
    reads: [] as URL[],
    writes: [] as { path: string; body: unknown }[],
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic invitation QA",
      meta: { requestId: "invitation-test" },
    },
  });
  await page.route("**/api/v1/admin/staff/**", async (r) => {
    const url = new URL(r.request().url());
    if (r.request().method() !== "GET") {
      state.writes.push({ path: url.pathname, body: r.request().postDataJSON() });
      if (state.writeMode === "lost") return r.abort("failed");
      if (state.writeMode === "malformed")
        return r.fulfill(
          ok({
            invitation: {
              ...invitationRow(),
              recipientId: id(280000),
              email: "wrong@example.test",
            },
            delivery: "QUEUED",
          }),
        );
      return r.fulfill({ status: 405 });
    }
    state.reads.push(url);
    const isCandidate = url.pathname.endsWith("/candidates"),
      mode = isCandidate ? state.candidateMode : state.mode;
    if (["error", "denied"].includes(mode))
      return r.fulfill({
        status: mode === "denied" ? 403 : 503,
        json: {
          success: false,
          error: { code: mode === "denied" ? "FORBIDDEN" : "DATABASE_UNAVAILABLE" },
        },
      });
    if (isCandidate)
      return r.fulfill(
        ok({
          items:
            mode === "empty"
              ? []
              : [
                  {
                    id: id(280000),
                    email: url.searchParams.get("email"),
                    role: state.candidateRole,
                    profile:
                      state.candidateRole === "CUSTOMER"
                        ? { firstName: "Ada", lastName: "Okoro" }
                        : null,
                    staffProfile:
                      state.candidateRole === "STAFF"
                        ? {
                            firstName: "Ada",
                            lastName: "Okoro",
                            branchId: id(101),
                            branch: {
                              id: id(101),
                              name: "Stadium Road workshop",
                              code: "STD",
                              isActive: true,
                            },
                          }
                        : null,
                    management: {
                      canPromote: state.candidateRole === "CUSTOMER",
                      canInvite: state.candidateRole === "STAFF",
                    },
                  },
                ],
        }),
      );
    const detailId = url.pathname.match(/\/invitations\/([^/]+)$/)?.[1];
    if (detailId) {
      const row = state.rows.find((item) => item.id === detailId);
      return row ? r.fulfill(ok(row)) : r.fulfill({ status: 404 });
    }
    let rows = mode === "empty" ? [] : state.rows;
    const status = url.searchParams.get("status"),
      cursor = url.searchParams.get("cursor");
    if (status) rows = rows.filter((v) => v.status === status);
    if (cursor) rows = rows.filter((v) => v.id > cursor);
    const items = rows.slice(0, 25);
    return r.fulfill(
      ok({ items, ...(rows.length > 25 ? { nextCursor: items.at(-1)!.id } : {}) }),
    );
  });
  return state;
}
