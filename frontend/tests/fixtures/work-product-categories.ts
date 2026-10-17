import type { Page } from "@playwright/test";
import type { AdminProductCategory } from "@/lib/admin/product-categories";
import { workBookingsFixture, bookingId } from "./work-bookings";
export { bookingId };
export function productCategoryRecord(n = 0): AdminProductCategory {
  const name = ["Braking", "Lubricants", "Filters", "Suspension", "Wheels"][n % 5];
  return {
    id: bookingId(900 + n),
    name,
    slug: name.toLowerCase(),
    description: n === 2 ? null : "Genuine parts for professional vehicle care.",
    isActive: n !== 2,
    createdAt: "2026-10-13T08:00:00.000Z",
    updatedAt: "2026-10-13T08:00:00.000Z",
  };
}
export async function workProductCategoriesFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role);
  const state = {
    mode: "normal",
    detailMode: "normal",
    outcome: "success",
    records: [0, 1, 2, 3, 4].map(productCategoryRecord),
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
          meta: { requestId: "product-category-qa" },
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({ status, json: { success: false, error: { code } } });
    if (path === "/auth/csrf")
      return ok({ csrfToken: "product-category-qa-csrf-token-".repeat(3) });
    if (!path.startsWith("/admin/catalog/categories")) return route.fallback();
    const existing = state.records.find((r) => path.endsWith(r.id));
    if (method === "GET") {
      state.reads.push(url);
      const list = path === "/admin/catalog/categories",
        mode = list ? state.mode : state.detailMode;
      if (mode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (mode === "denied") return fail(403, "FORBIDDEN");
      if (mode === "malformed") return ok({ items: [{ id: "bad" }] });
      if (!list) {
        if (!existing || mode === "missing") return fail(404, "NOT_FOUND");
        return ok(mode === "mismatch" ? { ...existing, id: bookingId(999) } : existing);
      }
      let rows =
        mode === "empty"
          ? []
          : state.records.filter(
              (r) =>
                (!url.searchParams.get("search") ||
                  r.name
                    .toLowerCase()
                    .startsWith(url.searchParams.get("search")!.toLowerCase())) &&
                (!url.searchParams.has("isActive") ||
                  String(r.isActive) === url.searchParams.get("isActive")),
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
    if (
      state.outcome === "reject" ||
      (existing && body.expectedUpdatedAt !== existing.updatedAt)
    )
      return fail(409, "CONFLICT");
    const saved = {
      ...(existing ?? productCategoryRecord(5)),
      ...body,
      updatedAt: "2026-10-13T08:01:00.000Z",
    } as AdminProductCategory;
    if (state.outcome !== "uncommitted") {
      if (existing) Object.assign(existing, saved);
      else state.records.unshift(saved);
    }
    if (["uncertain", "uncommitted"].includes(state.outcome))
      return route.abort("failed");
    return ok(
      state.outcome === "contradictory"
        ? { ...saved, name: "Unexpected response" }
        : saved,
    );
  });
  return { ...base, state };
}
