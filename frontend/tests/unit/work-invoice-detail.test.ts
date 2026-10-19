// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { invoiceSource } from "@/lib/admin/work-invoices";
import {
  parseInvoiceDetail,
  parseStaffInvoiceDocument,
  invoiceDocumentMatches,
  validateInvoiceTransition,
  invoiceCanTransition,
} from "@/lib/admin/work-invoice-detail";
import {
  markInvoiceTransitionPending,
  readInvoiceTransitionPending,
  clearInvoiceTransitionPending,
} from "@/lib/admin/work-invoice-transition-pending";
import { redactInvoiceChanges } from "@/lib/admin/work-invoice-pending";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { invoiceRow, id } from "../fixtures/work-invoices";
function paper() {
  const v = invoiceRow(),
    source = invoiceSource(v);
  return {
    ...v,
    schemaVersion: 1,
    issuer: { name: "Allied AutoTech", address: "Synthetic workshop", paymentTerms: "" },
    billTo: { name: "Synthetic Customer", address: null, reference: id(400) },
    source: {
      type: source.kind,
      id: source.id,
      reference: source.reference,
      description: "Parts order",
    },
    lines: [
      {
        description: "Recorded part",
        quantity: 1,
        unitPriceKobo: v.subtotalKobo,
        subtotalKobo: v.subtotalKobo,
      },
    ],
    discountKobo: "0",
    deliveryKobo: "0",
    detailBasis: "SNAPSHOT",
    paymentRequests: [],
    receipts: [],
  };
}
function document() {
  const {
    order: _order,
    booking: _booking,
    vehicleTransaction: _sale,
    payments: _payments,
    ...value
  } = paper();
  void _order;
  void _booking;
  void _sale;
  void _payments;
  return value;
}
describe("administrator invoice detail boundaries", () => {
  it("binds the direct invoice to the route UUID", () => {
    const v = invoiceRow();
    expect(parseInvoiceDetail(v, v.id)).toEqual(v);
    expect(() => parseInvoiceDetail(v, id(999))).toThrow();
  });
  it("validates draft paper using existing document arithmetic and current metadata", () => {
    const v = invoiceRow(),
      doc = parseStaffInvoiceDocument(document(), v.id);
    expect(doc.status).toBe("DRAFT");
    expect(invoiceDocumentMatches(v, doc)).toBe(true);
    for (const change of [
      { totalKobo: "1" },
      { subtotalKobo: "1" },
      { lines: [{ ...doc.lines[0], quantity: 2 }] },
    ])
      expect(() => parseStaffInvoiceDocument({ ...doc, ...change }, v.id)).toThrow();
  });
  it("refuses stale version/status/source/lifecycle exports", () => {
    const v = invoiceRow(),
      doc = parseStaffInvoiceDocument(document(), v.id);
    for (const change of [
      { version: 1 },
      { status: "ISSUED" as const },
      { updatedAt: "2026-10-18T10:00:00.000Z" },
      { source: { ...doc.source, id: id(999) } },
    ])
      expect(invoiceDocumentMatches(v, { ...doc, ...change })).toBe(false);
    expect(() =>
      parseStaffInvoiceDocument(
        {
          ...doc,
          receipts: [
            {
              paymentId: id(99),
              paymentNumber: "OTHER",
              amountKobo: "1",
              refundedKobo: "0",
              confirmedAt: v.createdAt,
            },
          ],
        },
        v.id,
      ),
    ).toThrow();
  });
  it("confirms only exact issued/voided receipts with one version increment", () => {
    const before = invoiceRow(),
      at = "2026-10-18T10:00:37.123Z",
      issued = {
        ...before,
        status: "ISSUED" as const,
        version: 1,
        updatedAt: at,
        issuedAt: at,
      },
      change = {
        invoice: before,
        action: "issue" as const,
        body: { expectedVersion: 0 },
      };
    expect(validateInvoiceTransition(issued, change)).toEqual(issued);
    for (const patch of [
      { version: 0 },
      { version: 2 },
      { issuedAt: null },
      { dueAt: null },
      { invoiceNumber: "OTHER" },
      { paidAt: at },
    ])
      expect(() => validateInvoiceTransition({ ...issued, ...patch }, change)).toThrow();
    const voided = { ...issued, version: 2, status: "VOID" as const, voidedAt: at };
    expect(
      validateInvoiceTransition(voided, {
        invoice: issued,
        action: "void",
        body: { expectedVersion: 1 },
      }),
    ).toEqual(voided);
  });
  it("retains successful-payment void guards and terminal invoice behavior", () => {
    const v = invoiceRow();
    expect(invoiceCanTransition(v, "issue")).toBe(true);
    expect(invoiceCanTransition({ ...v, status: "VOID" }, "issue")).toBe(false);
    expect(
      invoiceCanTransition(
        {
          ...v,
          payments: [
            {
              id: id(99),
              paymentNumber: "PAID",
              currency: "NGN",
              status: "SUCCEEDED",
              amountKobo: v.totalKobo,
              succeededAt: v.createdAt,
            },
          ],
        },
        "void",
      ),
    ).toBe(false);
  });
  it("retains and redacts a minimal actor-bound transition lock", () => {
    sessionStorage.clear();
    const owner = id(302);
    setDraftIdentity(`${owner}:ADMIN`);
    const marker = markInvoiceTransitionPending(owner, "ADMIN", {
      invoiceId: id(190000),
      action: "issue",
      expectedVersion: 0,
      fingerprint: "a".repeat(64),
    });
    expect(readInvoiceTransitionPending(owner, "ADMIN")).toEqual(marker);
    expect(() => clearInvoiceTransitionPending(owner, "ADMIN", id(999))).toThrow();
    redactInvoiceChanges();
    expect(readInvoiceTransitionPending(owner, "ADMIN")).toBe("unknown");
    expect(JSON.stringify(sessionStorage)).not.toContain(id(190000));
    clearInvoiceTransitionPending(owner, "ADMIN");
    expect(readInvoiceTransitionPending(owner, "ADMIN")).toBeUndefined();
    setDraftIdentity(null);
  });
});
