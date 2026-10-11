import type { Page } from "@playwright/test";
import { z } from "zod";
import { bookingSchema } from "@/lib/api/booking-schemas";
export const bookingId = (n: number) =>
  `d1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function bookingRecord(
  n = 1,
  status = "REQUESTED",
): z.infer<typeof bookingSchema> {
  return {
    id: bookingId(n),
    status,
    version: 1,
    scheduledAt: "2026-10-12T09:00:00Z",
    service: {
      id: bookingId(100),
      name:
        n === 1
          ? "Vehicle diagnostics"
          : n === 2
            ? "Routine service"
            : n === 3
              ? "Brake inspection"
              : "Wheel alignment",
      slug: "qa-service",
      description: null,
      shortDescription: null,
      pricingType: "FIXED",
      priceKobo: "5000000",
      currency: "NGN",
      durationMinutes: 60,
      version: 1,
      image: null,
    },
    branch: { id: bookingId(101), code: "QA", name: "Stadium Road workshop" },
    vehicle: {
      id: bookingId(102),
      make: "Toyota",
      model: "Corolla",
      year: 2020,
      registrationNumber: "QA-123-AA",
    },
    customerNotes: null,
    depositAmountKobo: n === 3 ? null : "1500000",
    depositPaidAt: n === 1 ? "2026-10-08T08:00:00Z" : null,
    paymentHoldExpiresAt: null,
    customerRescheduleCount: 0,
    disruptionRequestedAt: null,
    disruptionReason: null,
    disruptionResolution: null,
    depositPayment:
      n === 3
        ? null
        : {
            id: bookingId(200 + n),
            status: n === 1 ? "SUCCEEDED" : "REQUIRES_PAYMENT",
            amountKobo: "1500000",
          },
    quotes: [],
    workOrder: null,
  };
}
export async function bookingsFixture(page: Page, role = "CUSTOMER") {
  const state = {
    mode: "normal",
    records: [
      bookingRecord(1, "IN_PROGRESS"),
      bookingRecord(2, "CONFIRMED"),
      bookingRecord(3),
      bookingRecord(4, "AWAITING_DEPOSIT"),
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
        id: bookingId(301),
        user: { id: bookingId(302), email: "bookings@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-08T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      };
    if (endpoint === "/customers/bookings") {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => (state.held = resolve));
      if (state.mode === "error")
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      const status = url.searchParams.get("status");
      const records = url.searchParams.has("cursor")
        ? [bookingRecord(5, "COMPLETED")]
        : state.records;
      data =
        state.mode === "malformed"
          ? { items: [{}] }
          : {
              items:
                state.mode === "empty"
                  ? []
                  : records.filter((r) => !status || r.status === status),
              ...(!url.searchParams.has("cursor") && state.mode !== "empty" && !status
                ? { nextCursor: bookingId(4) }
                : {}),
            };
    }
    if (endpoint.startsWith("/customers/bookings/"))
      data =
        state.records.find((r) => r.id === endpoint.split("/").at(-1)) ??
        bookingRecord(5, "COMPLETED");
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated QA fixture",
        meta: { requestId: "bookings-qa" },
        data,
      },
    });
  });
  return state;
}
