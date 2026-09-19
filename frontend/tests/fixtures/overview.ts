// Synthetic records used only in isolated browser tests.
import type { Overview } from "@/lib/api/overview-schemas";
import { overviewDates } from "@/lib/api/overview-schemas";
const id = (n: number) => `b9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function overviewFixture(
  role: string,
  dates = overviewDates(30),
  empty = false,
): Overview {
  const days = (Date.parse(dates.to) - Date.parse(dates.from)) / 86_400_000 + 1;
  const activity = Array.from({ length: days }, (_, index) => ({
    date: new Date(Date.parse(dates.from) + index * 86_400_000)
      .toISOString()
      .slice(0, 10),
    bookings: empty ? 0 : [5, 8, 7, 12, 9, 6, 11][index % 7],
    orders: empty ? 0 : [3, 5, 4, 6, 7, 2, 4][index % 7],
  }));
  const bookings = activity.reduce((sum, row) => sum + row.bookings, 0);
  const administrator = role === "ADMIN" || role === "SUPER_ADMIN";
  return {
    scope:
      role === "CUSTOMER" ? "CUSTOMER" : role === "STAFF" ? "BRANCH" : "ORGANISATION",
    branch: role === "STAFF" ? { id: id(1), name: "Stadium Road workshop" } : null,
    range: { ...dates, timeZone: "Africa/Lagos" },
    generatedAt: new Date().toISOString(),
    counts: {
      bookings,
      orders: activity.reduce((sum, row) => sum + row.orders, 0),
      quotations: empty ? 0 : 42,
      vehicles: empty ? 0 : 6,
      inspections: empty ? 0 : 18,
    },
    activity,
    bookingStatuses: empty
      ? []
      : [
          { status: "REQUESTED", count: Math.floor(bookings * 0.1) },
          { status: "CONFIRMED", count: Math.floor(bookings * 0.2) },
          { status: "IN_PROGRESS", count: Math.floor(bookings * 0.15) },
          {
            status: "COMPLETED",
            count:
              bookings -
              Math.floor(bookings * 0.1) -
              Math.floor(bookings * 0.2) -
              Math.floor(bookings * 0.15),
          },
        ],
    recentBookings: empty
      ? []
      : [
          "Vehicle diagnostics",
          "Brake inspection",
          "Routine service",
          "Air conditioning",
          "Wheel alignment",
        ].map((serviceName, index) => ({
          id: id(20 + index),
          serviceName,
          status: ["CONFIRMED", "IN_PROGRESS", "REQUESTED", "COMPLETED", "CONFIRMED"][
            index
          ],
          createdAt: `${dates.to}T08:00:00Z`,
          scheduledAt: `${dates.to}T${10 + index}:00:00Z`,
        })),
    recentOrders: empty
      ? []
      : [1, 2, 3, 4].map((index) => ({
          id: id(40 + index),
          orderNumber: `ORD-TEST-010${index}`,
          status: ["CONFIRMED", "PROCESSING", "COMPLETED", "PENDING"][index - 1],
          createdAt: `${dates.to}T08:00:00Z`,
          totalKobo: String(index * 2450000),
          currency: "NGN",
        })),
    ...(administrator
      ? {
          finance: {
            payments: empty
              ? []
              : [{ currency: "NGN", amountKobo: "248950000", count: 62 }],
            refunds: empty ? [] : [{ currency: "NGN", amountKobo: "1250000", count: 3 }],
          },
        }
      : {}),
  };
}
