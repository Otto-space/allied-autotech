import type { Page } from "@playwright/test";
import type { Promotion } from "@/lib/api/promotion-schemas";
import { workBookingsFixture, bookingId } from "./work-bookings";
export { bookingId };
export function promotionRecord(n = 0): Promotion {
  return {
    id: bookingId(6000 + n),
    name: [
      "Workshop essentials",
      "Parts allowance",
      "Seasonal draft",
      "Workshop 10%_offer",
      "Extra allowance",
    ][n % 5],
    code: n === 2 ? null : ["CARE10", "PARTS2500", "", "CODE%_3", "EXTRA4"][n % 5],
    description: null,
    discountType: n === 1 ? "FIXED_AMOUNT" : "PERCENTAGE",
    percentageBasisPoints: n === 1 ? null : n === 3 ? 1234 : 1000,
    fixedAmountKobo: n === 1 ? "250000" : null,
    minimumOrderAmountKobo: n === 0 ? "2000000" : null,
    maximumDiscountAmountKobo: n === 0 ? "500000" : null,
    usageLimit: n === 0 ? 100 : null,
    perCustomerLimit: n === 0 ? 1 : n === 1 ? 2 : null,
    startsAt: "2026-10-17T09:00:37.100Z",
    endsAt: "2026-10-31T22:59:37.200Z",
    isActive: n === 0 || n === 3,
    version: 0,
    createdAt: "2026-10-17T08:00:00.000Z",
    updatedAt: "2026-10-17T08:00:00.000Z",
  };
}
export async function workPromotionsFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role),
    state = {
      mode: "normal",
      records: [0, 1, 2, 3, 4].map(promotionRecord),
      reads: [] as URL[],
      writes: [] as string[],
      held: undefined as (() => void) | undefined,
    };
  await page.route("**/api/v1/admin/promotions**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1", "");
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic promotions",
          meta: { requestId: "promotions-quality" },
        },
      });
    if (req.method() !== "GET") {
      state.writes.push(path);
      return route.fulfill({
        status: 405,
        json: { success: false, error: { code: "FORBIDDEN" } },
      });
    }
    if (path !== "/admin/promotions")
      return ok(state.records.find((row) => path.endsWith(row.id)));
    state.reads.push(url);
    if (state.mode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["error", "denied"].includes(state.mode))
      return route.fulfill({
        status: state.mode === "error" ? 503 : 403,
        json: {
          success: false,
          error: { code: state.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN" },
        },
      });
    if (state.mode === "malformed") return ok({ items: [{ id: "bad" }] });
    let rows =
      state.mode === "empty"
        ? []
        : state.records.filter(
            (row) =>
              state.mode === "mismatch" ||
              ((!url.searchParams.has("search") ||
                `${row.name} ${row.code ?? ""}`
                  .toLowerCase()
                  .includes(url.searchParams.get("search")!.toLowerCase())) &&
                (!url.searchParams.has("isActive") ||
                  String(row.isActive) === url.searchParams.get("isActive")) &&
                (!url.searchParams.has("discountType") ||
                  row.discountType === url.searchParams.get("discountType"))),
          );
    const cursor = url.searchParams.get("cursor");
    if (cursor) rows = rows.slice(rows.findIndex((row) => row.id === cursor) + 1);
    return ok({
      items: state.mode === "duplicate" ? [rows[0], rows[0]] : rows.slice(0, 3),
      ...(rows.length > 3 ? { nextCursor: rows[2].id } : {}),
    });
  });
  return { state, base };
}
