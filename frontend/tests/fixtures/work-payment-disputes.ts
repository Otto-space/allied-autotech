import type { Page } from "@playwright/test";
import type { PaymentDispute } from "@/lib/api/operations-schemas";
import { workInvoiceFixture, id } from "./work-invoices";
export { id };
export function disputeOverviewRow(n = 0): PaymentDispute {
  const status = (["AWAITING_RESPONSE", "UNDER_REVIEW", "WON", "LOST"] as const)[n % 4];
  return {
    id: id(220000 + n),
    paymentAttemptId: id(221000 + n),
    provider: n % 2 ? "MONNIFY" : "PAYSTACK",
    providerDisputeId: `SYNTHETIC-DSP-2026-${118 - n}`,
    status,
    category: (
      ["FRAUD", "DUPLICATE_CHARGE", "NOT_RECEIVED", "REFUND_NOT_RECEIVED"] as const
    )[n % 4],
    amountKobo: n % 4 === 3 ? "9223372036854775807" : "12500000",
    currency: "NGN",
    chargebackAmountKobo: n % 4 === 3 ? "5000000" : null,
    providerStatus: n % 4 === 3 ? "resolved" : "pending",
    providerResolution:
      n % 4 === 2 ? "merchant-won" : n % 4 === 3 ? "partial-chargeback" : null,
    providerReviewReason: n % 4 === 1 ? "UNCONFIRMED_CHARGEBACK_AMOUNT" : null,
    providerUpdatedAt: "2026-10-18T09:00:37.123Z",
    responseDueAt: n % 4 < 2 ? "2026-10-19T11:00:37.123Z" : null,
    openedAt: new Date(
      Date.parse("2026-10-18T08:00:37.123Z") - n * 3600000,
    ).toISOString(),
    respondedAt: n % 4 ? "2026-10-18T09:00:37.123Z" : null,
    resolvedAt: n % 4 >= 2 ? "2026-10-18T10:00:37.123Z" : null,
    hasEvidence: n % 4 !== 0,
    updatedAt: "2026-10-18T10:00:37.123Z",
  };
}
export async function workDisputeOverviewFixture(page: Page, role = "ADMIN") {
  const base = await workInvoiceFixture(page, role),
    state = {
      base,
      mode: "normal",
      grants: [] as string[],
      records: Array.from({ length: 4 }, (_, n) => disputeOverviewRow(n)),
      reads: [] as URL[],
      writes: [] as string[],
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic dispute overview QA",
      meta: { requestId: "dispute-overview-test" },
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
  await page.route("**/api/v1/admin/operations/payment-disputes**", async (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() !== "GET") {
      state.writes.push(u.pathname);
      return r.fulfill({
        status: 405,
        json: { success: false, error: { code: "METHOD_NOT_ALLOWED" } },
      });
    }
    state.reads.push(u);
    if (["error", "denied"].includes(state.mode))
      return r.fulfill({
        status: state.mode === "denied" ? 403 : 503,
        json: { success: false, error: { code: "UNAVAILABLE" } },
      });
    if (state.mode === "empty") return r.fulfill(ok({ items: [] }));
    const rows = state.records.filter(
        (v) =>
          (!u.searchParams.has("status") || v.status === u.searchParams.get("status")) &&
          (!u.searchParams.has("category") ||
            v.category === u.searchParams.get("category")),
      ),
      start = u.searchParams.has("cursor")
        ? rows.findIndex((v) => v.id === u.searchParams.get("cursor")) + 1
        : 0,
      limit = Number(u.searchParams.get("limit") ?? 25),
      items = rows.slice(start, start + limit);
    return r.fulfill(
      ok({
        items,
        ...(start + limit < rows.length ? { nextCursor: items.at(-1)!.id } : {}),
      }),
    );
  });
  return state;
}
