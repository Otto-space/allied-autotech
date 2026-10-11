import type { Page } from "@playwright/test";

export const inspectionId = (n: number) =>
  `e5000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function inspectionRecord(n = 1, status = "REQUESTED") {
  return {
    id: inspectionId(n),
    status,
    preferredStartAt: "2026-10-15T09:00:00Z",
    preferredEndAt: "2026-10-15T10:00:00Z",
    scheduledStartAt: status === "REQUESTED" ? null : "2026-10-16T12:00:00Z",
    scheduledEndAt: status === "REQUESTED" ? null : "2026-10-16T13:00:00Z",
    notes: n === 1 ? "Please check the suspension and air conditioning." : null,
    cancellationReason:
      status === "CANCELLED" ? "Customer requested another date." : null,
    conditionReport:
      status === "COMPLETED"
        ? {
            id: inspectionId(100 + n),
            summary: "Engine and transmission checked. Front tyres require attention.",
            inspectedAt: "2026-10-16T12:30:00Z",
            odometerKm: 52400,
            conditionScore: 82,
            findings: { engine: "No abnormal noise", tyres: "Replace front tyres" },
          }
        : null,
    vehicleListing: {
      id: inspectionId(200 + n),
      title: [
        "2021 Toyota Camry",
        "2022 Lexus RX 350",
        "2020 Honda Accord",
        "2023 Toyota Highlander",
      ][(n - 1) % 4],
      status: "AVAILABLE",
      vehicle: { make: "Toyota", model: "Camry", year: 2021, stockNumber: "QA-001" },
    },
    createdAt: "2026-10-09T08:00:00Z",
    version: 0,
  };
}
export async function inspectionsFixture(page: Page, role = "CUSTOMER") {
  const state = {
    mode: "normal",
    records: [
      inspectionRecord(1),
      inspectionRecord(2, "CONFIRMED"),
      inspectionRecord(3, "COMPLETED"),
      inspectionRecord(4, "CANCELLED"),
    ],
    reads: [] as URL[],
    writes: [] as string[],
    held: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace("/api/v1", "");
    if (route.request().method() !== "GET") state.writes.push(endpoint);
    let data: unknown = { items: [] };
    if (endpoint === "/auth/session")
      data = {
        id: inspectionId(301),
        user: { id: inspectionId(302), email: "inspections@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-09T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      };
    if (endpoint === "/customers/vehicle-inspections") {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (state.mode === "offline") return route.abort("internetdisconnected");
      if (["error", "denied", "rate"].includes(state.mode))
        return route.fulfill({
          status: state.mode === "denied" ? 403 : state.mode === "rate" ? 429 : 503,
          json: {
            success: false,
            error: {
              code:
                state.mode === "denied"
                  ? "FORBIDDEN"
                  : state.mode === "rate"
                    ? "RATE_LIMITED"
                    : "DATABASE_UNAVAILABLE",
            },
          },
        });
      const status = url.searchParams.get("status");
      data =
        state.mode === "malformed"
          ? { items: [{}] }
          : {
              items:
                state.mode === "empty"
                  ? []
                  : (url.searchParams.has("cursor")
                      ? [inspectionRecord(5, "RESCHEDULED")]
                      : state.records
                    ).filter((r) => !status || r.status === status),
              ...(!status && !url.searchParams.has("cursor") && state.mode !== "empty"
                ? { nextCursor: inspectionId(4) }
                : {}),
            };
    }
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated QA",
        meta: { requestId: "inspections-qa" },
        data,
      },
    });
  });
  return state;
}
