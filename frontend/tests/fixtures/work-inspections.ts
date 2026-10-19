import type { Page } from "@playwright/test";
import { inspectionFixture } from "./inspection";
import { workVehicleStockFixture, bookingId } from "./work-vehicle-stock";
export { bookingId };
export async function workInspectionsFixture(page: Page, role = "ADMIN") {
  const base = await workVehicleStockFixture(page, role),
    state = {
      mode: "normal",
      writeMode: "normal",
      reads: [] as URL[],
      writes: [] as Record<string, unknown>[],
      records: Array.from({ length: 28 }, (_, n) => ({
        ...inspectionFixture(),
        id: bookingId(8000 + n),
        customerName: n === 0 ? "Amina Okafor" : `Synthetic customer ${n}`,
        version: 0,
        notes: n === 0 ? "Please check the engine noise." : null,
        preferredStartAt: "2026-10-20T09:00:37.123Z",
        preferredEndAt: "2026-10-20T10:00:37.123Z",
        vehicleListing: {
          ...inspectionFixture().vehicleListing,
          id: bookingId(8100 + n),
          title:
            n === 0
              ? "Toyota Camry SE"
              : n === 1
                ? "Lexus RX 350"
                : `Synthetic vehicle ${n}`,
          branchId: bookingId(n === 27 ? 103 : 101),
          vehicle: {
            make: "Toyota",
            model: n === 0 ? "Camry" : "Corolla",
            year: 2022,
            stockNumber: `AA-${String(n + 1).padStart(3, "0")}`,
          },
        },
      })),
      held: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      message: "Synthetic inspection",
      data,
      meta: { requestId: "work-inspection-quality" },
    },
  });
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill(ok({ csrfToken: "synthetic-inspection-csrf-".repeat(4) })),
  );
  await page.route("**/api/v1/admin/staff**", (route) =>
    route.fulfill(
      ok({
        items: [
          {
            id: bookingId(302),
            email: "assignee@example.test",
            role: "STAFF",
            status: "ACTIVE",
            staffProfile: {
              id: bookingId(601),
              firstName: "Ada",
              lastName: "James",
              branchId: bookingId(101),
            },
          },
        ],
      }),
    ),
  );
  await page.route("**/api/v1/staff/vehicle-inspections**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() === "GET") {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (["error", "denied"].includes(state.mode))
        return route.fulfill({
          status: state.mode === "error" ? 503 : 403,
          json: {
            success: false,
            error: {
              code: state.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN",
            },
          },
        });
      if (state.mode === "malformed")
        return route.fulfill(ok({ items: [{ id: "bad" }] }));
      let records =
        state.mode === "empty"
          ? []
          : state.records.filter(
              (row) =>
                (role !== "STAFF" ||
                  state.mode === "foreign" ||
                  row.vehicleListing.branchId === base.state.profileBranch) &&
                (!url.searchParams.has("status") ||
                  row.status === url.searchParams.get("status")) &&
                (!url.searchParams.has("branchId") ||
                  row.vehicleListing.branchId === url.searchParams.get("branchId")),
            );
      if (state.mode === "duplicate") records = [records[0], records[0]];
      const cursor = url.searchParams.get("cursor"),
        start = cursor ? records.findIndex((row) => row.id === cursor) + 1 : 0,
        items = records.slice(start, start + 25);
      return route.fulfill(
        ok({
          items,
          ...(start + 25 < records.length ? { nextCursor: items.at(-1)!.id } : {}),
        }),
      );
    }
    const body = request.postDataJSON();
    state.writes.push(body);
    if (state.writeMode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["reject", "throttle"].includes(state.writeMode))
      return route.fulfill({
        status: state.writeMode === "reject" ? 409 : 429,
        json: { success: false, error: { code: "VEHICLE_SALE_STALE" } },
      });
    const row = state.records.find((row) => url.pathname.includes(row.id))!;
    row.status = body.status;
    row.version++;
    if (body.scheduledStartAt) {
      row.scheduledStartAt = body.scheduledStartAt;
      row.scheduledEndAt = body.scheduledEndAt;
    }
    if (body.reason) row.cancellationReason = body.reason;
    if (role === "STAFF" || body.assignedStaffId) {
      row.assignedStaffId = role === "STAFF" ? bookingId(601) : body.assignedStaffId;
      row.assignedStaff = {
        id: row.assignedStaffId!,
        firstName: "Ada",
        lastName: "James",
      };
    }
    if (state.writeMode === "lost") return route.abort("failed");
    if (state.writeMode === "malformed") return route.fulfill(ok({ id: row.id }));
    if (state.writeMode === "mismatch")
      return route.fulfill(ok({ ...row, version: row.version + 1 }));
    return route.fulfill(ok(row));
  });
  return { ...base, inspections: state };
}
