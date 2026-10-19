import type { Page } from "@playwright/test";
import type { Inventory } from "@/lib/api/inventory-schemas";
import { workBookingsFixture, bookingId } from "./work-bookings";
export { bookingId };
export function stockRecord(n = 0): Inventory {
  return {
    id: bookingId(4000 + n),
    quantity: n === 2 ? 0 : 10,
    reserved: n === 2 ? 0 : 2,
    available: n === 2 ? 0 : 8,
    reorderLevel: n === 1 ? 8 : 5,
    version: 0,
    updatedAt: "2026-10-17T08:00:00.000Z",
    branch: {
      id: bookingId(n === 2 ? 102 : 101),
      code: "QA",
      name: n === 2 ? "Previous workshop" : "Stadium Road workshop",
      isActive: n !== 2,
    },
    product: {
      id: bookingId(4100 + n),
      name: ["Brake pads", "Oil filter", "Air filter"][n % 3],
      sku: `PART-${n + 1}`,
      priceKobo: "10000",
      currency: "NGN",
      isActive: n !== 2,
      category: { id: bookingId(4200), name: "Parts", isActive: true },
    },
  };
}
export async function workInventoryFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role);
  const state = {
    mode: "normal",
    outcome: "success",
    profileMode: "normal",
    records: [0, 1, 2, 3, 4].map(stockRecord),
    reads: [] as URL[],
    writes: [] as { body: Record<string, unknown>; csrf?: string }[],
    held: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1", "");
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic inventory",
          meta: { requestId: "inventory-quality" },
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({ status, json: { success: false, error: { code } } });
    if (path === "/auth/csrf")
      return ok({ csrfToken: "inventory-quality-token-".repeat(3) });
    if (path === "/staff/profile" && state.profileMode !== "normal")
      return state.profileMode === "error"
        ? fail(503, "DATABASE_UNAVAILABLE")
        : ok({
            id: bookingId(9999),
            email: "qa@example.test",
            role,
            status: "ACTIVE",
            capabilities: [],
            staffProfile: null,
          });
    if (path === "/public/branches")
      return ok({ items: [{ id: bookingId(101), name: "Stadium Road workshop" }] });
    if (path === "/public/catalog/products")
      return ok({
        items: [
          {
            ...stockRecord(10).product,
            slug: "synthetic-part",
            description: null,
            brand: null,
            manufacturerPartNumber: null,
            compareAtPriceKobo: null,
            images: [],
            compatibilities: [],
            availability: [],
            category: {
              id: bookingId(4200),
              name: "Parts",
              slug: "parts",
              description: null,
            },
          },
        ],
      });
    if (path === "/admin/inventory") {
      const body = req.postDataJSON() as Record<string, unknown>;
      state.writes.push({ body, csrf: req.headers()["x-csrf-token"] });
      if (state.outcome === "reject") return fail(409, "CONFLICT");
      if (state.outcome === "throttled") return fail(429, "RATE_LIMITED");
      const saved = {
        ...stockRecord(10),
        id: bookingId(4900),
        quantity: 0,
        reserved: 0,
        available: 0,
        reorderLevel: Number(body.reorderLevel),
        branch: { ...stockRecord().branch, id: String(body.branchId) },
        product: { ...stockRecord(10).product, id: String(body.productId) },
      };
      if (state.outcome !== "uncommitted") state.records.push(saved);
      if (["uncertain", "uncommitted"].includes(state.outcome))
        return route.abort("failed");
      return ok(
        state.outcome === "contradictory"
          ? { ...saved, quantity: 1, available: 1 }
          : saved,
      );
    }
    if (path === "/staff/inventory") {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (["error", "denied"].includes(state.mode))
        return fail(
          state.mode === "error" ? 503 : 403,
          state.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN",
        );
      let rows =
        state.mode === "empty"
          ? []
          : state.records.filter(
              (row) =>
                state.mode === "mismatch" ||
                ((!url.searchParams.has("branchId") ||
                  row.branch.id === url.searchParams.get("branchId")) &&
                  (!url.searchParams.has("productId") ||
                    row.product.id === url.searchParams.get("productId")) &&
                  (url.searchParams.get("lowStock") !== "true" ||
                    row.available <= row.reorderLevel) &&
                  (!url.searchParams.get("search") ||
                    `${row.product.name} ${row.product.sku}`
                      .toLowerCase()
                      .includes(url.searchParams.get("search")!.toLowerCase()))),
            );
      const cursor = url.searchParams.get("cursor");
      if (cursor) rows = rows.slice(rows.findIndex((row) => row.id === cursor) + 1);
      return ok(
        state.mode === "malformed"
          ? { items: [{}] }
          : {
              items: rows.slice(0, 3),
              ...(rows.length > 3 ? { nextCursor: rows[2].id } : {}),
            },
      );
    }
    if (/^\/staff\/inventory\/[^/]+$/.test(path))
      return ok(state.records.find((row) => path.endsWith(row.id)) ?? stockRecord());
    if (/^\/staff\/inventory\/[^/]+\/(history|reservations)$/.test(path))
      return ok({ items: [] });
    return route.fallback();
  });
  return { state, base };
}
