import type { Page } from "@playwright/test";
import type { z } from "zod";
import { customerOrderListRecord as orderSchema } from "@/lib/api/customer-orders-schema";
export const orderId = (n: number) =>
  `d2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function orderRecord(
  n = 1,
  status: z.infer<typeof orderSchema>["status"] = "PENDING",
): z.infer<typeof orderSchema> {
  return {
    id: orderId(n),
    orderNumber: `AA-ORD-${2040 + n}`,
    status,
    fulfillmentMethod: n % 2 ? "COLLECTION" : "DELIVERY",
    currency: "NGN",
    subtotalKobo: "6850000",
    discountAmountKobo: "0",
    taxKobo: "513750",
    deliveryFeeKobo: "0",
    totalKobo: "7363750",
    version: 2,
    createdAt: "2026-10-08T09:00:00Z",
    paymentDueAt: "2099-10-08T09:30:00Z",
    paidAt: n === 1 ? "2026-10-08T09:15:00Z" : null,
    branch: { id: orderId(101), code: "QA", name: "Stadium Road workshop" },
    invoice: null,
    deliveryCity: n % 2 ? null : "Port Harcourt",
    deliveryState: n % 2 ? null : "Rivers",
    items: [
      {
        id: orderId(1000 + n),
        productId: orderId(100),
        productName: n === 3 ? "Spark plugs" : "Oil filter",
        sku: "QA-OF-001",
        quantity: 1,
        unitPriceKobo: "1250000",
        subtotalKobo: "1250000",
      },
      {
        id: orderId(2000 + n),
        productId: orderId(102),
        productName: "Front brake pads",
        sku: "QA-BP-001",
        quantity: 2,
        unitPriceKobo: "2800000",
        subtotalKobo: "5600000",
      },
    ],
  };
}
export async function ordersFixture(page: Page, role = "CUSTOMER") {
  const state = {
    mode: "normal",
    records: [
      orderRecord(1, "PROCESSING"),
      orderRecord(2, "CONFIRMED"),
      orderRecord(3),
      orderRecord(4, "PENDING"),
    ],
    reads: [] as URL[],
    writes: [] as string[],
    held: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (route.request().method() !== "GET") state.writes.push(endpoint);
    let data: unknown = { items: [] };
    if (endpoint === "/auth/session")
      data = {
        id: orderId(301),
        user: { id: orderId(302), email: "orders@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-08T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      };
    if (endpoint === "/customers/orders") {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => (state.held = resolve));
      if (state.mode === "error")
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      const status = url.searchParams.get("status");
      const records = url.searchParams.has("cursor")
        ? [orderRecord(5, "COMPLETED")]
        : state.records;
      data =
        state.mode === "malformed"
          ? { items: [{}] }
          : {
              items:
                state.mode === "empty"
                  ? []
                  : records.filter((r) => !status || r.status === status),
              ...(!url.searchParams.has("cursor") && state.mode !== "empty" && !status
                ? { nextCursor: orderId(4) }
                : {}),
            };
    }
    if (endpoint.startsWith("/customers/orders/"))
      data =
        state.records.find((r) => r.id === endpoint.split("/").at(-1)) ??
        orderRecord(5, "COMPLETED");
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated QA fixture",
        meta: { requestId: "orders-qa" },
        data,
      },
    });
  });
  return state;
}
