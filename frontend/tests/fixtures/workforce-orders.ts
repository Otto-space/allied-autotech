import type { Page } from "@playwright/test";
import { workforceNotificationsFixture } from "./workforce-notifications";
export const orderFixtureId = (n: number) =>
  `bd000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function workforceOrdersFixture(
  page: Page,
  template: "OPERATIONS" | "CUSTOMER_SERVICE" | "SALES_SUPERVISOR" = "OPERATIONS",
) {
  const base = await workforceNotificationsFixture(page, template),
    branchId = base.access.assignments[0].branchId;
  const generatedAt = "2026-10-20T09:00:00.000Z";
  const items = [1, 2].map((n) => ({
    id: orderFixtureId(n),
    orderNumber: `AA-2026-0${147 + n}`,
    branchId,
    branch: { id: branchId, name: "Stadium Road" },
    status: n === 1 ? "CONFIRMED" : "PROCESSING",
    fulfillmentMethod: "COLLECTION",
    paidAt: "2026-10-20T08:15:00.000Z" as string | null,
    version: n - 1,
    createdAt: "2026-10-20T08:00:00.000Z",
    updatedAt: "2026-10-20T08:15:00.000Z",
    confirmedAt: "2026-10-20T08:15:00.000Z",
    processingAt: n === 1 ? null : "2026-10-20T08:30:00.000Z",
    readyAt: null as string | null,
    completedAt: null as string | null,
    cancelledAt: null as string | null,
    items:
      n === 1
        ? [
            { productName: "Front brake pads", quantity: 1 },
            { productName: "Engine oil 5W-30", quantity: 2 },
          ]
        : [{ productName: "Oil filter", quantity: 1 }],
  }));
  const state = {
    base,
    items,
    reads: [] as string[],
    writes: [] as { path: string; body: Record<string, unknown> }[],
    listFailure: false,
    detailFailure: false,
    detailDenied: false,
    listMismatch: false,
    lostResponse: false,
    malformedReceipt: false,
    timeoutResponse: false,
    throttledResponse: false,
    hold: false,
    release: undefined as (() => void) | undefined,
  };
  const available = (row: (typeof items)[number]) =>
    base.access.permissions.includes("ORDERS_PREPARE") &&
    base.access.assignments.some(
      (a) =>
        a.template === "OPERATIONS" &&
        a.branchId === row.branchId &&
        a.revokedAt === null,
    ) &&
    row.paidAt &&
    row.fulfillmentMethod === "COLLECTION"
      ? row.status === "CONFIRMED"
        ? ["PROCESSING"]
        : row.status === "PROCESSING"
          ? ["READY"]
          : []
      : [];
  const project = (row: (typeof items)[number]) => ({
    ...row,
    availableNextStates: available(row),
    access: base.access,
    generatedAt,
  });
  await page.route("**/api/v1/staff/workforce/orders**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic workforce orders fixture",
          meta: { requestId: "workforce-orders" },
        },
      });
    const fail = (status: number) =>
      route.fulfill({
        status,
        json: {
          success: false,
          error: {
            code: status === 409 ? "CONFLICT" : "UNAVAILABLE",
            message: "Synthetic order response unavailable",
          },
        },
      });
    const id = /orders\/([^/]+)/.exec(url.pathname)?.[1],
      row = items.find((r) => r.id === id);
    if (request.method() !== "GET") {
      const body = request.postDataJSON();
      state.writes.push({ path: url.pathname, body });
      if (!row) return fail(404);
      if (body.expectedVersion !== row.version || !available(row).includes(body.status))
        return fail(409);
      const previousVersion = row.version,
        previousStatus = row.status;
      row.version++;
      row.status = body.status;
      row.updatedAt = generatedAt;
      if (row.status === "PROCESSING") row.processingAt = generatedAt;
      else row.readyAt = generatedAt;
      if (state.timeoutResponse) return fail(408);
      if (state.throttledResponse) return fail(429);
      if (state.lostResponse) return route.abort("failed");
      return ok({
        ...project(row),
        id: state.malformedReceipt ? orderFixtureId(999) : row.id,
        action: "prepare",
        actorUserId: base.access.userId,
        previousVersion,
        previousStatus,
        reason: body.reason,
      });
    }
    state.reads.push(url.pathname + url.search);
    if (!id) {
      if (state.hold)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.listFailure) return fail(503);
      const terms = (url.searchParams.get("q") ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      const filtered = items.filter(
        (r) =>
          terms.every((term) =>
            (r.orderNumber + " " + r.items.map((i) => i.productName).join(" "))
              .toLowerCase()
              .includes(term),
          ) &&
          (!url.searchParams.has("status") ||
            r.status === url.searchParams.get("status")) &&
          (!url.searchParams.has("fulfillmentMethod") ||
            r.fulfillmentMethod === url.searchParams.get("fulfillmentMethod")),
      );
      const cursor = url.searchParams.get("cursor"),
        offset = cursor ? filtered.findIndex((r) => r.id === cursor) + 1 : 0,
        pageItems = filtered.slice(offset, offset + 25).map(project);
      return ok({
        items: pageItems,
        ...(filtered.length > offset + 25 ? { nextCursor: pageItems.at(-1)!.id } : {}),
        access: state.listMismatch ? { ...base.access, version: 999 } : base.access,
        generatedAt,
      });
    }
    if (!row) return fail(404);
    if (state.detailDenied) return fail(403);
    if (state.detailFailure) return fail(503);
    return ok(project(row));
  });
  return state;
}
