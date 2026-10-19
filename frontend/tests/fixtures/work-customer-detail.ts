import type { Page } from "@playwright/test";
import { workCustomersFixture, customerRecord, bookingId } from "./work-customers";
export { bookingId };
export const activityRecord = (n = 0) => ({
  id: bookingId(40000 + n),
  title: `AAT-ORDER-${n + 1}`,
  status: "COMPLETED",
  createdAt: `2026-10-17T09:00:${String(n).padStart(2, "0")}.123Z`,
  amountKobo: n === 0 ? "9999999999999999" : n === 1 ? "0" : null,
  currency: n < 2 ? "NGN" : null,
});
export async function workCustomerDetailFixture(page: Page, role = "ADMIN") {
  const base = await workCustomersFixture(page, role),
    detail = {
      record: {
        ...customerRecord(),
        address: null as string | null,
        city: "Port Harcourt" as string | null,
        state: "Rivers" as string | null,
        country: "NG",
      },
      mode: "normal",
      activityMode: "normal",
      records: Array.from({ length: 28 }, (_, n) => activityRecord(n)),
      reads: [] as string[],
      activityReads: [] as URL[],
    };
  await page.route("**/api/v1/admin/customers/**", async (route) => {
    const u = new URL(route.request().url()),
      summary = u.pathname.split("/").length === 6,
      mode = summary ? detail.mode : detail.activityMode;
    detail.reads.push(u.pathname);
    if (!summary) detail.activityReads.push(u);
    if (["error", "denied", "missing"].includes(mode))
      return route.fulfill({
        status: mode === "error" ? 503 : mode === "denied" ? 403 : 404,
        json: {
          success: false,
          error: { code: mode === "error" ? "DATABASE_UNAVAILABLE" : "NOT_FOUND" },
        },
      });
    let data: unknown;
    if (summary)
      data =
        mode === "malformed"
          ? { id: detail.record.id }
          : mode === "mismatch"
            ? { ...detail.record, id: bookingId(30001) }
            : detail.record;
    else {
      const rows = mode === "empty" ? [] : detail.records,
        after = u.searchParams.has("cursor"),
        items = rows.slice(after ? 25 : 0, after ? 50 : 25);
      data =
        mode === "malformed"
          ? { items: [{ id: "bad" }] }
          : mode === "duplicate"
            ? { items: [rows[0], rows[0]] }
            : {
                items,
                ...(!after && rows.length > 25 ? { nextCursor: bookingId(40024) } : {}),
              };
    }
    return route.fulfill({
      json: {
        success: true,
        data,
        message: "Synthetic customer detail",
        meta: { requestId: "work-customer-detail" },
      },
    });
  });
  return { ...base, detail };
}
