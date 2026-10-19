import type { Page } from "@playwright/test";
import type { AdminService } from "@/lib/admin/service-catalogue";
import { workBookingsFixture, bookingId } from "./work-bookings";
export { bookingId };
export function serviceRecord(n = 0): AdminService {
  const names = [
    "Comprehensive diagnostics",
    "Engine servicing",
    "Brake inspection",
    "Air conditioning service",
    "Wheel alignment",
  ];
  const name = names[n % names.length];
  return {
    id: bookingId(900 + n),
    name,
    slug: name.toLowerCase().replaceAll(" ", "-"),
    categoryId: bookingId(800 + (n % 3)),
    category: {
      id: bookingId(800 + (n % 3)),
      name: ["Diagnostics", "Maintenance", "Inspections"][n % 3],
      slug: ["diagnostics", "maintenance", "inspections"][n % 3],
    },
    image: null,
    shortDescription: "Professional workshop care.",
    description: null,
    pricingType: n === 2 ? "QUOTE_REQUIRED" : "FIXED",
    priceKobo: n === 2 ? null : n === 1 ? "8500000" : "4500000",
    currency: "NGN",
    durationMinutes: n === 1 ? 120 : n === 2 ? 60 : 90,
    isActive: n !== 2,
    version: 1,
    createdAt: "2026-10-12T08:00:00Z",
    updatedAt: "2026-10-12T08:00:00Z",
  };
}
export async function workServicesFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role);
  const categories = [0, 1, 2].map((n) => ({
    ...serviceRecord(n).category!,
    isActive: n !== 2,
  }));
  const state = {
    mode: "normal",
    categoryMode: "normal",
    detailMode: "normal",
    outcome: "success",
    records: [0, 1, 2, 3, 4].map(serviceRecord),
    reads: [] as URL[],
    writes: [] as { path: string; method: string; body: Record<string, unknown> }[],
    held: undefined as (() => void) | undefined,
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
          meta: { requestId: "work-services" },
          data,
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({ status, json: { success: false, error: { code } } });
    if (path === "/auth/csrf")
      return ok({ csrfToken: "service-qa-csrf-token-".repeat(3) });
    if (path === "/admin/service-categories") {
      if (state.categoryMode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      return ok({
        items: categories.filter(
          (c) => url.searchParams.get("isActive") !== "true" || c.isActive,
        ),
      });
    }
    if (!path.startsWith("/admin/services")) return route.fallback();
    if (method === "GET") {
      state.reads.push(url);
      const mode = path === "/admin/services" ? state.mode : state.detailMode;
      if (mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (mode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (mode === "denied") return fail(403, "FORBIDDEN");
      if (path.endsWith("/images")) return ok({ version: 1, images: [] });
      if (path !== "/admin/services") {
        const row = state.records.find((r) => path.endsWith(r.id));
        if (!row) return fail(404, "NOT_FOUND");
        return ok(mode === "mismatch" ? { ...row, id: bookingId(999) } : row);
      }
      if (mode === "malformed") return ok({ items: [{ id: "bad" }] });
      let items = mode === "empty" ? [] : state.records;
      for (const key of ["isActive", "pricingType", "categoryId"] as const) {
        const value = url.searchParams.get(key);
        if (value) items = items.filter((r) => String(r[key]) === value);
      }
      const search = url.searchParams.get("search");
      if (search)
        items = items.filter((r) =>
          `${r.name} ${r.shortDescription} ${r.description}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        );
      const cursor = url.searchParams.get("cursor");
      if (cursor) items = items.filter((r) => r.id > cursor);
      return ok({
        items: items.slice(0, 3),
        ...(items.length > 3 ? { nextCursor: items[2].id } : {}),
      });
    }
    const body = route.request().postDataJSON();
    state.writes.push({ path, method, body });
    if (state.outcome === "conflict") return fail(409, "STALE_SERVICE_OPERATION");
    if (state.outcome === "denied") return fail(403, "FORBIDDEN");
    if (state.outcome === "uncommitted") return route.abort("failed");
    const current = state.records.find((r) => path.endsWith(r.id));
    const saved = {
      ...(current ?? serviceRecord(10)),
      ...body,
      category:
        body.categoryId !== undefined
          ? (categories.find((c) => c.id === body.categoryId) ?? null)
          : (current?.category ?? null),
      id: current?.id ?? bookingId(910),
      version: (current?.version ?? 0) + 1,
    };
    if (current) Object.assign(current, saved);
    else state.records.push(saved);
    if (state.outcome === "uncertain") return route.abort("failed");
    return ok(saved);
  });
  return { state, base };
}
