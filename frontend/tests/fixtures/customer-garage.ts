import type { Page } from "@playwright/test";
import type { CustomerVehicle } from "@/lib/api/vehicle-schemas";
export const garageId = (n: number) =>
  `d6000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function garageRecord(n = 1): CustomerVehicle {
  return {
    id: garageId(n),
    make: n === 2 ? "Mercedes-Benz" : n === 3 ? "Lexus" : "Toyota",
    model: n === 2 ? "C 300" : n === 3 ? "RX 350" : "Camry",
    year: n === 2 ? 2020 : n === 3 ? 2022 : 2021,
    registrationNumber: n === 3 ? null : n === 2 ? "PHC 801 AA" : "RIV 234 AB",
    color: n === 3 ? null : n === 2 ? "Black" : "Silver",
    vin: n === 1 ? "JTDBR32E720012345" : null,
    mileageKm: n === 3 ? null : n === 2 ? 32500 : 48200,
    createdAt: "2026-10-23T00:00:00.000Z",
    updatedAt: "2026-10-23T00:00:00.000Z",
  };
}
export async function garageFixture(page: Page, role = "CUSTOMER") {
  const state = {
    mode: "normal",
    mutation: "normal",
    records: [garageRecord(), garageRecord(2), garageRecord(3)],
    reads: [] as URL[],
    writes: [] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
      csrf: string | undefined;
    }[],
    held: undefined as (() => void) | undefined,
    releaseMutation: undefined as (() => void) | undefined,
    next: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      endpoint = url.pathname.replace("/api/v1", "");
    let data: unknown = { items: [] };
    if (endpoint === "/auth/session")
      data = {
        id: garageId(98),
        user: { id: garageId(99), email: "garage@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-08T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      };
    if (endpoint === "/auth/csrf") data = { csrfToken: "qa-csrf-token-".repeat(4) };
    if (endpoint.startsWith("/customers/vehicles") && request.method() !== "GET") {
      const body = request.postDataJSON();
      state.writes.push({
        method: request.method(),
        path: endpoint,
        body,
        csrf: request.headers()["x-csrf-token"],
      });
      if (state.mutation === "hold")
        await new Promise<void>((resolve) => (state.releaseMutation = resolve));
      if (state.mutation === "reject")
        return route.fulfill({
          status: 422,
          json: { success: false, error: { code: "VALIDATION_FAILED" } },
        });
      if (state.mutation === "error")
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      if (request.method() === "DELETE") {
        state.records = state.records.filter((v) => v.id !== endpoint.split("/")[3]);
        data = null;
      } else if (request.method() === "POST") {
        const record = { ...garageRecord(10), ...body };
        state.records.push(record);
        data = record;
      } else {
        const i = state.records.findIndex((v) => v.id === endpoint.split("/")[3]);
        state.records[i] = { ...state.records[i], ...body };
        data = state.records[i];
      }
      if (state.mutation === "wrong-identity") data = { ...garageRecord(100) };
    } else if (endpoint === "/customers/vehicles") {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => (state.held = resolve));
      if (state.mode === "error")
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      data =
        state.mode === "malformed"
          ? { vehicles: [{}] }
          : {
              vehicles:
                state.mode === "empty"
                  ? []
                  : url.searchParams.has("cursor")
                    ? [garageRecord(4)]
                    : state.records,
              ...(state.next && !url.searchParams.has("cursor")
                ? { nextCursor: garageId(3) }
                : {}),
            };
    } else if (endpoint.startsWith("/customers/vehicles/"))
      data = {
        ...(state.records.find((v) => v.id === endpoint.split("/")[3]) ?? garageRecord()),
        mediaVersion: 0,
        images: [],
      };
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated garage QA",
        meta: { requestId: "garage-qa" },
        data,
      },
    });
  });
  return state;
}
