import type { Page } from "@playwright/test";
import { bookingId, bookingRecord } from "./customer-bookings";
export const detailId = bookingId(1);
export const future = (hours: number) =>
  new Date(Date.now() + hours * 3600000).toISOString();
export function detailRecord() {
  return {
    ...bookingRecord(1, "CONFIRMED"),
    bookingSlotId: bookingId(500) as string | null,
    scheduledAt: future(72),
    requestedAt: new Date(Date.now() - 86400000).toISOString(),
    confirmedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    customerNotes: "Please check the warning light and the brakes.",
    quotes: [
      {
        id: bookingId(501),
        quoteNumber: "QUO-QA-101",
        version: 1,
        revision: 2,
        status: "ISSUED",
        totalKobo: "8500000",
        subtotalKobo: "8000000",
        taxKobo: "500000",
        expiresAt: future(48),
        notes: "Includes diagnostics and the listed replacement parts.",
        items: [
          {
            id: bookingId(502),
            description: "Diagnostic inspection",
            quantity: 1,
            unitPriceKobo: "3000000",
            subtotalKobo: "3000000",
          },
          {
            id: bookingId(503),
            description: "Replacement brake components",
            quantity: 2,
            unitPriceKobo: "2500000",
            subtotalKobo: "5000000",
          },
        ],
      },
    ],
    workOrder: {
      workOrderNumber: "WO-QA-101",
      status: "APPROVED",
      diagnosis: "Initial inspection recorded; work follows the approved service plan.",
    },
  };
}
export async function bookingDetailFixture(page: Page, role = "CUSTOMER") {
  const state = {
    record: detailRecord(),
    mode: "normal",
    reads: [] as string[],
    writes: [] as { path: string; body: unknown; key?: string }[],
    failure: 0,
    held: undefined as (() => void) | undefined,
    policyError: false,
    slotError: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url()),
      endpoint = url.pathname.replace("/api/v1", "");
    let data: unknown = { items: [] };
    if (endpoint === "/auth/session")
      data = {
        id: bookingId(301),
        user: { id: bookingId(302), email: "booking-detail@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : new Date().toISOString(),
        expiresAt: future(24),
        idleExpiresAt: future(12),
      };
    if (endpoint === "/auth/csrf") data = { csrfToken: "isolated-csrf-value-".repeat(3) };
    const fail = (status: number) =>
      route.fulfill({
        status,
        json: {
          success: false,
          error: { code: status === 409 ? "STALE_VERSION" : "DATABASE_UNAVAILABLE" },
        },
      });
    if (
      endpoint === `/customers/bookings/${detailId}` &&
      route.request().method() === "GET"
    ) {
      state.reads.push(endpoint);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => (state.held = resolve));
      if (state.mode === "error") return fail(503);
      data =
        state.mode === "malformed"
          ? {}
          : state.mode === "wrongId"
            ? { ...state.record, id: bookingId(999) }
            : state.record;
    }
    if (endpoint === "/public/booking-policy") {
      if (state.policyError) return fail(503);
      data = {
        version: "owner-booking-request-v2",
        minimumAdvanceHours: 2,
        maximumAdvanceHours: 720,
        paymentHoldMinutes: 0,
        depositBasisPoints: 0,
        depositRefundableForCustomerCancellation: true,
        customerRescheduleLimit: 1,
        customerRescheduleCutoffHours: 24,
        reminderHoursBeforeAppointment: [1],
      };
    }
    if (endpoint.endsWith("/slots")) {
      if (state.slotError) return fail(503);
      data = {
        items: [
          {
            id: bookingId(504),
            branchId: bookingId(101),
            serviceId: bookingId(100),
            startsAt: future(96),
            endsAt: future(97),
            version: 1,
          },
        ],
      };
    }
    if (
      endpoint.startsWith(`/customers/bookings/${detailId}/`) &&
      route.request().method() !== "GET"
    ) {
      state.writes.push({
        path: endpoint,
        body: route.request().postDataJSON(),
        key: route.request().headers()["idempotency-key"],
      });
      if (state.failure) return fail(state.failure);
      if (endpoint.endsWith("/cancel")) {
        state.record.status = "CANCELLED";
        state.record.version++;
      }
      if (endpoint.endsWith("/schedule")) {
        state.record.status = "REQUESTED";
        state.record.version++;
        state.record.customerRescheduleCount++;
      }
      if (endpoint.endsWith("/accept") || endpoint.endsWith("/reject"))
        state.record.quotes[0].status = endpoint.endsWith("/accept")
          ? "ACCEPTED"
          : "REJECTED";
      data = state.record;
    }
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated detail fixture",
        meta: { requestId: "booking-detail-qa" },
        data,
      },
    });
  });
  return state;
}
