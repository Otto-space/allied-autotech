import type { Page } from "@playwright/test";
import { workBookingsFixture, workBooking, bookingId } from "./work-bookings";
export { bookingId };
export async function workBookingDetailFixture(page: Page, role = "ADMIN") {
  const list = await workBookingsFixture(page, role);
  const state = {
    record: {
      ...workBooking(1, "CONFIRMED"),
      depositAmountKobo: null,
      depositPaidAt: null,
      customerNotes: "Engine warning light appears intermittently.",
      staffNotes: "Check stored fault codes.",
      quotes: [] as ReturnType<typeof workBooking>["quotes"],
      workOrder: null as null | {
        id: string;
        workOrderNumber: string;
        status: string;
        version: number;
        diagnosis: string | null;
        internalNotes: string | null;
        items: {
          id: string;
          type: string;
          productId: null;
          description: string;
          quantity: number;
          unitPriceKobo: string;
          subtotalKobo: string;
        }[];
      },
    },
    mode: "normal",
    accessMode: "normal",
    capability: false,
    assigned: true,
    profile: true,
    reads: 0,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    held: undefined as (() => void) | undefined,
    outcome: "success",
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "QA",
          meta: { requestId: "booking-detail-qa" },
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({ status, json: { success: false, error: { code } } });
    if (path === "/auth/csrf")
      return ok({ csrfToken: "booking-detail-qa-csrf-".repeat(3) });
    if (path === "/staff/profile") {
      if (state.accessMode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      return ok({
        id: bookingId(302),
        email: "workshop@example.test",
        role,
        status: "ACTIVE",
        capabilities: state.capability ? ["BOOKING_CONFIRM"] : [],
        staffProfile: state.profile
          ? {
              id: bookingId(601),
              firstName: "Ada",
              lastName: "Okoro",
              branchId: bookingId(101),
            }
          : null,
      });
    }
    if (path === `/staff/bookings/${bookingId(1)}`) {
      state.reads++;
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (state.mode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (state.mode === "denied") return fail(403, "FORBIDDEN");
      if (state.mode === "malformed") return ok({ id: bookingId(1) });
      return ok({
        ...state.record,
        ...(state.assigned
          ? {}
          : {
              assignedStaff: {
                id: bookingId(602),
                firstName: "Other",
                lastName: "Technician",
              },
            }),
      });
    }
    if (
      path.startsWith(`/staff/bookings/${bookingId(1)}/`) &&
      route.request().method() !== "GET"
    ) {
      const body = route.request().postDataJSON();
      state.writes.push({ path, body });
      if (state.outcome === "conflict") return fail(409, "STALE_SERVICE_OPERATION");
      if (path.endsWith("/status") && !path.includes("/work-orders/"))
        state.record.status = body.status;
      if (path.endsWith("/assignment")) state.assigned = true;
      if (path.endsWith("/disruption")) {
        state.record.disruptionRequestedAt = "2026-10-12T09:00:00Z";
        state.record.disruptionResolution = "PENDING";
        state.record.disruptionReason = body.reason;
      }
      if (path.endsWith("/work-orders"))
        state.record.workOrder = {
          id: bookingId(800),
          workOrderNumber: "WO-2026-0008",
          status: "DRAFT",
          version: 1,
          diagnosis: body.diagnosis,
          internalNotes: body.internalNotes,
          items: [],
        };
      if (path.includes("/work-orders/") && state.record.workOrder) {
        if (body.status) state.record.workOrder.status = body.status;
        if ("diagnosis" in body) state.record.workOrder.diagnosis = body.diagnosis;
        state.record.workOrder.version++;
      }
      state.record.version++;
      if (state.outcome === "uncertain") return route.abort("failed");
      return ok(state.record);
    }
    return route.fallback();
  });
  return { state, list };
}
