import type { Page } from "@playwright/test";
import type { StaffOrderRecord } from "@/lib/admin/work-order-detail";
import { workOrdersFixture, workOrder, bookingId } from "./work-orders";
export { bookingId };
export function staffOrderRecord(): StaffOrderRecord {
  return {
    ...workOrder(),
    customerName: "Ada Okoro",
    customerEmail: "ada@example.test",
    customerPhone: "+2348000000000",
    cancellationReason: null,
    confirmedAt: "2026-10-17T08:06:00.000Z",
    processingAt: "2026-10-17T08:10:00.000Z",
    updatedAt: "2026-10-17T08:10:00.000Z",
    readyAt: null,
    completedAt: null,
    cancelledAt: null,
    subtotalKobo: "2450000",
    taxKobo: "183750",
    totalKobo: "2633750",
    allowedTransitions: ["READY"],
    invoice: { id: bookingId(1300), invoiceNumber: "INV-20261017-001", status: "ISSUED" },
    items: [
      {
        id: bookingId(1200),
        productId: bookingId(1201),
        productName: "Brake pads",
        sku: "BP-102",
        unitPriceKobo: "1800000",
        subtotalKobo: "1800000",
        quantity: 1,
      },
      {
        id: bookingId(1202),
        productId: bookingId(1203),
        productName: "Engine oil",
        sku: "EO-205",
        unitPriceKobo: "650000",
        subtotalKobo: "650000",
        quantity: 1,
      },
    ],
  };
}
export async function workOrderDetailFixture(page: Page, role = "ADMIN") {
  const base = await workOrdersFixture(page, role);
  const state = {
    record: staffOrderRecord(),
    mode: "normal",
    outcome: "success",
    reads: [] as string[],
    writes: [] as { body: Record<string, unknown>; csrf?: string }[],
    held: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1", "");
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic order detail",
          meta: { requestId: "order-detail-qa" },
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({ status, json: { success: false, error: { code } } });
    if (path === "/auth/csrf")
      return ok({ csrfToken: "order-detail-qa-token-".repeat(3) });
    if (!/^\/staff\/orders\/[^/]+(?:\/status)?$/.test(path)) return route.fallback();
    if (req.method() === "GET") {
      state.reads.push(path);
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (["error", "denied", "missing"].includes(state.mode))
        return fail(
          state.mode === "error" ? 503 : state.mode === "missing" ? 404 : 403,
          state.mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN",
        );
      if (state.mode === "malformed") return ok({ id: "broken" });
      const record = { ...state.record };
      if (role === "STAFF") delete record.invoice;
      return ok(state.mode === "mismatch" ? { ...record, id: bookingId(9999) } : record);
    }
    const body = req.postDataJSON() as Record<string, unknown>;
    state.writes.push({ body, csrf: req.headers()["x-csrf-token"] });
    if (state.outcome === "reject" || body.expectedVersion !== state.record.version)
      return fail(409, "CONFLICT");
    const status = body.status as StaffOrderRecord["status"];
    if (state.outcome !== "uncommitted") {
      state.record = {
        ...state.record,
        status,
        version: state.record.version + 1,
        updatedAt: "2026-10-17T08:20:00.000Z",
        ...(status === "CANCELLED"
          ? {
              cancellationReason: String(body.reason),
              cancelledAt: "2026-10-17T08:20:00.000Z",
            }
          : {}),
        allowedTransitions:
          status === "READY" ? ["COMPLETED"] : status === "PROCESSING" ? ["READY"] : [],
      };
    }
    if (["uncertain", "uncommitted"].includes(state.outcome))
      return route.abort("failed");
    return ok(
      state.outcome === "contradictory"
        ? { ...state.record, id: bookingId(9998) }
        : state.record,
    );
  });
  return { ...base, detail: state };
}
