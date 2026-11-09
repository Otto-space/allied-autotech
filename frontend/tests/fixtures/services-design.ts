import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { branch } from "./public-account-actions";
import { parseServices } from "@/lib/api/public-schemas";

export const serviceDesignId = "00000000-0000-4000-8000-000000000001";
export const serviceDesignGroup = "37ec8bcf-7edc-4ec7-a185-ec849d71c5de";
const csrf = "s".repeat(64);

/** Browser writes are intercepted; server reads use the existing in-memory API. */
export async function servicesDesignFixture(request: APIRequestContext, page: Page) {
  const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
  if (origin !== "http://127.0.0.1:5024")
    throw new Error("Services design checks require the isolated loopback API");
  const control = await request.post(`${origin}/__capabilities`, {
    data: {
      mode: "browse_enquiries",
      checkoutApproved: false,
      bookingRequestsEnabled: false,
      productPurchasesEnabled: false,
      fail: false,
    },
  });
  expect(control.ok()).toBe(true);
  const initial = await request.get(`${origin}/api/v1/public/services/discovery`);
  expect(initial.ok()).toBe(true);
  const records = parseServices((await initial.json()).data).items;
  const state = {
    records,
    status: 200,
    empty: false,
    paged: false,
    delay: 0,
    networkFailure: false,
    writes: [] as { body: Record<string, unknown>; csrf?: string; key?: string }[],
    unexpectedWrites: [] as string[],
  };
  const success = (data: unknown) => ({
    success: true,
    message: "Isolated Services design fixture",
    meta: { requestId: "services-design-fixture" },
    data,
  });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    if (req.method() === "POST" && path === "/public/support/enquiries") {
      state.writes.push({
        body: req.postDataJSON(),
        csrf: req.headers()["x-csrf-token"],
        key: req.headers()["idempotency-key"],
      });
      return route.fulfill({
        status: 202,
        json: success({
          id: "a9000000-0000-4000-8000-000000000090",
          status: "OPEN",
          createdAt: "2026-11-09T12:00:00Z",
        }),
      });
    }
    if (req.method() !== "GET") {
      state.unexpectedWrites.push(req.method() + " " + path);
      return route.abort();
    }
    if (path === "/auth/csrf")
      return route.fulfill({ json: success({ csrfToken: csrf }) });
    if (path === "/public/branches")
      return route.fulfill({ json: success({ items: [branch] }) });
    if (path === "/public/services/discovery") {
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
      if (state.networkFailure) return route.abort("internetdisconnected");
      if (state.status !== 200)
        return route.fulfill({
          status: state.status,
          headers: state.status === 429 ? { "Retry-After": "1" } : {},
          json: {
            success: false,
            error: {
              code: state.status === 429 ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE",
            },
          },
        });
      const search = url.searchParams.get("search")?.toLowerCase();
      const pricing = url.searchParams.get("pricingType");
      const category = url.searchParams.get("categoryId");
      const items = state.empty
        ? []
        : state.records.filter(
            (record) =>
              (!search || record.name.toLowerCase().includes(search)) &&
              (!pricing || record.pricingType === pricing) &&
              (!category || record.category?.id === category),
          );
      const more = url.searchParams.has("cursor");
      return route.fulfill({
        json: success({
          items: state.paged ? items.slice(more ? 1 : 0, more ? 2 : 1) : items,
          totalMatches: items.length,
          ...(state.paged && !more && items.length > 1
            ? { nextCursor: "A".repeat(180) }
            : {}),
        }),
      });
    }
    const response = await route.fetch({
      url: origin + url.pathname + url.search,
      maxRedirects: 0,
    });
    return route.fulfill({ response });
  });
  return state;
}
