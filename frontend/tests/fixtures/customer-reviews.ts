import type { Page, Route } from "@playwright/test";
import type { ReviewRecord } from "@/lib/api/review-schemas";
const id = (n: number) => `c4000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = "2026-09-17T10:00:00Z";
export const customerReviewRow = (): ReviewRecord => ({
  id: id(1),
  targetType: "BUSINESS",
  rating: 4,
  title: "Isolated review",
  comment: "Synthetic customer feedback",
  createdAt: time,
  updatedAt: time,
  product: null,
  service: null,
  status: "PENDING",
  version: 0,
  productId: null,
  orderItemId: null,
  serviceId: null,
  bookingId: null,
  orderId: null,
  vehicleTransactionId: null,
  moderationNote: null,
  moderatedAt: null,
});
const order = {
  id: id(2),
  status: "COMPLETED",
  orderNumber: "TEST-ORDER",
  items: [
    {
      id: id(3),
      productId: id(4),
      productName: "Test purchased part",
      sku: "TEST",
      quantity: 1,
      unitPriceKobo: "100",
      subtotalKobo: "100",
    },
  ],
};
const booking = {
  id: id(5),
  status: "COMPLETED",
  scheduledAt: time,
  service: {
    id: id(6),
    name: "Test completed service",
    slug: "test-service",
    description: null,
    shortDescription: null,
    pricingType: "FIXED",
    priceKobo: "100",
    currency: "NGN",
    durationMinutes: 30,
    version: 0,
  },
};
const sale = {
  id: id(7),
  status: "COMPLETED",
  transactionNumber: "TEST-SALE",
  vehicleListing: { id: id(8), title: "Test purchased vehicle", status: "SOLD" },
};
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      message: "Isolated response",
      data,
      meta: { requestId: "review-test" },
    },
  });
const fail = (route: Route, code = "DATABASE_UNAVAILABLE", status = 503) =>
  route.fulfill({
    status,
    json: { success: false, message: "Private server exception", error: { code } },
  });
export async function customerReviewsFixture(page: Page, role = "CUSTOMER") {
  const state = {
    userId: id(11),
    sessionRole: role,
    failSession: false,
    rateLimit: false,
    delayList: false,
    releaseList: undefined as (() => void) | undefined,
    rows: [customerReviewRow()],
    failList: false,
    malformed: false,
    failSource: false,
    sourceChanged: false,
    sourcePagination: false,
    malformedSource: false,
    unknown: false,
    dropCommitted: false,
    receipts: new Map<string, { body: string; id: string }>(),
    contradictory: false,
    stale: false,
    pagination: false,
    delay: false,
    release: undefined as (() => void) | undefined,
    reads: [] as string[],
    writes: [] as {
      endpoint: string;
      body: Record<string, unknown>;
      csrf?: string;
      key?: string;
    }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session") {
      if (state.failSession) return fail(route);
      return reply(route, {
        id: id(10),
        user: { id: state.userId, role: state.sessionRole, email: "review@example.test" },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : time,
      });
    }
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "isolated-review-csrf-".repeat(3) });
    if (request.method() === "GET") {
      state.reads.push(endpoint + url.search);
      if (endpoint === "/customers/support/review-sources") {
        if (state.failSource) return fail(route);
        if (state.malformedSource) return reply(route, { items: [{}] });
        const targetType = url.searchParams.get("targetType");
        const source =
          targetType === "PRODUCT"
            ? {
                id: order.items[0].id,
                label: `${order.items[0].productName} · ${order.orderNumber}`,
                targetType,
                productId: order.items[0].productId,
                orderItemId: order.items[0].id,
              }
            : targetType === "ORDER"
              ? { id: order.id, label: order.orderNumber, targetType, orderId: order.id }
              : targetType === "SERVICE"
                ? {
                    id: booking.id,
                    label: booking.service.name,
                    targetType,
                    serviceId: booking.service.id,
                    bookingId: booking.id,
                  }
                : {
                    id: sale.id,
                    label: sale.transactionNumber,
                    targetType,
                    vehicleTransactionId: sale.id,
                  };
        const reviewed = state.rows.some(
          (row) =>
            row.targetType === targetType &&
            [
              row.orderItemId,
              row.orderId,
              row.bookingId,
              row.vehicleTransactionId,
            ].includes(source.id),
        );
        return reply(route, {
          items:
            state.sourceChanged || reviewed || url.searchParams.has("cursor")
              ? []
              : [source],
          ...(state.sourcePagination &&
          !url.searchParams.has("cursor") &&
          !url.searchParams.has("sourceId")
            ? { nextCursor: source.id }
            : {}),
        });
      }
      if (endpoint.includes("/support/reviews")) {
        if (state.delayList)
          await new Promise<void>((resolve) => {
            state.releaseList = resolve;
          });
        if (state.failList) return fail(route);
        if (state.malformed) return reply(route, { items: [{}] });
        const items = state.rows
          .filter(
            (row) =>
              (!endpoint.startsWith("/public/") || row.status === "APPROVED") &&
              (!url.searchParams.has("status") ||
                row.status === url.searchParams.get("status")) &&
              (!url.searchParams.has("targetType") ||
                row.targetType === url.searchParams.get("targetType")),
          )
          .map((row) => ({
            ...row,
            customer: { firstName: "Test", lastName: "Customer" },
            moderationNote: row.moderationNote,
          }));
        return reply(route, {
          items: url.searchParams.has("cursor") ? [] : items,
          ...(state.pagination && !url.searchParams.has("cursor")
            ? { nextCursor: id(1) }
            : {}),
        });
      }
      for (const [base, source] of [
        ["/customers/orders", order],
        ["/customers/bookings", booking],
        ["/customers/vehicle-transactions", sale],
      ] as const) {
        if (endpoint === base)
          return state.failSource ? fail(route) : reply(route, { items: [source] });
        if (endpoint === `${base}/${source.id}`)
          return state.failSource
            ? fail(route)
            : reply(route, {
                ...source,
                status: state.sourceChanged ? "CANCELLED" : source.status,
              });
      }
      return fail(route, "NOT_FOUND", 404);
    }
    state.writes.push({
      endpoint,
      body: request.postDataJSON(),
      csrf: request.headers()["x-csrf-token"],
      key: request.headers()["idempotency-key"],
    });
    if (state.delay)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.unknown) return route.abort("connectionreset");
    if (state.rateLimit)
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "3" },
        json: { error: { code: "RATE_LIMITED" } },
      });
    if (state.stale) return fail(route, "STALE_VERSION", 409);
    const body = request.postDataJSON();
    if (endpoint.endsWith("/moderation")) {
      state.rows = state.rows.map((row) => ({
        ...row,
        status: body.decision,
        moderationNote: body.note ?? null,
        version: row.version + 1,
      }));
      return reply(route, state.contradictory ? customerReviewRow() : state.rows[0]);
    }
    const key = request.headers()["idempotency-key"];
    if (!key) return fail(route, "VALIDATION_FAILED", 422);
    const receipt = state.receipts.get(key);
    if (receipt) {
      if (receipt.body !== JSON.stringify(body))
        return fail(route, "IDEMPOTENCY_CONFLICT", 409);
      return reply(route, {
        ...state.rows.find((row) => row.id === receipt.id),
        replayed: true,
      });
    }
    const saved = {
      ...customerReviewRow(),
      id: id(20 + state.receipts.size),
      title: null,
      ...body,
    };
    state.rows.push(saved);
    state.receipts.set(key, { body: JSON.stringify(body), id: saved.id });
    if (state.dropCommitted) {
      state.dropCommitted = false;
      return route.abort("connectionreset");
    }
    return reply(
      route,
      state.contradictory
        ? { ...saved, rating: 1, replayed: false }
        : { ...saved, replayed: false },
    );
  });
  return state;
}
