import type { Page } from "@playwright/test";
import { bookingId, bookingRecord } from "./customer-bookings";
export { bookingId };
export function workBooking(n = 1, status = "REQUESTED") {
  const { depositPayment: _payment, ...record } = bookingRecord(n, status);
  void _payment;
  return {
    ...record,
    customerId: bookingId(400),
    bookingSlotId: bookingId(500 + n),
    assignedStaff: { id: bookingId(601), firstName: "Ada", lastName: "Okoro" },
    staffNotes: "Internal QA note, not list content",
  };
}
export async function workBookingsFixture(page: Page, role = "ADMIN") {
  const state = {
    role,
    mode: "normal",
    choicesMode: "normal",
    records: [
      workBooking(1),
      workBooking(2, "CONFIRMED"),
      workBooking(3, "IN_PROGRESS"),
      workBooking(4, "COMPLETED"),
      workBooking(5, "CANCELLED"),
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
        user: { id: bookingId(302), email: "workshop@example.test", role: state.role },
        mfaRequired: state.role !== "CUSTOMER",
        mfaVerifiedAt: state.role === "CUSTOMER" ? null : "2026-10-08T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      };
    if (endpoint === "/staff/profile")
      data = {
        id: bookingId(302),
        email: "workshop@example.test",
        role: state.role,
        status: "ACTIVE",
        capabilities: [],
        staffProfile: {
          id: bookingId(601),
          firstName: "Ada",
          lastName: "Okoro",
          branchId: bookingId(101),
        },
      };
    if (endpoint === "/admin/branches")
      data = {
        items: [
          { id: bookingId(101), name: "Stadium Road workshop", isActive: true },
          { id: bookingId(102), name: "Previous workshop", isActive: false },
        ],
      };
    if (endpoint === "/admin/staff")
      data = {
        items: [
          {
            id: bookingId(302),
            email: "workshop@example.test",
            role: "STAFF",
            status: "ACTIVE",
            staffProfile: {
              id: bookingId(601),
              firstName: "Ada",
              lastName: "Okoro",
              branchId: bookingId(101),
            },
          },
        ],
      };
    if (
      ["/admin/branches", "/admin/staff"].includes(endpoint) &&
      state.choicesMode === "error"
    )
      return route.fulfill({
        status: 503,
        json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
      });
    if (endpoint === "/staff/bookings") {
      state.reads.push(url);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (["error", "denied"].includes(state.mode))
        return route.fulfill({
          status: state.mode === "denied" ? 403 : 503,
          json: {
            success: false,
            error: {
              code: state.mode === "denied" ? "FORBIDDEN" : "DATABASE_UNAVAILABLE",
            },
          },
        });
      const status = url.searchParams.get("status");
      const records = url.searchParams.has("cursor")
        ? [workBooking(26, "COMPLETED")]
        : state.records;
      data =
        state.mode === "malformed"
          ? { items: [{}] }
          : {
              items:
                state.mode === "empty"
                  ? []
                  : records.filter(
                      (r) =>
                        (!status || r.status === status) &&
                        (!url.searchParams.get("branchId") ||
                          r.branch?.id === url.searchParams.get("branchId")) &&
                        (!url.searchParams.get("assignedStaffId") ||
                          r.assignedStaff?.id ===
                            url.searchParams.get("assignedStaffId")) &&
                        (!url.searchParams.get("scheduledFrom") ||
                          new Date(r.scheduledAt!).getTime() >=
                            new Date(url.searchParams.get("scheduledFrom")!).getTime()) &&
                        (!url.searchParams.get("scheduledTo") ||
                          new Date(r.scheduledAt!).getTime() <
                            new Date(url.searchParams.get("scheduledTo")!).getTime()),
                    ),
              ...(!url.searchParams.has("cursor") && !status && state.mode !== "empty"
                ? { nextCursor: bookingId(5) }
                : {}),
            };
    }
    if (endpoint.startsWith("/staff/bookings/"))
      data =
        state.records.find((r) => r.id === endpoint.split("/").at(-1)) ??
        workBooking(26, "COMPLETED");
    return route.fulfill({
      json: {
        success: true,
        message: "Isolated booking fixture",
        meta: { requestId: "work-bookings-qa" },
        data,
      },
    });
  });
  return state;
}
