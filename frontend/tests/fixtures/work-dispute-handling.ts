import type { Page } from "@playwright/test";
import type { DisputeWork } from "@/lib/api/dispute-workflow";
import {
  workDisputeOverviewFixture,
  disputeOverviewRow,
  id,
} from "./work-payment-disputes";
export { id };

export function disputeHandlingRow(n = 0): DisputeWork {
  const base = disputeOverviewRow(n);
  return {
    ...base,
    primaryUserId: n === 0 ? null : id(302),
    backupUserId: n === 0 ? null : id(303),
    primaryOperator: n === 0 ? null : { id: id(302), label: "Ada Okoro" },
    backupOperator: n === 0 ? null : { id: id(303), label: "Emeka Nwosu" },
    acknowledgedAt: n === 0 ? null : "2026-10-18T08:30:37.123Z",
    acknowledgedByUserId: n === 0 ? null : id(302),
    acknowledgementDueAt: "2026-10-18T10:00:37.123Z",
    evidenceChecklist: base.hasEvidence
      ? {
          invoice: true,
          fulfillmentOrHandoverProof: true,
          relevantCustomerMessages: true,
          note: "Synthetic invoice, handover record and relevant correspondence.",
        }
      : null,
    providerSubmissionReference: base.respondedAt ? `SYNTHETIC-RECEIPT-${n}` : null,
  };
}

export async function workDisputeHandlingFixture(page: Page, role = "ADMIN") {
  const base = await workDisputeOverviewFixture(page, role);
  base.grants = ["DISPUTE_MANAGE"];
  const state = {
    base,
    mode: "normal",
    currentMode: "normal",
    mutationMode: "normal",
    records: Array.from({ length: 4 }, (_, n) => disputeHandlingRow(n)),
    reads: [] as URL[],
    writes: [] as { path: string; body: unknown }[],
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic dispute handling QA",
      meta: { requestId: "dispute-handling-test" },
    },
  });
  await page.route("**/api/v1/staff/disputes**", async (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() !== "GET") {
      state.writes.push({ path: u.pathname, body: r.request().postDataJSON() });
      const parts = u.pathname.split("/"),
        action = parts.at(-1),
        row = state.records.find((v) => v.id === parts.at(-2)),
        body = r.request().postDataJSON();
      if (!row)
        return r.fulfill({
          status: 404,
          json: { success: false, error: { code: "NOT_FOUND" } },
        });
      if (state.mutationMode === "rejected")
        return r.fulfill({
          status: 409,
          json: { success: false, error: { code: "CONFLICT" } },
        });
      if (action === "evidence-access")
        return r.fulfill(
          ok({ id: row.id, url: "https://unapproved.invalid/private-evidence" }),
        );
      if (body.expectedUpdatedAt !== row.updatedAt)
        return r.fulfill({
          status: 409,
          json: { success: false, error: { code: "CONFLICT" } },
        });
      if (action === "acknowledge") {
        row.acknowledgedAt = new Date().toISOString();
        row.acknowledgedByUserId = id(302);
      } else if (action === "assign") {
        row.primaryUserId = body.primaryUserId;
        row.backupUserId = body.backupUserId;
        row.primaryOperator = { id: body.primaryUserId, label: "Ada Okoro" };
        row.backupOperator = { id: body.backupUserId, label: "Emeka Nwosu" };
      } else if (action === "submission") {
        row.respondedAt = body.submittedAt;
        row.providerSubmissionReference = body.providerSubmissionReference;
      } else
        return r.fulfill({
          status: 405,
          json: { success: false, error: { code: "METHOD_NOT_ALLOWED" } },
        });
      row.updatedAt = new Date(Date.parse(row.updatedAt) + 1000).toISOString();
      if (state.mutationMode === "lost") return r.abort("failed");
      if (state.mutationMode === "malformed")
        return r.fulfill(ok({ ...row, amountKobo: "1" }));
      return r.fulfill(ok(row));
    }
    state.reads.push(u);
    if (u.pathname.endsWith("/operators"))
      return r.fulfill(
        ok({
          items: [302, 303].map((n, i) => ({
            id: id(n),
            label: i ? "Emeka Nwosu" : "Ada Okoro",
          })),
          nextCursor: null,
        }),
      );
    const recordId = u.pathname.split("/").at(-1);
    if (recordId !== "disputes") {
      if (state.currentMode !== "normal")
        return r.fulfill({
          status: state.currentMode === "denied" ? 403 : 503,
          json: { success: false, error: { code: "UNAVAILABLE" } },
        });
      const row = state.records.find((v) => v.id === recordId);
      return row
        ? r.fulfill(ok(row))
        : r.fulfill({
            status: 404,
            json: { success: false, error: { code: "NOT_FOUND" } },
          });
    }
    if (["error", "denied"].includes(state.mode))
      return r.fulfill({
        status: state.mode === "denied" ? 403 : 503,
        json: { success: false, error: { code: "UNAVAILABLE" } },
      });
    const rows =
      state.mode === "empty"
        ? []
        : state.records.filter(
            (v) =>
              (role !== "STAFF" || [v.primaryUserId, v.backupUserId].includes(id(302))) &&
              (u.searchParams.get("openOnly") === "false" || !v.resolvedAt),
          );
    const start = u.searchParams.has("cursor")
      ? rows.findIndex((v) => v.id === u.searchParams.get("cursor")) + 1
      : 0;
    const limit = Number(u.searchParams.get("limit") ?? 25),
      items = rows.slice(start, start + limit);
    return r.fulfill(
      ok({ items, nextCursor: start + limit < rows.length ? items.at(-1)!.id : null }),
    );
  });
  await page.route("**/api/v1/admin/staff?**", (r) =>
    r.fulfill(
      ok({
        items: [302, 303].map((n, i) => ({
          id: id(n),
          email: `synthetic-${n}@example.test`,
          role: "STAFF",
          status: "ACTIVE",
          staffProfile: {
            id: id(n + 100),
            firstName: i ? "Emeka" : "Ada",
            lastName: i ? "Nwosu" : "Okoro",
            branchId: id(101),
          },
        })),
      }),
    ),
  );
  return state;
}
