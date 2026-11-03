import type { Page } from "@playwright/test";
import { branch, id, product as baseProduct } from "./public-account-actions";

export const guestProduct = {
  ...baseProduct,
  priceKobo: "10000",
  name: "Synthetic replacement filter with a long product name",
};
export const guestOrder = () => {
  const createdAt = new Date().toISOString();
  const paymentDueAt = new Date(Date.now() + 1_800_000).toISOString();
  return {
    id: id(81),
    orderNumber: "ORD-SYNTHETIC-20261103-81",
    status: "PENDING",
    fulfillmentMethod: "COLLECTION",
    currency: "NGN",
    subtotalKobo: "20000",
    discountAmountKobo: "0",
    taxKobo: "1500",
    deliveryFeeKobo: "0",
    totalKobo: "21500",
    version: 0,
    createdAt,
    paymentDueAt,
    purchaseReviews: [
      {
        id: id(83),
        revision: 1,
        status: "APPROVED" as const,
        createdAt,
        decidedAt: createdAt,
        expiresAt: paymentDueAt,
        requirements: {
          lines: [
            {
              orderItemId: id(82),
              selection: {
                vehicleModelId: id(85),
                year: 2026,
                position: "front",
                brakeSystem: "synthetic-fixture-system",
              },
            },
          ],
        },
      },
    ],
    paidAt: null as string | null,
    confirmedAt: null as string | null,
    fulfillmentEvidenceAt: null as string | null,
    fulfillmentEvidenceReference: null as string | null,
    branch,
    items: [
      {
        id: id(82),
        productId: guestProduct.id,
        productName: guestProduct.name,
        sku: guestProduct.sku,
        unitPriceKobo: "10000",
        quantity: 2,
        subtotalKobo: "20000",
      },
    ],
    invoice: null,
    paymentId: null as string | null,
    partsQuote: null as {
      id: string;
      enquiryId: string;
      revision: number;
      notes: string;
    } | null,
  };
};
export const guestPayment = () => ({
  id: id(83),
  paymentNumber: "PAY-SYNTHETIC-83",
  amountKobo: "21500",
  currency: "NGN",
  checkoutProviders: ["PAYSTACK", "MONNIFY"],
  status: "REQUIRES_PAYMENT",
  purpose: "ORDER_PAYMENT",
  expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
  orderId: id(81),
  invoiceId: null,
  bookingId: null,
  vehicleTransactionId: null,
  attempts: [] as {
    id: string;
    provider: string;
    status: string;
    verificationStatus: string;
    initiatedAt: string;
    paidAt: string | null;
    attemptNumber: number;
  }[],
});
export async function purchaseFixture(page: Page, access = true) {
  const state = {
    access,
    email: "synthetic-buyer@example.test",
    buyerReference: id(85),
    mode: "full",
    unavailable: false,
    account: false,
    missingProduct: false,
    uncertain: false,
    unsafeCheckout: false,
    failedAccess: false,
    saved: false,
    order: guestOrder(),
    payment: guestPayment(),
    writes: [] as {
      path: string;
      body: Record<string, unknown>;
      key?: string;
      csrf?: string;
    }[],
  };
  const envelope = (data: unknown) => ({
    success: true,
    message: "Synthetic purchase fixture",
    meta: { requestId: "purchase-fixture" },
    data,
  });
  await page.addInitScript(
    ({ productId }) => {
      if (!localStorage.getItem("aat:purchase-cart:1"))
        localStorage.setItem(
          "aat:purchase-cart:1",
          JSON.stringify([{ productId, quantity: 2 }]),
        );
    },
    { productId: guestProduct.id },
  );
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1", ""),
      method = req.method();
    const fail = (status: number, code = "AUTHENTICATION_FAILED") =>
      route.fulfill({
        status,
        json: {
          success: false,
          error: { code },
          meta: { requestId: "purchase-fixture" },
        },
      });
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        json: envelope(data),
        headers: { "Cache-Control": "no-store" },
      });
    if (path === "/public/capabilities")
      return state.unavailable
        ? fail(503, "DATABASE_UNAVAILABLE")
        : ok({
            scope: "POLICY_SUMMARY",
            serverTime: new Date().toISOString(),
            release: {
              mode: state.mode,
              customerAccountsEnabled: state.mode !== "catalogue",
              enquiriesEnabled: state.mode !== "catalogue",
              bookingRequestsEnabled: state.mode === "full",
              inspectionRequestsEnabled: state.mode === "full",
            },
            checkoutEnabled: state.mode === "full",
            vehicleDeposits: { enabled: false },
          });
    if (path === "/auth/session")
      return state.account
        ? ok({
            user: { id: id(90), role: "CUSTOMER" },
            mfaRequired: false,
            mfaVerifiedAt: null,
            expiresAt: "2099-01-01T00:00:00Z",
            idleExpiresAt: "2099-01-01T00:00:00Z",
          })
        : fail(401, "UNAUTHORIZED");
    if (path === `/public/catalog/products/${guestProduct.id}`)
      return state.missingProduct ? fail(503, "DATABASE_UNAVAILABLE") : ok(guestProduct);
    if (path === "/public/branches") return ok({ items: [branch] });
    if (path === `/public/fitment/models/${id(85)}`)
      return ok({
        id: id(85),
        makeId: id(86),
        name: "Synthetic guest test model",
        yearFrom: 2020,
        yearTo: 2030,
        make: { id: id(86), name: "Synthetic guest test make" },
      });
    if (path.startsWith("/public/")) return ok({ items: [] });
    if (!path.startsWith("/purchase/")) return fail(404, "NOT_FOUND");
    if (method !== "GET")
      state.writes.push({
        path,
        body: req.postDataJSON() ?? {},
        key: req.headers()["idempotency-key"],
        csrf: req.headers()["x-csrf-token"],
      });
    if (state.account) return fail(409, "CONFLICT");
    if (path === "/purchase/access/request") return ok(undefined, 202);
    if (path === "/purchase/access/verify") {
      state.access = true;
      return ok({
        email: state.email,
        buyerReference: state.buyerReference,
        expiresAt: "2099-01-01T00:00:00Z",
        csrfToken: "v".repeat(43),
      });
    }
    if (state.failedAccess) return fail(503, "DATABASE_UNAVAILABLE");
    if (!state.access) return fail(401);
    if (path === "/purchase/access" && method === "GET")
      return ok({
        email: state.email,
        buyerReference: state.buyerReference,
        expiresAt: "2099-01-01T00:00:00Z",
      });
    if (path === "/purchase/access" && method === "DELETE") {
      state.access = false;
      return ok(undefined);
    }
    if (path === "/purchase/access/csrf") return ok({ csrfToken: "c".repeat(43) });
    if (method !== "GET" && state.mode !== "full") return fail(403, "FORBIDDEN");
    if (path === "/purchase/orders/original-request")
      return ok({ found: state.saved, order: state.saved ? state.order : null });
    if (path === "/purchase/orders" && method === "GET")
      return ok({ items: state.saved ? [state.order] : [] });
    if (path === "/purchase/orders" && method === "POST") {
      const body = req.postDataJSON();
      const lines = state.order.items.map((item) => ({
        orderItemId: item.id,
        selection:
          body.items.find(
            (line: { productId: string }) => line.productId === item.productId,
          )?.vehicleSelection ?? null,
      }));
      const verified = lines.every((line) => !!line.selection);
      Object.assign(state.order.purchaseReviews[0], {
        requirements: { lines },
        status: verified ? "APPROVED" : "REQUESTED",
        decidedAt: verified ? new Date().toISOString() : null,
        expiresAt: verified ? state.order.paymentDueAt : null,
      });
      if (!verified) Object.assign(state.order, { paymentDueAt: null });
      state.saved = true;
      if (state.uncertain) return route.abort("failed");
      return ok({ order: state.order, replayed: false }, 201);
    }
    if (path === `/purchase/orders/${state.order.id}`) return ok(state.order);
    if (path === "/purchase/payments" && method === "POST") {
      const accepted = req.postDataJSON().acceptedReview;
      const displayed = state.order.purchaseReviews[0];
      if (
        !accepted ||
        accepted.id !== displayed?.id ||
        accepted.revision !== displayed?.revision
      )
        return fail(409, "PAYMENT_CONFLICT");
      state.order.paymentId = state.payment.id;
      return ok({ payment: state.payment, replayed: false }, 201);
    }
    if (path === `/purchase/payments/${state.payment.id}`) return ok(state.payment);
    if (path === `/purchase/payments/${state.payment.id}/checkout`) {
      const provider = req.postDataJSON().provider;
      if (state.payment.attempts.length === 0)
        state.payment.attempts.push({
          id: id(84),
          provider,
          attemptNumber: 1,
          status: "PENDING",
          verificationStatus: "PENDING",
          initiatedAt: new Date().toISOString(),
          paidAt: null,
        });
      state.payment.status = "PROCESSING";
      return ok({
        attemptId: id(84),
        authorizationUrl: state.unsafeCheckout
          ? "https://untrusted.example/collect"
          : provider === "MONNIFY"
            ? "https://sdk.monnify.com/synthetic"
            : "https://checkout.paystack.com/synthetic",
        authorizationExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      });
    }
    if (path === `/purchase/payments/${state.payment.id}/attempts/${id(84)}/verify`) {
      state.payment.status = "SUCCEEDED";
      state.payment.attempts[0]!.status = "SUCCESS";
      state.order.paidAt = new Date().toISOString();
      return ok(state.payment);
    }
    return fail(404, "NOT_FOUND");
  });
  return state;
}
