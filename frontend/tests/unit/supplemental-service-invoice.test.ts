import { expect, it } from "vitest";
import { invoiceRow, id } from "../fixtures/work-invoices";
import { invoicePaper } from "../fixtures/work-invoice-detail";
import { invoiceSource, parseWorkInvoice } from "@/lib/admin/work-invoices";
import {
  invoiceDocumentMatches,
  parseStaffInvoiceDocument,
} from "@/lib/admin/work-invoice-detail";
import { invoiceSchema } from "@/lib/api/invoice-schemas";
const original = invoiceRow(1);
const record = {
  ...original,
  servicePayment: {
    materials: { totalKobo: "5375000", recordedKobo: "0" },
    workmanship: { totalKobo: "5375000", recordedKobo: "0" },
    workCompleted: false,
    financialReviewRequired: false,
    paymentPending: false,
    nextPayment: {
      stage: "MATERIALS" as const,
      invoiceVersion: 1,
      amountKobo: "5375000",
    },
  },
  booking: null,
  additionalQuote: {
    id: id(501),
    quoteNumber: "SYNTHETIC-EXTRA",
    amendmentReason: "Reviewed additional inspection",
    originalInvoice: { invoiceNumber: "INV-ORIGINAL-QA" },
    booking: original.booking!,
  },
};
it("keeps an accepted additional quotation as a distinct invoice source and refuses reused credit", () => {
  expect(invoiceSource(parseWorkInvoice(record))).toMatchObject({
    kind: "SERVICE_ADDITION",
    id: id(501),
    href: `/admin/bookings/${original.booking!.id}`,
  });
  expect(invoiceSchema.safeParse({ ...record, depositCreditKobo: "1" }).success).toBe(
    false,
  );
  expect(invoiceSchema.safeParse({ ...record, booking: original.booking }).success).toBe(
    false,
  );
  expect(invoiceSchema.safeParse({ ...record, servicePayment: undefined }).success).toBe(
    false,
  );
});
it("matches the original invoice and reason in the saved supplemental document", () => {
  const paper = invoicePaper(record);
  const allocation = {
    subtotalKobo: "5000000",
    taxKobo: "375000",
    creditKobo: "0",
    totalKobo: "5375000",
  };
  paper.lines = ["Additional material", "Additional work"].map((description) => ({
    description,
    quantity: 1,
    unitPriceKobo: "5000000",
    subtotalKobo: "5000000",
  }));
  paper.servicePaymentPlan = {
    version: 1,
    quoteId: id(501),
    quoteVersion: 1,
    rule: "SAVED_QUOTE_TOTALS_LARGEST_REMAINDER",
    feeTiming: "DEFER_UNTIL_WORK_COMPLETED",
    materials: allocation,
    workmanship: allocation,
    lines: [
      { quoteItemId: id(502), stage: "MATERIALS", ...allocation },
      { quoteItemId: id(503), stage: "WORKMANSHIP", ...allocation },
    ],
  };
  expect(parseStaffInvoiceDocument(paper, record.id).source.type).toBe(
    "SERVICE_ADDITION",
  );
  expect(invoiceDocumentMatches(record, paper)).toBe(true);
  expect(
    invoiceDocumentMatches(record, {
      ...paper,
      source: { ...paper.source, amendmentReason: "Changed scope" },
    }),
  ).toBe(false);
  expect(
    invoiceDocumentMatches(record, {
      ...paper,
      source: { ...paper.source, originalInvoiceNumber: "WRONG" },
    }),
  ).toBe(false);
});
