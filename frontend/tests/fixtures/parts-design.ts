import { expect, type APIRequestContext, type Page } from "@playwright/test";
import path from "node:path";
import { parseProductDiscovery } from "@/lib/api/commerce-schemas";
import { id } from "./public-account-actions";

export const partsDesignId = id(94101);
export const partsDesignCategory = id(94111);
export const partsDesignChild = id(94112);

/** Dedicated loopback records support matching SSR and browser reads. No real writes. */
export async function partsDesignFixture(request: APIRequestContext, page: Page) {
  const origin = process.env.CAPABILITY_TEST_CONTROL_ORIGIN;
  if (origin !== "http://127.0.0.1:5024")
    throw new Error("Parts design checks require the isolated loopback API");
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
  const seed = await request.get(
    `${origin}/api/v1/public/catalog/products/discovery?search=stitch-fixture`,
  );
  expect(seed.ok()).toBe(true);
  const state = {
    records: parseProductDiscovery((await seed.json()).data).items,
    status: 200,
    empty: false,
    paged: false,
    delay: 0,
    networkFailure: false,
    unexpectedWrites: [] as string[],
  };
  const success = (data: unknown) => ({
    success: true,
    data,
    message: "Isolated Parts design fixture",
    meta: { requestId: "parts-design" },
  });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const pathname = url.pathname.replace(/^\/api\/v1/, "");
    if (req.method() !== "GET") {
      state.unexpectedWrites.push(req.method() + " " + pathname);
      return route.abort();
    }
    if (/^\/public\/catalog\/products\/images\//.test(pathname))
      return route.fulfill({
        path: path.resolve("public/images/allied-autotech/parts-editorial.webp"),
        contentType: "image/webp",
      });
    if (pathname === "/public/catalog/categories") {
      const child = url.searchParams.get("parentId");
      return route.fulfill({
        json: success({
          items: child
            ? child === partsDesignCategory
              ? [
                  {
                    id: partsDesignChild,
                    parentId: partsDesignCategory,
                    name: "Synthetic empty subcategory",
                    slug: "test-child",
                    description: null,
                  },
                ]
              : []
            : [
                {
                  id: partsDesignCategory,
                  parentId: null,
                  name: "Synthetic parts category",
                  slug: "test-root",
                  description: null,
                },
              ],
        }),
      });
    }
    if (
      pathname === "/public/catalog/products/discovery" &&
      (url.searchParams.get("search")?.startsWith("stitch-fixture") ||
        [partsDesignCategory, partsDesignChild].includes(
          url.searchParams.get("categoryId") ?? "",
        ))
    ) {
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
      const search = url.searchParams.get("search")?.toLowerCase(),
        stock = url.searchParams.get("availability");
      let items = state.empty
        ? []
        : state.records.filter(
            (record) =>
              (!search || record.name.toLowerCase().includes(search)) &&
              url.searchParams.get("categoryId") !== partsDesignChild &&
              (!stock ||
                record.availability.some(
                  (entry) => entry.inStock === (stock === "in_stock"),
                )),
          );
      const sort = url.searchParams.get("sort");
      if (sort === "price_asc" || sort === "price_desc")
        items = [...items].sort((a, b) => {
          const difference = BigInt(a.priceKobo) - BigInt(b.priceKobo);
          return (
            (difference < 0 ? -1 : difference > 0 ? 1 : 0) *
            (sort === "price_asc" ? 1 : -1)
          );
        });
      const more = url.searchParams.has("cursor");
      return route.fulfill({
        json: success({
          items: state.paged ? items.slice(more ? 2 : 0, more ? 4 : 2) : items,
          totalMatches: items.length,
          ...(state.paged && !more && items.length > 2
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
