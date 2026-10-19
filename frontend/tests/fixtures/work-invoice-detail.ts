import type { Page } from "@playwright/test";
import { workInvoiceFixture, invoiceRow, id } from "./work-invoices";
import { invoiceSource, type WorkInvoice } from "@/lib/admin/work-invoices";
import type { StaffInvoiceDocument } from "@/lib/admin/work-invoice-detail";
export { id };
export function invoicePaper(v: WorkInvoice): StaffInvoiceDocument {
  const source = invoiceSource(v);
  return {
    schemaVersion: 1,
    id: v.id,
    invoiceNumber: v.invoiceNumber,
    currency: "NGN",
    status: v.status,
    version: v.version,
    issuedAt: v.issuedAt,
    dueAt: v.dueAt,
    paidAt: v.paidAt,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    voidedAt: v.voidedAt,
    issuer: {
      name: "Allied AutoTech",
      address:
        "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
      paymentTerms: "",
    },
    billTo: {
      name: "Synthetic Invoice Customer",
      address: "Nigeria",
      reference: id(400),
    },
    source: {
      type: source.kind,
      id: source.id,
      reference: source.kind === "BOOKING" ? "QUOTE-2026-00126" : source.reference,
      description:
        source.kind === "ORDER"
          ? "Parts order"
          : source.kind === "BOOKING"
            ? "Service booking"
            : "Vehicle purchase",
    },
    lines: [
      {
        description: "Recorded replacement part",
        quantity: 1,
        unitPriceKobo: v.subtotalKobo,
        subtotalKobo: v.subtotalKobo,
      },
    ],
    discountKobo: "0",
    deliveryKobo: "0",
    detailBasis: "SNAPSHOT",
    subtotalKobo: v.subtotalKobo,
    taxKobo: v.taxKobo,
    depositCreditKobo: v.depositCreditKobo,
    totalKobo: v.totalKobo,
    paymentRequests: v.payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      status: p.status as StaffInvoiceDocument["paymentRequests"][number]["status"],
      amountKobo: p.amountKobo,
      succeededAt: p.succeededAt,
    })),
    receipts: v.payments
      .filter((p) => p.status === "SUCCEEDED" && p.succeededAt)
      .map((p) => ({
        paymentId: p.id,
        paymentNumber: p.paymentNumber,
        amountKobo: p.amountKobo,
        confirmedAt: p.succeededAt!,
        refundedKobo: "0",
      })),
  };
}
export async function workInvoiceDetailFixture(page: Page, role = "ADMIN") {
  const base = await workInvoiceFixture(page, role);
  const state = {
    base,
    invoice: invoiceRow(),
    mode: "normal",
    paperMode: "normal",
    pdfMode: "normal",
    writeMode: "normal",
    reads: [] as URL[],
    paperReads: [] as URL[],
    pdfReads: [] as URL[],
    writes: [] as { action: string; body: Record<string, number> }[],
    paperPatch: {} as Partial<StaffInvoiceDocument>,
    held: undefined as (() => void) | undefined,
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic detail fixture",
      meta: { requestId: "invoice-detail-test" },
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
            : status === 404
              ? "NOT_FOUND"
              : status === 409
                ? "INVOICE_STALE"
                : "DATABASE_UNAVAILABLE",
      },
    },
  });
  await page.route("**/api/v1/staff/invoices/**", async (r) => {
    const u = new URL(r.request().url()),
      route = u.pathname.split("/").at(-1)!;
    if (r.request().method() === "GET") {
      const paper = route === "document",
        pdf = route === "download",
        mode = paper ? state.paperMode : pdf ? state.pdfMode : state.mode;
      (paper ? state.paperReads : pdf ? state.pdfReads : state.reads).push(u);
      if (mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (["error", "denied", "missing"].includes(mode))
        return r.fulfill(fail(mode === "denied" ? 403 : mode === "missing" ? 404 : 503));
      if (paper) {
        const doc = { ...invoicePaper(state.invoice), ...state.paperPatch };
        return r.fulfill(
          ok(
            mode === "mismatch"
              ? { ...doc, version: doc.version + 1 }
              : mode === "malformed"
                ? { ...doc, totalKobo: "1" }
                : doc,
          ),
        );
      }
      if (pdf) {
        if (
          u.searchParams.get("expectedVersion") !== String(state.invoice.version) ||
          u.searchParams.get("expectedStatus") !== state.invoice.status
        )
          return r.fulfill(fail(409));
        return r.fulfill({
          headers: {
            "Content-Type": mode === "wrong-type" ? "text/html" : "application/pdf",
            "Cache-Control": "private, no-store",
            "X-Document-Id": mode === "wrong-id" ? id(999) : state.invoice.id,
            "X-Document-Type": "invoice",
            "X-Document-Version":
              mode === "wrong-version" ? "99" : String(state.invoice.version),
            "X-Document-Status": mode === "wrong-status" ? "OTHER" : state.invoice.status,
            "Content-Disposition": 'attachment; filename="invoice-synthetic.pdf"',
          },
          body: Buffer.from(
            mode === "bad-magic"
              ? "Synthetic invalid file"
              : "%PDF-1.4\n% Synthetic browser transport fixture; real renderer is tested separately.\n%%EOF",
          ),
        });
      }
      return r.fulfill(
        ok(
          mode === "mismatch"
            ? { ...state.invoice, id: id(999) }
            : mode === "malformed"
              ? { id: state.invoice.id }
              : state.invoice,
        ),
      );
    }
    const body = r.request().postDataJSON() as Record<string, number>;
    state.writes.push({ action: route, body });
    if (state.writeMode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["rejected", "denied", "rate"].includes(state.writeMode))
      return r.fulfill(
        fail(state.writeMode === "denied" ? 403 : state.writeMode === "rate" ? 429 : 409),
      );
    const at = new Date().toISOString();
    state.invoice = {
      ...state.invoice,
      status: route === "issue" ? "ISSUED" : "VOID",
      version: state.invoice.version + 1,
      updatedAt: at,
      ...(route === "issue" ? { issuedAt: at } : { voidedAt: at }),
    };
    if (state.writeMode === "lost") return r.abort("failed");
    return r.fulfill(
      ok(
        state.writeMode === "wrong-version"
          ? { ...state.invoice, version: 99 }
          : state.writeMode === "wrong-total"
            ? { ...state.invoice, totalKobo: "1" }
            : state.invoice,
      ),
    );
  });
  return state;
}
