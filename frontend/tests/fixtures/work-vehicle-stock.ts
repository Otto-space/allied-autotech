import type { Page } from "@playwright/test";
import path from "node:path";
import type { StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import { workBookingsFixture, bookingId } from "./work-bookings";
export { bookingId };
export function stockRecord(n = 0): StaffVehicle {
  const branchId = bookingId(n === 2 ? 102 : n === 4 ? 103 : 101),
    id = bookingId(7000 + n);
  return {
    id,
    branchId,
    stockNumber: ["AA-001", "AA-002", "AA-003", "AA-004", "QA%_4"][n % 5],
    make: n === 1 ? "Lexus" : n === 4 ? "Test%_Make" : "Toyota",
    model: n === 1 ? "RX 350" : n === 4 ? "Model\\_Rate" : n === 0 ? "Camry" : "Corolla",
    trim: n === 0 ? "SE" : null,
    year: n === 0 ? 2022 : n === 1 ? 2020 : 2018,
    mileageKm: n === 0 ? 62000 : n === 1 ? 45000 : n === 2 ? 120000 : n === 3 ? 0 : null,
    transmission: "AUTOMATIC",
    fuelType: "PETROL",
    condition: n === 3 ? "NEW" : "USED",
    bodyType: n === 1 ? "SUV" : "SEDAN",
    engineSize: null,
    driveType: null,
    color: null,
    doors: 4,
    seats: 5,
    vin: null,
    chassisNumber: null,
    registrationNumber: null,
    acquisitionCostKobo: "100000000",
    acquisitionCurrency: "NGN",
    acquiredAt: null,
    version: 0,
    branch: {
      id: branchId,
      code: n === 2 ? "OLD" : n === 4 ? "OTHER" : "PH01",
      name:
        n === 2
          ? "Previous workshop"
          : n === 4
            ? "Remote workshop"
            : "Stadium Road workshop",
      isActive: n !== 2,
    },
    listings:
      n === 2
        ? []
        : [
            {
              id: bookingId(7100 + n),
              title:
                n === 1
                  ? "Lexus RX 350"
                  : n === 0
                    ? "Toyota Camry SE"
                    : "Workshop vehicle",
              slug: `synthetic-stock-${n}`,
              priceKobo:
                n === 1 ? "4500000000" : n === 3 ? "9999999999999999" : "2850000000",
              currency: "NGN",
              description: null,
              status: n === 1 ? "RESERVED" : n === 3 ? "DRAFT" : "AVAILABLE",
              featured: false,
              version: 0,
              publishedAt: n === 3 ? null : "2026-10-01T09:00:00Z",
              reservedAt: n === 1 ? "2026-10-17T09:00:00Z" : null,
              soldAt: null,
              archivedAt: null,
            },
          ],
    images:
      n < 2
        ? [
            {
              id: bookingId(7200 + n),
              url: `/api/v1/staff/vehicles/${id}/images/${bookingId(7200 + n)}/content`,
              altText: "Synthetic stock photo",
              sortOrder: 0,
              isPrimary: true,
            },
          ]
        : [],
    documents: [],
    conditionReports: [],
  };
}
export async function workVehicleStockFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role),
    state = {
      mode: "normal",
      profileMode: "normal",
      profileBranch: bookingId(101) as string | null,
      records: [0, 1, 2, 3, 4].map(stockRecord),
      reads: [] as URL[],
      writes: [] as string[],
      imageReads: [] as string[],
      branchReads: [] as string[],
      imageMode: "normal",
      held: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      message: "Synthetic stock",
      data,
      meta: { requestId: "vehicle-stock-quality" },
    },
  });
  await page.route("**/api/v1/staff/profile", async (route) => {
    if (state.profileMode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["error", "denied"].includes(state.profileMode))
      return route.fulfill({
        status: state.profileMode === "error" ? 503 : 403,
        json: {
          success: false,
          error: {
            code: state.profileMode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN",
          },
        },
      });
    return route.fulfill(
      ok({
        id: bookingId(302),
        email: "stock@example.test",
        role: base.role,
        status: state.profileMode === "inactive" ? "SUSPENDED" : "ACTIVE",
        capabilities: [],
        staffProfile: {
          id: bookingId(601),
          firstName: "Synthetic",
          lastName: "Stock",
          branchId: state.profileBranch,
        },
      }),
    );
  });
  await page.route("**/api/v1/admin/branches/**", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
    state.branchReads.push(id);
    return route.fulfill(
      ok({
        id,
        name: id === bookingId(103) ? "Remote workshop" : "Previous workshop",
        isActive: id !== bookingId(102),
      }),
    );
  });
  await page.route("**/api/v1/staff/vehicles**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      pathName = url.pathname;
    if (pathName.includes("/images/")) {
      state.imageReads.push(pathName);
      return state.imageMode === "error"
        ? route.fulfill({ status: 404, body: "Unavailable" })
        : route.fulfill({
            path: path.resolve("public/images/allied-autotech/showroom-editorial.webp"),
            contentType: "image/webp",
          });
    }
    if (req.method() !== "GET") {
      state.writes.push(pathName);
      return route.fulfill({
        status: 405,
        json: { success: false, error: { code: "FORBIDDEN" } },
      });
    }
    const staff = base.role === "STAFF";
    const safe = (row: StaffVehicle) => {
      if (!staff || state.mode === "leak") return row;
      const { acquisitionCostKobo: _cost, acquisitionCurrency: _currency, ...rest } = row;
      void _cost;
      void _currency;
      return rest;
    };
    if (pathName !== "/api/v1/staff/vehicles")
      return route.fulfill(
        ok(
          safe(
            state.records.find((row) => pathName.endsWith(row.id)) ?? state.records[0],
          ),
        ),
      );
    state.reads.push(url);
    if (state.mode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (
      ["error", "denied"].includes(state.mode) ||
      (staff && state.profileBranch === bookingId(102))
    )
      return route.fulfill({
        status: state.mode === "error" ? 503 : 403,
        json: {
          success: false,
          error: { code: state.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN" },
        },
      });
    if (state.mode === "malformed") return route.fulfill(ok({ items: [{ id: "bad" }] }));
    const q = url.searchParams;
    let rows =
      state.mode === "empty"
        ? []
        : state.records.filter(
            (row) =>
              state.mode === "mismatch" ||
              ((!staff || row.branchId === state.profileBranch) &&
                (!q.has("branchId") || row.branchId === q.get("branchId")) &&
                (!q.has("year") || String(row.year) === q.get("year")) &&
                (!q.has("status") ||
                  row.listings.some((item) => item.status === q.get("status"))) &&
                (q.get("listed") !== "false" || !row.listings.length) &&
                (q.get("listed") !== "true" || row.listings.length > 0) &&
                (!q.has("make") ||
                  row.make.toLowerCase() === q.get("make")!.toLowerCase()) &&
                (!q.has("model") ||
                  row.model.toLowerCase() === q.get("model")!.toLowerCase()) &&
                (!q.has("search") ||
                  [row.stockNumber, row.make, row.model, row.vin ?? ""].some((v) =>
                    v.toLowerCase().includes(q.get("search")!.toLowerCase()),
                  ))),
          );
    const cursor = q.get("cursor");
    if (cursor) rows = rows.slice(rows.findIndex((row) => row.id === cursor) + 1);
    const page = rows.slice(0, 3).map(safe);
    return route.fulfill(
      ok({
        items: state.mode === "duplicate" ? [page[0], page[0]] : page,
        ...(rows.length > 3 ? { nextCursor: page.at(-1)!.id } : {}),
      }),
    );
  });
  return { base, state };
}
