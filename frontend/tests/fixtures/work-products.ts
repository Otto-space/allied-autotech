import type { Page } from "@playwright/test";
import type { AdminProduct } from "@/lib/admin/product-catalogue";
import { workBookingsFixture, bookingId } from "./work-bookings";
export { bookingId };
export const productCategories = ["Braking", "Lubricants", "Filters"].map((name, i) => ({
  id: bookingId(900 + i),
  name,
  slug: name.toLowerCase(),
  isActive: i !== 2,
}));
export function productRecord(n = 0): AdminProduct {
  return {
    id: bookingId(1000 + n),
    name: [
      "Ceramic brake pads",
      "Engine oil 5W-30",
      "Air filter",
      "Brake disc",
      "Oil filter",
    ][n % 5],
    slug: `synthetic-product-${n}`,
    sku: `QA-PART-${n}`,
    brand: n === 2 ? null : "Quality Parts",
    manufacturerPartNumber: n === 2 ? null : `PART-${n}`,
    description: n === 2 ? null : "Synthetic product for isolated quality checks.",
    priceKobo: n === 4 ? "9999999999999999" : String(1850000 + n * 100),
    compareAtPriceKobo: n === 0 ? "2100000" : null,
    currency: "NGN",
    isActive: n !== 2,
    featured: n === 0,
    mediaVersion: 0,
    createdAt: "2026-10-13T08:00:00.000Z",
    updatedAt: "2026-10-13T08:00:00.000Z",
    category: productCategories[n % 3],
    images: [],
    compatibilities: [],
    availability: [
      {
        branch: { id: bookingId(950), code: "PH", name: "Port Harcourt" },
        inStock: n === 0,
      },
    ],
  };
}
export async function workProductsFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role);
  const state = {
    mode: "normal",
    detailMode: "normal",
    categoriesMode: "normal",
    outcome: "success",
    records: [0, 1, 2, 3, 4].map(productRecord),
    reads: [] as URL[],
    writes: [] as {
      path: string;
      method: string;
      body: Record<string, unknown>;
      csrf?: string;
    }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace("/api/v1", ""),
      method = request.method();
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic QA",
          meta: { requestId: "work-products" },
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({ status, json: { success: false, error: { code } } });
    if (path === "/auth/csrf")
      return ok({ csrfToken: "product-qa-csrf-token-".repeat(3) });
    if (path === "/admin/catalog/categories") {
      if (state.categoriesMode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      return ok(
        url.searchParams.has("cursor")
          ? { items: productCategories.slice(2) }
          : { items: productCategories.slice(0, 2), nextCursor: productCategories[1].id },
      );
    }
    if (!path.startsWith("/admin/catalog/products")) return route.fallback();
    if (method === "GET") {
      state.reads.push(url);
      const list = path === "/admin/catalog/products",
        mode = list ? state.mode : state.detailMode;
      if (mode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (mode === "denied") return fail(403, "FORBIDDEN");
      if (mode === "malformed") return ok({ items: [{ id: "bad" }] });
      if (!list) {
        const row = state.records.find((r) => path.endsWith(r.id));
        if (!row || mode === "missing") return fail(404, "NOT_FOUND");
        return ok(mode === "mismatch" ? { ...row, id: bookingId(1999) } : row);
      }
      let rows =
        mode === "empty"
          ? []
          : state.records.filter((r) => {
              const p = url.searchParams,
                q = p.get("search")?.toLowerCase();
              return (
                (!q ||
                  [r.name, r.sku, r.brand, r.manufacturerPartNumber].some((v) =>
                    v?.toLowerCase().includes(q),
                  )) &&
                (!p.has("categoryId") || p.get("categoryId") === r.category.id) &&
                (!p.has("isActive") || p.get("isActive") === String(r.isActive)) &&
                (!p.has("featured") || p.get("featured") === String(r.featured)) &&
                (!p.has("brand") || p.get("brand") === r.brand)
              );
            });
      const sort = url.searchParams.get("sort");
      if (sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
      if (sort?.startsWith("price_"))
        rows.sort(
          (a, b) =>
            (BigInt(a.priceKobo) < BigInt(b.priceKobo) ? -1 : 1) *
            (sort === "price_asc" ? 1 : -1),
        );
      const cursor = url.searchParams.get("cursor");
      if (cursor) rows = rows.slice(rows.findIndex((r) => r.id === cursor) + 1);
      return ok({
        items: rows.slice(0, 3),
        ...(rows.length > 3 ? { nextCursor: rows[2].id } : {}),
      });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    state.writes.push({ path, method, body, csrf: request.headers()["x-csrf-token"] });
    const existing = state.records.find((r) => path.endsWith(r.id));
    if (
      state.outcome === "reject" ||
      (method === "PATCH" && existing && body.expectedUpdatedAt !== existing.updatedAt)
    )
      return fail(409, "STALE_VERSION");
    if (state.outcome === "reserved") return fail(409, "CONFLICT");
    const saved = {
      ...(existing ?? productRecord(6)),
      ...body,
      category: productCategories.find((r) => r.id === body.categoryId)!,
      updatedAt: "2026-10-13T08:01:00.000Z",
    } as AdminProduct;
    if (state.outcome !== "uncommitted") {
      if (existing) Object.assign(existing, saved);
      else state.records.unshift(saved);
    }
    if (["uncertain", "uncommitted"].includes(state.outcome))
      return route.abort("failed");
    return ok(state.outcome === "contradictory" ? { ...saved, priceKobo: "1" } : saved);
  });
  return { ...base, state };
}
