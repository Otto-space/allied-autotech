import type { Page } from "@playwright/test";
import { workforceNotificationsFixture } from "./workforce-notifications";
export const bookingFixtureId = (n: number) =>
  `ba000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function workforceBookingsFixture(
  page: Page,
  template: "OPERATIONS" | "CUSTOMER_SERVICE" = "OPERATIONS",
) {
  const base = await workforceNotificationsFixture(page, template);
  const statuses = [
    "REQUESTED",
    "AWAITING_DEPOSIT",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
    "EXPIRED",
  ];
  const bookings = Array.from({ length: 27 }, (_, index) => ({
    id: bookingFixtureId(index + 1),
    branchId: base.access.assignments[0].branchId,
    branch: { id: base.access.assignments[0].branchId, name: "Stadium Road" },
    scheduledAt: new Date(Date.UTC(2026, 9, 20, 8 + index)).toISOString(),
    status: statuses[index % statuses.length],
    version: 0,
    service: { name: index % 2 ? "Preventive maintenance" : "Engine diagnostics" },
    customer: {
      firstName: index % 2 ? "Chidi" : "Ada",
      lastName: index % 2 ? "Eze" : "Okoro",
      phone: "+2348000000000",
    },
    vehicle:
      index === 3
        ? null
        : {
            make: index % 2 ? "Honda" : "Toyota",
            model: index % 2 ? "Accord" : "Corolla",
            year: 2020,
            registrationNumber: `PHC-${101 + index}-AA`,
          },
  }));
  const state = {
    base,
    bookings,
    reads: [] as string[],
    fail: false,
    denied: false,
    hold: false,
    release: undefined as (() => void) | undefined,
    responseAccess: base.access,
  };
  await page.route("**/api/v1/staff/workforce/bookings**", async (route) => {
    const url = new URL(route.request().url());
    state.reads.push(url.search);
    if (state.hold)
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
    if (state.fail || state.denied)
      return route.fulfill({
        status: state.denied ? 403 : 503,
        json: {
          success: false,
          error: { code: state.denied ? "FORBIDDEN" : "SERVICE_UNAVAILABLE" },
        },
      });
    const terms = (url.searchParams.get("q") ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
      status = url.searchParams.get("status"),
      cursor = url.searchParams.get("cursor");
    const filtered = state.bookings.filter(
      (row) =>
        (!cursor || row.id > cursor) &&
        (!status || row.status === status) &&
        terms.every((term) =>
          JSON.stringify([row.customer, row.vehicle, row.service.name])
            .toLowerCase()
            .includes(term),
        ),
    );
    const limit = Number(url.searchParams.get("limit") ?? 25),
      items = filtered.slice(0, limit);
    return route.fulfill({
      json: {
        success: true,
        message: "Synthetic permitted bookings",
        meta: { requestId: "workforce-bookings" },
        data: {
          items,
          ...(filtered.length > limit ? { nextCursor: items.at(-1)!.id } : {}),
          access: state.responseAccess,
          generatedAt: "2026-10-19T10:00:00.000Z",
        },
      },
    });
  });
  return state;
}
