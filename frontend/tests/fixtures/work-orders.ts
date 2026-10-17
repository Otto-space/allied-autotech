import type { Page } from "@playwright/test";
import type { WorkOrder } from "@/lib/admin/work-orders";
import { workBookingsFixture, bookingId } from "./work-bookings";
export { bookingId };
export function workOrder(n = 0): WorkOrder {
  return {
    id: bookingId(1100 + n),
    orderNumber: `ORD-20261017-${String(n + 1).padStart(3, "0")}`,
    status: (["PROCESSING", "READY", "PENDING", "COMPLETED", "CANCELLED"] as const)[
      n % 5
    ],
    fulfillmentMethod: n % 2 ? "DELIVERY" : "COLLECTION",
    currency: "NGN",
    subtotalKobo: "2450000",
    discountAmountKobo: "0",
    taxKobo: "0",
    deliveryFeeKobo: "0",
    totalKobo: "2450000",
    version: 0,
    createdAt: "2026-10-17T08:00:00.000Z",
    paymentDueAt: null,
    paidAt: n === 2 ? null : "2026-10-17T08:05:00.000Z",
    branch: {
      id: bookingId(n === 2 ? 102 : 101),
      name: n === 2 ? "Previous workshop" : "Stadium Road workshop",
      code: "QA",
    },
    items: [],
  };
}
export async function workOrdersFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role);
  const state = {
    mode: "normal",
    records: [0, 1, 2, 3, 4].map(workOrder),
    reads: [] as URL[],
    held: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/staff/orders?*", async (route) => {
    const url = new URL(route.request().url());
    state.reads.push(url);
    if (state.mode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["error", "denied", "missing"].includes(state.mode))
      return route.fulfill({
        status: state.mode === "error" ? 503 : state.mode === "missing" ? 404 : 403,
        json: {
          success: false,
          error: { code: state.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN" },
        },
      });
    let rows =
      state.mode === "empty"
        ? []
        : state.records.filter(
            (row) =>
              state.mode === "mismatch" ||
              ((!url.searchParams.has("orderNumber") ||
                row.orderNumber === url.searchParams.get("orderNumber")) &&
                (!url.searchParams.has("status") ||
                  row.status === url.searchParams.get("status")) &&
                (!url.searchParams.has("branchId") ||
                  row.branch.id === url.searchParams.get("branchId"))),
          );
    const cursor = url.searchParams.get("cursor");
    if (cursor) rows = rows.slice(rows.findIndex((row) => row.id === cursor) + 1);
    return route.fulfill({
      json: {
        success: true,
        message: "Synthetic order discovery",
        data:
          state.mode === "malformed"
            ? { items: [{}] }
            : {
                items: rows.slice(0, 3),
                ...(rows.length > 3 ? { nextCursor: rows[2].id } : {}),
              },
        meta: { requestId: "orders-qa" },
      },
    });
  });
  return { state, base };
}
