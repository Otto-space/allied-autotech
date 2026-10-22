import type { Page } from "@playwright/test";
import { workBookingsFixture, bookingId as id } from "./work-bookings";
import type { InvoiceSource, WorkInvoice } from "@/lib/admin/work-invoices";
export { id };
const branch = { id: id(101), code: "PH01", name: "Stadium Road workshop" };
export function invoiceRow(n = 0): WorkInvoice {
  return {
    id: id(190000 + n),
    invoiceNumber: `INV-2026-${String(1428 - n).padStart(6, "0")}`,
    currency: "NGN",
    status: (["DRAFT", "ISSUED", "PAID"] as const)[n % 3],
    version: n % 3,
    subtotalKobo: n % 3 === 2 ? "1200000000" : "10000000",
    taxKobo: n % 3 === 2 ? "0" : "750000",
    depositCreditKobo: "0",
    totalKobo: n % 3 === 2 ? "1200000000" : "10750000",
    createdAt: new Date(Date.parse("2026-10-18T08:00:37.123Z") - n * 1000).toISOString(),
    updatedAt: "2026-10-18T09:00:37.123Z",
    issuedAt: n % 3 ? "2026-10-18T09:00:00.123Z" : null,
    dueAt: "2026-10-20T11:00:00.123Z",
    paidAt: n % 3 === 2 ? "2026-10-18T10:00:00.123Z" : null,
    voidedAt: null,
    order:
      n % 3 === 0
        ? {
            id: id(191000 + n),
            orderNumber: `ORD-2026-${1284 + n}`,
            status: "PENDING",
            branch,
          }
        : null,
    booking: n % 3 === 1 ? { id: id(192000 + n), status: "CONFIRMED", branch } : null,
    vehicleTransaction:
      n % 3 === 2
        ? {
            id: id(193000 + n),
            transactionNumber: `SALE-2026-${14 + n}`,
            status: "COMPLETED",
            vehicleListing: { branch },
          }
        : null,
    payments: [],
  };
}
export function sourceRow(
  n = 0,
  kind: InvoiceSource["sourceType"] = "ORDER",
): InvoiceSource {
  const reference =
    kind === "ORDER"
      ? `ORD-2026-${1300 + n}`
      : kind === "BOOKING"
        ? id(195000 + n)
        : `SALE-2026-${50 + n}`;
  return {
    id: id(195000 + n),
    sourceType: kind,
    reference,
    label: `${reference} · Stadium Road workshop`,
    branch,
    createdAt: new Date(Date.parse("2026-10-18T08:00:37.123Z") - n * 1000).toISOString(),
    updatedAt: "2026-10-18T09:00:37.123Z",
  };
}
export async function workInvoiceFixture(page: Page, role = "ADMIN") {
  await workBookingsFixture(page, role);
  const state = {
    mode: "normal",
    sourceMode: "normal",
    profileMode: "normal",
    writeMode: "normal",
    reads: [] as URL[],
    sourceReads: [] as URL[],
    profileReads: 0,
    writes: [] as { body: Record<string, string> }[],
    records: [invoiceRow(), invoiceRow(1), invoiceRow(2)],
    sources: [sourceRow(), sourceRow(1, "BOOKING"), sourceRow(2, "VEHICLE_TRANSACTION")],
    held: undefined as (() => void) | undefined,
  };
  const ok = (data: unknown, status = 200) => ({
    status,
    json: {
      success: true,
      data,
      message: "Synthetic invoice QA",
      meta: { requestId: "invoice-test" },
    },
  });
  const fail = (status: number) => ({
    status,
    json: {
      success: false,
      error: {
        code:
          status === 403
            ? "FORBIDDEN"
            : status === 409
              ? "INVOICE_CONFLICT"
              : "DATABASE_UNAVAILABLE",
      },
    },
  });
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill(ok({ csrfToken: "invoice-csrf-".repeat(4) })),
  );
  await page.route("**/api/v1/staff/profile", (r) => {
    state.profileReads++;
    if (["error", "denied"].includes(state.profileMode))
      return r.fulfill(fail(state.profileMode === "denied" ? 403 : 503));
    return r.fulfill(
      ok({
        id: id(state.profileMode === "mismatch" ? 999 : 302),
        email: "workshop@example.test",
        role,
        status: state.profileMode === "inactive" ? "SUSPENDED" : "ACTIVE",
        capabilities: [],
        staffProfile: {
          id: id(601),
          firstName: "Ada",
          lastName: "Okoro",
          branchId: id(101),
        },
      }),
    );
  });
  await page.route("**/api/v1/staff/invoices**", async (r) => {
    const u = new URL(r.request().url()),
      q = u.searchParams,
      sourcePath = u.pathname.endsWith("/sources");
    if (r.request().method() === "GET") {
      (sourcePath ? state.sourceReads : state.reads).push(u);
      const mode = sourcePath ? state.sourceMode : state.mode;
      if (mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (["error", "denied"].includes(mode))
        return r.fulfill(fail(mode === "denied" ? 403 : 503));
      let rows: (InvoiceSource | WorkInvoice)[];
      if (sourcePath)
        rows = state.sources.filter(
          (s) =>
            s.sourceType === q.get("sourceType") &&
            (!q.has("sourceId") || s.id === q.get("sourceId")) &&
            (!q.has("search") ||
              s.label.toLowerCase().startsWith(q.get("search")!.toLowerCase()) ||
              s.id === q.get("search")) &&
            !state.records.some(
              (v) => (v.order ?? v.booking ?? v.vehicleTransaction)?.id === s.id,
            ),
        );
      else
        rows = state.records.filter(
          (v) =>
            (!q.has("status") || v.status === q.get("status")) &&
            (!q.has("invoiceNumber") || v.invoiceNumber === q.get("invoiceNumber")) &&
            (!q.has("branchId") || q.get("branchId") === branch.id) &&
            (!q.has("sourceType") ||
              (q.get("sourceType") === "ORDER"
                ? !!v.order
                : q.get("sourceType") === "BOOKING"
                  ? !!v.booking
                  : !!v.vehicleTransaction)) &&
            (!q.has("sourceId") ||
              (v.order ?? v.booking ?? v.vehicleTransaction)?.id === q.get("sourceId")),
        );
      if (mode === "empty") rows = [];
      const start = q.has("cursor")
          ? rows.findIndex((v) => v.id === q.get("cursor")) + 1
          : 0,
        items = rows.slice(start, start + 25);
      return r.fulfill(
        ok(
          mode === "malformed"
            ? { items: [{}] }
            : {
                items,
                ...(rows.length > start + 25 ? { nextCursor: items.at(-1)!.id } : {}),
              },
        ),
      );
    }
    const body = r.request().postDataJSON() as Record<string, string>;
    state.writes.push({ body });
    if (state.writeMode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["rejected", "denied", "rate"].includes(state.writeMode))
      return r.fulfill(
        fail(
          state.writeMode === "rejected" ? 409 : state.writeMode === "denied" ? 403 : 429,
        ),
      );
    const source = state.sources.find((v) => v.id === body.sourceId)!;
    const saved: WorkInvoice = {
      ...invoiceRow(),
      id: id(199000 + state.writes.length),
      invoiceNumber: `INV-SAVED-${state.writes.length}`,
      dueAt: body.dueAt ? new Date(body.dueAt).toISOString() : null,
      order: null,
      booking: null,
      vehicleTransaction: null,
    };
    if (source.sourceType === "ORDER")
      saved.order = {
        id: source.id,
        orderNumber: source.reference,
        status: "PENDING",
        branch,
      };
    if (source.sourceType === "BOOKING")
      saved.booking = { id: source.id, status: "CONFIRMED", branch };
    if (source.sourceType === "VEHICLE_TRANSACTION")
      saved.vehicleTransaction = {
        id: source.id,
        transactionNumber: source.reference,
        status: "PAYMENT_PENDING",
        vehicleListing: { branch },
      };
    state.records.unshift(saved);
    if (state.writeMode === "lost") return r.abort("failed");
    return r.fulfill(
      ok(
        state.writeMode === "wrong-source"
          ? {
              ...saved,
              order: { id: id(999), orderNumber: "OTHER", status: "PENDING", branch },
              booking: null,
              vehicleTransaction: null,
            }
          : saved,
        201,
      ),
    );
  });
  return state;
}
