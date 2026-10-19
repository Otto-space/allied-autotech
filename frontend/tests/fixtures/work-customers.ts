import type { Page } from "@playwright/test";
import { workVehicleStockFixture, bookingId } from "./work-vehicle-stock";
export { bookingId };
export const customerRecord = (n = 0) => ({
  id: bookingId(30000 + n),
  firstName: n === 0 ? "Amina" : n === 1 ? "Chidi" : "Synthetic",
  lastName: n === 0 ? "Okafor" : n === 1 ? "Obi" : `Customer ${n}`,
  email: `directory-${n}@example.test`,
  phone: `+234800000${String(n).padStart(3, "0")}`,
  status: n === 2 ? "SUSPENDED" : "ACTIVE",
  emailVerified: n % 2 === 0,
  phoneVerified: n % 3 === 0,
  createdAt: `2026-10-17T09:00:${String(n).padStart(2, "0")}.123Z`,
});
export async function workCustomersFixture(page: Page, role = "ADMIN") {
  const base = await workVehicleStockFixture(page, role),
    customers = {
      records: Array.from({ length: 28 }, (_, n) => customerRecord(n)),
      mode: "normal",
      reads: [] as URL[],
      writes: [] as string[],
      held: undefined as (() => void) | undefined,
    };
  await page.route("**/api/v1/admin/customers**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (req.method() !== "GET") {
      customers.writes.push(url.pathname);
      return route.fulfill({
        status: 405,
        json: { success: false, error: { code: "FORBIDDEN" } },
      });
    }
    customers.reads.push(url);
    if (url.pathname !== "/api/v1/admin/customers") {
      const parts = url.pathname.split("/"),
        record = customers.records.find((r) => r.id === parts[5]);
      return route.fulfill({
        json: {
          success: true,
          data:
            parts.length > 6
              ? { items: [] }
              : { ...record, address: null, city: null, state: null, country: "NG" },
          message: "Synthetic detail",
          meta: { requestId: "work-customers" },
        },
      });
    }
    if (customers.mode === "hold")
      await new Promise<void>((resolve) => {
        customers.held = resolve;
      });
    if (["error", "denied"].includes(customers.mode))
      return route.fulfill({
        status: customers.mode === "error" ? 503 : 403,
        json: {
          success: false,
          error: {
            code: customers.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN",
          },
        },
      });
    let rows = [...customers.records];
    const q = url.searchParams,
      search = q.get("search");
    if (search)
      rows = rows.filter((r) =>
        q.get("field") === "id"
          ? r.id === search
          : q.get("field") === "email"
            ? r.email.startsWith(search)
            : q.get("field") === "phone"
              ? r.phone.replace(/\D/g, "").startsWith(search.replace(/\D/g, ""))
              : `${r.firstName} ${r.lastName}`.toLowerCase().startsWith(search),
      );
    if (q.has("status")) rows = rows.filter((r) => r.status === q.get("status"));
    if (q.has("verified"))
      rows = rows.filter((r) => String(r.emailVerified) === q.get("verified"));
    if (q.get("sort") === "oldest") rows.reverse();
    const items =
      customers.mode === "empty"
        ? []
        : rows.slice(q.has("cursor") ? 25 : 0, q.has("cursor") ? 50 : 25);
    const data =
      customers.mode === "malformed"
        ? { items: [{ id: "bad" }] }
        : customers.mode === "duplicate"
          ? { items: [rows[0], rows[0]] }
          : customers.mode === "bad-cursor"
            ? { items, nextCursor: "bad!" }
            : {
                items,
                ...(!q.has("cursor") && rows.length > 25
                  ? { nextCursor: "syntheticOpaqueCursor25" }
                  : {}),
              };
    return route.fulfill({
      json: {
        success: true,
        data,
        message: "Synthetic directory",
        meta: { requestId: "work-customers" },
      },
    });
  });
  return { ...base, customers };
}
