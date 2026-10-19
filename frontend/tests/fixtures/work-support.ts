import type { Page } from "@playwright/test";
import { workVehicleStockFixture, bookingId } from "./work-vehicle-stock";
import type { SupportKind } from "@/lib/api/support-schemas";
export { bookingId };
export function supportRecord(kind: SupportKind = "enquiries", n = 0) {
  return {
    id: bookingId((kind === "enquiries" ? 50000 : 60000) + n),
    branchId: bookingId(101),
    assignedStaffId: n === 1 ? null : bookingId(601),
    subject:
      n === 0
        ? kind === "enquiries"
          ? "Service estimate request"
          : "Engine repair follow-up"
        : `${kind} record ${n + 1}`,
    version: n,
    createdAt: `2026-10-17T09:00:${String(n).padStart(2, "0")}.123Z`,
    updatedAt: "2026-10-17T10:00:37.123Z",
    resolvedAt: null,
    closedAt: null,
    branch: { id: bookingId(101), code: "PH01", name: "Stadium Road workshop" },
    assignedStaff:
      n === 1 ? null : { id: bookingId(601), firstName: "Ada", lastName: "Okoro" },
    name: "Amina Okafor" as string | null,
    email: "support@example.test" as string | null,
    phone: "+2348000000000",
    customerId: bookingId(70000 + n),
    status: "OPEN",
    type: "SERVICE",
    message: "Please provide an estimate for the upcoming scheduled vehicle service.",
    productId: null,
    serviceId: bookingId(80000),
    bookingId: null,
    quoteId: null,
    vehicleListingId: null,
    description:
      "Please provide an update on the completed repair and the reported recurring noise.",
    resolution: null,
    priority: n === 0 ? "HIGH" : "MEDIUM",
    orderId: null,
    vehicleTransactionId: null,
    acknowledgedAt: n === 0 ? "2026-10-17T09:30:37.123Z" : null,
    acknowledgementDueAt: "2026-10-18T09:00:37.123Z",
    escalatedAt: n === 1 ? "2026-10-17T10:00:37.123Z" : null,
  };
}
export async function workSupportFixture(page: Page, role = "ADMIN") {
  const base = await workVehicleStockFixture(page, role),
    support = {
      records: {
        enquiries: Array.from({ length: 28 }, (_, n) => supportRecord("enquiries", n)),
        complaints: Array.from({ length: 28 }, (_, n) => supportRecord("complaints", n)),
      },
      mode: "normal",
      pickerMode: "normal",
      reads: [] as URL[],
      pickerReads: [] as URL[],
      writes: [] as string[],
      held: undefined as (() => void) | undefined,
    };
  for (const endpoint of ["staff", "branches"])
    await page.route(`**/api/v1/admin/${endpoint}**`, async (route) => {
      support.pickerReads.push(new URL(route.request().url()));
      if (support.pickerMode === "error")
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
        });
      return route.fallback();
    });
  await page.route("**/api/v1/staff/support/**", async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      parts = u.pathname.split("/"),
      kind = parts[5] as SupportKind;
    if (req.method() !== "GET") {
      support.writes.push(u.pathname);
      return route.fulfill({
        status: 405,
        json: { success: false, error: { code: "FORBIDDEN" } },
      });
    }
    if (parts.length > 6) {
      const row = support.records[kind].find((r) => r.id === parts[6]);
      return route.fulfill({
        json: {
          success: true,
          data:
            parts.length > 7
              ? { items: [], cursor: null, hasMore: false, pollAfterMs: 30000 }
              : row,
          message: "Synthetic thread",
          meta: { requestId: "work-support" },
        },
      });
    }
    support.reads.push(u);
    if (support.mode === "hold")
      await new Promise<void>((resolve) => {
        support.held = resolve;
      });
    if (["error", "denied"].includes(support.mode))
      return route.fulfill({
        status: support.mode === "error" ? 503 : 403,
        json: {
          success: false,
          error: {
            code: support.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN",
          },
        },
      });
    let rows = [...support.records[kind]];
    const q = u.searchParams;
    if (support.mode !== "mismatch") {
      if (role === "STAFF")
        rows = rows.filter((r) => r.branchId === base.state.profileBranch);
      for (const key of [
        "status",
        "type",
        "priority",
        "branchId",
        "assignedStaffId",
      ] as const)
        if (q.has(key)) rows = rows.filter((r) => r[key] === q.get(key));
    }
    const items =
        support.mode === "empty"
          ? []
          : rows.slice(q.has("cursor") ? 25 : 0, q.has("cursor") ? 50 : 25),
      data =
        support.mode === "malformed"
          ? { items: [{ id: "bad" }] }
          : support.mode === "duplicate"
            ? { items: [rows[0], rows[0]] }
            : support.mode === "bad-cursor"
              ? { items, nextCursor: "opaque" }
              : {
                  items,
                  ...(!q.has("cursor") && rows.length > 25 && items.length > 0
                    ? { nextCursor: items.at(-1)!.id }
                    : {}),
                };
    return route.fulfill({
      json: {
        success: true,
        data,
        message: "Synthetic support queue",
        meta: { requestId: "work-support" },
      },
    });
  });
  return { ...base, support };
}
