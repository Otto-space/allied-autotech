import type { Page } from "@playwright/test";
import { stockRecord, workVehicleStockFixture, bookingId } from "./work-vehicle-stock";
export { bookingId };
export async function workVehicleDetailFixture(page: Page, role = "ADMIN") {
  const base = await workVehicleStockFixture(page, role);
  const state = {
    record: stockRecord(),
    mode: "normal",
    writeMode: "normal",
    reads: 0,
    writes: [] as Record<string, unknown>[],
    held: undefined as (() => void) | undefined,
  };
  Object.assign(state.record, {
    acquiredAt: "2026-10-17T09:00:37.123Z",
    acquisitionCostKobo: "9999999999999999",
    mileageKm: 0,
    engineSize: "2.5L",
    driveType: "FWD",
    color: "Pearl White",
    vin: "JTNBE46KX73000001",
    chassisNumber: "SYNTHETIC-CHASSIS",
    registrationNumber: "QA-001",
  });
  state.record.listings[0].description =
    "Synthetic workshop listing.\nRecorded specifications are reviewed separately.";
  state.record.documents = [
    {
      id: bookingId(7300),
      type: "OWNERSHIP",
      verificationStatus: "PENDING",
      rejectionReason: null,
      issuedAt: "2026-10-01T09:00:00Z",
      expiresAt: null,
      verifiedAt: null,
      mimeType: "application/pdf",
      sizeBytes: "4096",
      createdAt: "2026-10-17T09:00:00Z",
      version: 0,
    },
  ];
  state.record.conditionReports = [
    {
      id: bookingId(7400),
      summary: "Synthetic observed condition",
      findings: { Tyres: "Inspected", Warning: false, Measurement: 0, Unknown: null },
      odometerKm: 0,
      conditionScore: 0,
      inspectedAt: "2026-10-17T09:00:37.123Z",
    },
  ];
  const ok = (data: unknown) => ({
    json: {
      success: true,
      message: "Synthetic detail",
      data,
      meta: { requestId: "stock-detail-quality" },
    },
  });
  function safe() {
    const row = structuredClone(state.record);
    if (role === "STAFF" && state.mode !== "leak") {
      delete row.acquisitionCostKobo;
      delete row.acquisitionCurrency;
    }
    return row;
  }
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill(ok({ csrfToken: "synthetic-detail-token-".repeat(4) })),
  );
  await page.route("**/api/v1/staff/vehicles**", async (route) => {
    const req = route.request(),
      endpoint = new URL(req.url()).pathname;
    if (endpoint.includes("/images/")) return route.fallback();
    if (endpoint !== `/api/v1/staff/vehicles/${state.record.id}`) return route.fallback();
    if (req.method() === "GET") {
      state.reads++;
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (["error", "denied", "missing"].includes(state.mode))
        return route.fulfill({
          status: state.mode === "error" ? 503 : state.mode === "denied" ? 403 : 404,
          json: {
            success: false,
            error: {
              code: state.mode === "error" ? "DATABASE_UNAVAILABLE" : "NOT_FOUND",
            },
          },
        });
      if (state.mode === "malformed") return route.fulfill(ok({ id: state.record.id }));
      return route.fulfill(
        ok(state.mode === "mismatch" ? { ...safe(), id: bookingId(999) } : safe()),
      );
    }
    if (req.method() !== "PATCH") return route.fallback();
    const body = req.postDataJSON();
    state.writes.push(body);
    if (state.writeMode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["reject", "throttle"].includes(state.writeMode))
      return route.fulfill({
        status: state.writeMode === "reject" ? 409 : 429,
        json: { success: false, error: { code: "VEHICLE_CONFLICT" } },
      });
    const { expectedVersion: _version, ...values } = body;
    void _version;
    Object.assign(state.record, values, { version: state.record.version + 1 });
    if (state.writeMode === "lost") return route.abort("failed");
    if (state.writeMode === "malformed")
      return route.fulfill(ok({ id: state.record.id }));
    if (state.writeMode === "mismatch")
      return route.fulfill(ok({ ...safe(), color: "Unexpected" }));
    return route.fulfill(ok(safe()));
  });
  return { ...base, detail: state };
}
