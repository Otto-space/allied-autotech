// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  confirmInvoiceDraft,
  invoiceQuery,
  parseInvoiceSources,
  parseWorkInvoices,
  parseWorkInvoice,
} from "@/lib/admin/work-invoices";
import {
  clearInvoicePending,
  markInvoicePending,
  readInvoicePending,
  redactInvoiceChanges,
} from "@/lib/admin/work-invoice-pending";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { invoiceRow, sourceRow, id } from "../fixtures/work-invoices";
describe("administrator invoice boundaries", () => {
  it("only forwards supported filters and requires exact source scope", () => {
    expect(invoiceQuery(new URLSearchParams(`sourceId=${id(1)}`)).invalid).toBe(true);
    expect(invoiceQuery(new URLSearchParams("status=DRAFT&status=PAID")).invalid).toBe(
      true,
    );
    expect(invoiceQuery(new URLSearchParams("search=INV")).path).toBeNull();
    const q = invoiceQuery(
      new URLSearchParams(
        `sourceType=ORDER&sourceId=${id(1)}&filters=1&create=1&expanded=${id(2)}`,
      ),
    );
    expect(q.invalid).toBe(false);
    const api = new URLSearchParams(q.path!.split("?")[1]);
    expect([...api.keys()]).toEqual(["sourceType", "sourceId", "limit"]);
  });
  it("rejects duplicate, out-of-order and mismatched invoice pages", () => {
    const v = invoiceRow();
    expect(() => parseWorkInvoices({ items: [v, v] }, new URLSearchParams())).toThrow();
    expect(() =>
      parseWorkInvoices({ items: [invoiceRow(1), v] }, new URLSearchParams()),
    ).toThrow();
    expect(() =>
      parseWorkInvoices({ items: [v] }, new URLSearchParams("status=PAID")),
    ).toThrow();
    expect(() =>
      parseWorkInvoices(
        { items: [v] },
        new URLSearchParams(`sourceType=ORDER&sourceId=${id(999)}`),
      ),
    ).toThrow();
  });
  it("checks complete source identity and excludes excess source data", () => {
    const source = sourceRow();
    expect(parseInvoiceSources({ items: [source] }, "ORDER", source.id).items[0]).toEqual(
      source,
    );
    expect(() => parseInvoiceSources({ items: [source] }, "BOOKING")).toThrow();
    expect(() =>
      parseInvoiceSources(
        { items: [{ ...source, customerEmail: "private@example.test" }] },
        "ORDER",
      ),
    ).toThrow();
  });
  it("accepts only the reviewed draft source, due date, lifecycle and exact financial arithmetic", () => {
    const source = sourceRow(),
      body = {
        sourceType: "ORDER" as const,
        sourceId: source.id,
        dueAt: "2026-12-01T12:00:00+01:00",
      },
      v = {
        ...invoiceRow(),
        dueAt: "2026-12-01T11:00:00.000Z",
        order: {
          id: source.id,
          orderNumber: source.reference,
          status: "PENDING",
          branch: source.branch,
        },
      };
    expect(confirmInvoiceDraft(v, body, source).id).toBe(v.id);
    for (const patch of [
      { totalKobo: "1" },
      { version: 1 },
      { status: "ISSUED" },
      { issuedAt: v.createdAt },
      { dueAt: null },
      { order: { ...v.order, id: id(999) } },
    ])
      expect(() => confirmInvoiceDraft({ ...v, ...patch }, body, source)).toThrow();
    expect(() =>
      parseWorkInvoice({
        ...v,
        booking: { id: id(22), status: "CONFIRMED", branch: null },
      }),
    ).toThrow();
  });
  it("keeps money exact above JavaScript's safe integer range", () => {
    const n = "9223372036854775800";
    expect(
      parseWorkInvoice({
        ...invoiceRow(),
        subtotalKobo: n,
        taxKobo: "7",
        totalKobo: "9223372036854775807",
      }).totalKobo,
    ).toBe("9223372036854775807");
  });
  it("preserves an actor-bound pending lock, guards clearing and redacts references", () => {
    sessionStorage.clear();
    const owner = id(302);
    setDraftIdentity(`${owner}:ADMIN`);
    const marker = markInvoicePending(owner, "ADMIN", {
      sourceType: "ORDER",
      sourceId: id(195000),
      fingerprint: "a".repeat(64),
    });
    expect(readInvoicePending(owner, "ADMIN")).toEqual(marker);
    expect(() =>
      markInvoicePending(owner, "ADMIN", {
        sourceType: "ORDER",
        sourceId: id(195000),
        fingerprint: "a".repeat(64),
      }),
    ).toThrow();
    expect(() => clearInvoicePending(owner, "ADMIN", id(999))).toThrow();
    redactInvoiceChanges();
    expect(readInvoicePending(owner, "ADMIN")).toBe("unknown");
    expect(JSON.stringify(sessionStorage)).not.toContain(id(195000));
    clearInvoicePending(owner, "ADMIN");
    expect(readInvoicePending(owner, "ADMIN")).toBeUndefined();
    setDraftIdentity(null);
  });
});
