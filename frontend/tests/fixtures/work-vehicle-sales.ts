import type { Page } from "@playwright/test";
import type { WorkVehicleSale } from "@/lib/admin/work-vehicle-sales";
import { workVehicleStockFixture, bookingId } from "./work-vehicle-stock";
export { bookingId };
export function salesRecord(n = 0): WorkVehicleSale {
  return {
    id: bookingId(10000 + n),
    transactionNumber: `AAT-VS-2026-${String(n + 1).padStart(3, "0")}`,
    customerId: bookingId(11000 + n),
    customerName:
      n === 0 ? "Amina Okafor" : n === 1 ? "Chidi Obi" : `Synthetic customer ${n}`,
    status: n === 0 ? "ENQUIRY" : n === 1 ? "NEGOTIATING" : "HANDOVER_PENDING",
    version: n,
    askingPriceKobo: n === 0 ? "9999999999999999" : n === 1 ? "4500000000" : "1950000000",
    agreedPriceKobo: n === 0 ? null : n === 1 ? "4400000000" : "1950000000",
    reservationRequiredKobo: n === 1 ? "100000000" : null,
    currency: "NGN",
    reservationExpiresAt: n === 2 ? "2026-10-18T09:00:37.123Z" : null,
    termsVersion: null,
    termsAcceptedAt: null,
    paidAt: n === 2 ? "2026-10-16T13:30:37.123Z" : null,
    cancellationReason: null,
    createdAt: "2026-10-17T09:00:37.123Z",
    vehicleListing: {
      id: bookingId(12000 + n),
      title: n === 0 ? "Toyota Camry SE" : n === 1 ? "Lexus RX 350" : "Toyota Corolla",
      status: n === 2 ? "SOLD" : "AVAILABLE",
      branchId: bookingId(n === 27 ? 103 : 101),
      vehicle: {
        id: bookingId(13000 + n),
        stockNumber: `AA-${String(n + 1).padStart(3, "0")}`,
        make: n === 1 ? "Lexus" : "Toyota",
        model: n === 0 ? "Camry" : n === 1 ? "RX 350" : "Corolla",
        year: 2022,
        images:
          n < 3
            ? [
                {
                  id: bookingId(15000 + n),
                  url: `/api/v1/staff/vehicles/${bookingId(13000 + n)}/images/${bookingId(15000 + n)}/content`,
                  altText: "Synthetic sales stock photo",
                  isPrimary: true,
                },
              ]
            : [],
      },
    },
    statusHistory: [],
    handover:
      n === 2
        ? {
            id: bookingId(14000 + n),
            status: "READY",
            hasSignedDocument: true,
            version: 0,
            recipientName: null,
            recipientPhone: null,
            odometerKm: 0,
            keysDelivered: 0,
            readyAt: "2026-10-17T09:00:37.123Z",
            completedAt: null,
            cancelledAt: null,
          }
        : null,
  };
}
export async function workVehicleSalesFixture(page: Page, role = "ADMIN") {
  const base = await workVehicleStockFixture(page, role),
    state = {
      mode: "normal",
      records: Array.from({ length: 28 }, (_, n) => salesRecord(n)),
      reads: [] as URL[],
      writes: [] as string[],
      held: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic sales",
      meta: { requestId: "work-vehicle-sales" },
    },
  });
  await page.route("**/api/v1/staff/vehicle-transactions**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() !== "GET") {
      state.writes.push(url.pathname);
      return route.fulfill({
        status: 405,
        json: { success: false, error: { code: "FORBIDDEN" } },
      });
    }
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
          error: { code: state.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN" },
        },
      });
    if (state.mode === "malformed") return route.fulfill(ok({ items: [{ id: "bad" }] }));
    if (url.pathname !== "/api/v1/staff/vehicle-transactions") {
      const row = state.records.find((row) => url.pathname.endsWith(row.id));
      return route.fulfill(ok(row));
    }
    let rows =
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
    if (state.mode === "duplicate") rows = [rows[0], rows[0]];
    const cursor = url.searchParams.get("cursor"),
      start = cursor ? rows.findIndex((row) => row.id === cursor) + 1 : 0,
      items = rows.slice(start, start + 25);
    return route.fulfill(
      ok({
        items,
        ...(start + 25 < rows.length ? { nextCursor: items.at(-1)!.id } : {}),
      }),
    );
  });
  return { ...base, sales: state };
}
