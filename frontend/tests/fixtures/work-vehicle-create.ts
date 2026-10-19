import type { Page } from "@playwright/test";
import type { StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import { workVehicleStockFixture, stockRecord, bookingId } from "./work-vehicle-stock";
export { bookingId };
export async function workVehicleCreateFixture(page: Page, role = "ADMIN") {
  const stock = await workVehicleStockFixture(page, role),
    state = {
      mode: "normal",
      branchMode: "normal",
      posts: [] as Record<string, unknown>[],
      saved: undefined as StaffVehicle | undefined,
      held: undefined as (() => void) | undefined,
    };
  const success = (data: unknown) => ({
    json: {
      success: true,
      message: "Synthetic creation",
      data,
      meta: { requestId: "stock-create-quality" },
    },
  });
  const safe = (row: StaffVehicle) => {
    if (stock.base.role !== "STAFF") return row;
    const { acquisitionCostKobo: _cost, acquisitionCurrency: _currency, ...rest } = row;
    void _cost;
    void _currency;
    return rest;
  };
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill(success({ csrfToken: "synthetic-creation-token-".repeat(3) })),
  );
  await page.route("**/api/v1/admin/branches/**", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
    return route.fulfill(
      success({
        id: state.branchMode === "mismatch" ? bookingId(999) : id,
        name: id === bookingId(101) ? "Stadium Road workshop" : "Remote workshop",
        isActive: state.branchMode !== "inactive",
      }),
    );
  });
  await page.route("**/api/v1/staff/vehicles**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() !== "POST" || url.pathname !== "/api/v1/staff/vehicles")
      return route.fallback();
    const body = req.postDataJSON();
    state.posts.push(body);
    if (state.mode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (state.mode === "reject")
      return route.fulfill({
        status: 409,
        json: { success: false, error: { code: "VEHICLE_CONFLICT" } },
      });
    if (["timeout", "throttle"].includes(state.mode))
      return route.fulfill({
        status: state.mode === "timeout" ? 408 : 429,
        json: { success: false, error: { code: "REQUEST_FAILED" } },
      });
    if (state.mode === "unavailable")
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
      });
    const saved = {
      ...stockRecord(),
      ...body,
      id: bookingId(9000),
      branch: {
        id: body.branchId,
        name: "Stadium Road workshop",
        code: "PH01",
        isActive: true,
      },
      acquiredAt: body.acquiredAt ? new Date(body.acquiredAt).toISOString() : null,
      listings: [],
      images: [],
      conditionReports: [],
      documents: [],
    };
    state.saved = saved;
    stock.state.records.unshift(saved);
    if (state.mode === "lost") return route.abort("failed");
    if (state.mode === "malformed") return route.fulfill(success({ id: saved.id }));
    if (state.mode === "mismatch")
      return route.fulfill(success(safe({ ...saved, stockNumber: "OTHER" })));
    if (state.mode === "leak") return route.fulfill(success(saved));
    return route.fulfill(success(safe(saved)));
  });
  return { state, stock };
}
