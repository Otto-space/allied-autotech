import type { Page } from "@playwright/test";
import { workInvoiceFixture, id } from "./work-invoices";
export { id };
export function branchRow(n = 0) {
  return {
    id: id(290000 + n),
    code: `BR-${String(n + 1).padStart(3, "0")}`,
    name: ["Stadium Road workshop", "Rumuola workshop", "Trans-Amadi workshop"][n % 3]!,
    address:
      n === 0 ? "133 Stadium Road, beside Kilimanjaro" : "Synthetic branch address",
    city: "Port Harcourt",
    state: "Rivers State",
    country: "Nigeria",
    timezone: "Africa/Lagos",
    phone: n === 2 ? null : "+2348000000000",
    email: n === 2 ? null : `branch-${n}@example.test`,
    isActive: n !== 2,
    createdAt: "2026-10-18T08:00:00.000Z",
    updatedAt: "2026-10-18T09:00:00.000Z",
  };
}
export async function workBranchesFixture(page: Page, role = "ADMIN") {
  const base = await workInvoiceFixture(page, role);
  const state = {
    base,
    mode: "normal",
    mutationMode: "normal",
    rows: Array.from({ length: 3 }, (_, n) => branchRow(n)),
    reads: [] as URL[],
    writes: [] as { method: string; path: string; body: unknown }[],
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic branch QA",
      meta: { requestId: "branch-test" },
    },
  });
  await page.route("**/api/v1/admin/branches**", async (route) => {
    const url = new URL(route.request().url()),
      method = route.request().method();
    if (method !== "GET") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      state.writes.push({
        method,
        path: url.pathname,
        body,
      });
      if (state.mutationMode === "reject")
        return route.fulfill({
          status: 409,
          json: {
            success: false,
            error: {
              code: "ORGANIZATION_CONFLICT",
              message: "Active staff remain assigned to this branch.",
            },
          },
        });
      const target = url.pathname.match(/\/branches\/([^/]+)$/)?.[1];
      const before = state.rows.find((row) => row.id === target);
      const changes = { ...body };
      delete changes.expectedRevision;
      const saved = {
        ...(before ?? {
          ...branchRow(30),
          id: id(290100),
          createdAt: "2026-10-19T09:00:00.000Z",
        }),
        ...changes,
        updatedAt: "2026-10-19T10:00:00.000Z",
      } as ReturnType<typeof branchRow>;
      if (before) state.rows = state.rows.map((row) => (row.id === target ? saved : row));
      else state.rows.push(saved);
      if (state.mutationMode === "lost") return route.abort("failed");
      if (state.mutationMode === "malformed")
        return route.fulfill(ok({ ...saved, name: "Unexpected receipt name" }));
      return route.fulfill({ status: before ? 200 : 201, ...ok(saved) });
    }
    state.reads.push(url);
    if (["error", "denied"].includes(state.mode))
      return route.fulfill({
        status: state.mode === "denied" ? 403 : 503,
        json: {
          success: false,
          error: { code: state.mode === "denied" ? "FORBIDDEN" : "DATABASE_UNAVAILABLE" },
        },
      });
    const target = url.pathname.match(/\/branches\/([^/]+)$/)?.[1];
    if (target) {
      const found = state.rows.find((v) => v.id === target);
      return found ? route.fulfill(ok(found)) : route.fulfill({ status: 404 });
    }
    let rows = state.mode === "empty" ? [] : state.rows;
    const q = url.searchParams,
      search = q.get("q")?.toLowerCase();
    if (q.has("isActive"))
      rows = rows.filter((v) => v.isActive === (q.get("isActive") === "true"));
    if (q.has("code")) rows = rows.filter((v) => v.code === q.get("code"));
    if (search)
      rows = rows.filter((v) =>
        [v.name, v.code, v.city, v.state].some((s) => s.toLowerCase().includes(search)),
      );
    if (q.has("cursor")) rows = rows.filter((v) => v.id > q.get("cursor")!);
    const items = rows.slice(0, 25);
    return route.fulfill(
      ok({ items, ...(rows.length > 25 ? { nextCursor: items.at(-1)!.id } : {}) }),
    );
  });
  return state;
}
