import type { Page } from "@playwright/test";
import type { z } from "zod";
import { paymentSchema } from "@/lib/api/payment-schemas";
export const paymentId = (n: number) =>
  `d3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function paymentRecord(
  n = 1,
  status: z.infer<typeof paymentSchema>["status"] = "REQUIRES_PAYMENT",
): z.infer<typeof paymentSchema> & {
  createdAt: string | null;
  succeededAt: string | null;
} {
  const purpose =
    n === 2 ? "SERVICE_INVOICE" : n === 3 ? "VEHICLE_RESERVATION" : "ORDER_PAYMENT";
  return {
    id: paymentId(n),
    paymentNumber: `AA-PAY-${2040 + n}`,
    amountKobo: n === 3 ? "25000000" : "7363750",
    currency: "NGN",
    status,
    purpose,
    expiresAt: "2099-10-08T12:00:00Z",
    orderId: purpose === "ORDER_PAYMENT" ? paymentId(201) : null,
    invoiceId: purpose === "SERVICE_INVOICE" ? paymentId(202) : null,
    bookingId: null,
    vehicleTransactionId: purpose === "VEHICLE_RESERVATION" ? paymentId(203) : null,
    createdAt: "2026-10-08T09:00:00Z",
    succeededAt: null,
    checkoutProviders: [],
    attempts:
      n === 1
        ? [
            {
              id: paymentId(101),
              provider: "PAYSTACK",
              status: "PENDING",
              verificationStatus: "UNVERIFIED",
              initiatedAt: "2026-10-08T09:15:00Z",
              paidAt: null,
            },
          ]
        : [],
  };
}
export async function paymentsFixture(page: Page, role = "CUSTOMER") {
  const state = {
    mode: "normal",
    records: [
      paymentRecord(1, "PROCESSING"),
      paymentRecord(2, "REQUIRES_REVIEW"),
      paymentRecord(3),
      paymentRecord(4, "SUCCEEDED"),
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
        id: paymentId(301),
        user: { id: paymentId(302), email: "payments@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-08T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      };
    if (endpoint === "/customers/payments") {
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
        ? [paymentRecord(5, "EXPIRED")]
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
                ? { nextCursor: paymentId(4) }
                : {}),
            };
    }
    if (endpoint.startsWith("/customers/payments/"))
      data =
        state.records.find((r) => r.id === endpoint.split("/").at(-1)) ??
        paymentRecord(5, "EXPIRED");
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated QA fixture",
        meta: { requestId: "payments-qa" },
        data,
      },
    });
  });
  return state;
}
