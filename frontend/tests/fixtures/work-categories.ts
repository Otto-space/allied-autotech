import type { Page } from "@playwright/test";
import type { AdminCategory } from "@/lib/admin/category-catalogue";
import { workBookingsFixture, bookingId } from "./work-bookings";
export { bookingId };
export function categoryRecord(n = 0): AdminCategory {
  const name = ["Diagnostics", "Maintenance", "Inspections", "Repair", "Wheels"][n % 5];
  return {
    id: bookingId(800 + n),
    name,
    slug: name.toLowerCase(),
    description:
      n === 2
        ? null
        : ["Fault finding and vehicle checks.", "Routine care for your vehicle."][n % 2],
    isActive: n !== 2,
    version: 1,
    createdAt: "2026-10-12T08:00:00Z",
    updatedAt: "2026-10-12T08:00:00Z",
  };
}
export async function workCategoriesFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role);
  const state = {
    mode: "normal",
    detailMode: "normal",
    outcome: "success",
    records: [0, 1, 2, 3, 4].map(categoryRecord),
    reads: [] as URL[],
    writes: [] as { path: string; method: string; body: Record<string, unknown> }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace("/api/v1", ""),
      method = route.request().method();
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic QA",
          meta: { requestId: "work-categories" },
          data,
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({ status, json: { success: false, error: { code } } });
    if (path === "/auth/csrf")
      return ok({ csrfToken: "category-qa-csrf-token-".repeat(3) });
    if (!path.startsWith("/admin/service-categories")) return route.fallback();
    if (method === "GET") {
      state.reads.push(url);
      const list = path === "/admin/service-categories",
        mode = list ? state.mode : state.detailMode;
      if (mode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (mode === "denied") return fail(403, "FORBIDDEN");
      if (mode === "malformed") return ok({ items: [{ id: "bad" }] });
      if (!list) {
        const row = state.records.find((r) => path.endsWith(r.id));
        if (!row || mode === "missing") return fail(404, "NOT_FOUND");
        return ok(mode === "mismatch" ? { ...row, id: bookingId(899) } : row);
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
      if (url.searchParams.has("cursor")) rows = rows.slice(3);
      return ok({
        items: rows.slice(0, 3),
        ...(rows.length > 3 ? { nextCursor: "category_page_two" } : {}),
      });
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    state.writes.push({ path, method, body });
    if (state.outcome === "reject") return fail(409, "STALE_VERSION");
    const existing = state.records.find((r) => path.endsWith(r.id));
    if (method === "PATCH" && existing && body.expectedVersion !== existing.version)
      return fail(409, "STALE_VERSION");
    let saved: AdminCategory;
    if (existing)
      saved = { ...existing, ...body, version: existing.version + 1 } as AdminCategory;
    else saved = { ...categoryRecord(5), ...body, version: 0 } as AdminCategory;
    if (state.outcome !== "uncommitted") {
      if (existing) Object.assign(existing, saved);
      else state.records.unshift(saved);
    }
    if (state.outcome === "uncertain" || state.outcome === "uncommitted")
      return route.abort("failed");
    return ok(saved);
  });
  return { ...base, state };
}
