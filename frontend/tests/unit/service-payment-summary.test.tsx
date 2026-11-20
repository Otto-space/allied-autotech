// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ServicePaymentSummary } from "@/app/components/service-payment-summary";
import { parseInvoice } from "@/lib/api/invoice-schemas";
import { parseCustomerInvoices } from "@/lib/api/customer-invoices-schema";
import { invoiceRecord } from "../fixtures/customer-invoices";
import type { ServicePaymentSummary as Summary } from "@/lib/api/service-payment-schemas";
import { servicePaymentDocumentMatches } from "@/lib/api/service-payment-schemas";
afterEach(cleanup);
const summary: Summary = {
  materials: { totalKobo: "3000000", recordedKobo: "0" },
  workmanship: { totalKobo: "4363750", recordedKobo: "0" },
  workCompleted: false,
  financialReviewRequired: false,
  paymentPending: false,
  nextPayment: { stage: "MATERIALS", invoiceVersion: 1, amountKobo: "3000000" },
};
describe("customer service invoice amounts and copy", () => {
  it("requires the document to carry the same saved stage totals before export", () => {
    const invoice = { servicePayment: summary },
      document = {
        servicePaymentPlan: {
          materials: { totalKobo: "3000000" },
          workmanship: { totalKobo: "4363750" },
        },
      };
    expect(servicePaymentDocumentMatches(invoice, document)).toBe(true);
    expect(servicePaymentDocumentMatches(invoice, {})).toBe(false);
    expect(servicePaymentDocumentMatches({}, document)).toBe(false);
    expect(
      servicePaymentDocumentMatches(invoice, {
        servicePaymentPlan: {
          ...document.servicePaymentPlan,
          materials: { totalKobo: "1" },
        },
      }),
    ).toBe(false);
    expect(servicePaymentDocumentMatches({}, {})).toBe(true);
  });
  it("retains the safe summary across detail and list parsers", () => {
    const row = { ...invoiceRecord(), servicePayment: summary };
    expect(parseInvoice(row).servicePayment).toEqual(summary);
    expect(parseCustomerInvoices({ items: [row] }).items[0]?.servicePayment).toEqual(
      summary,
    );
  });
  it("keeps historical invoice responses compatible", () => {
    expect(parseInvoice(invoiceRecord()).servicePayment).toBeUndefined();
  });
  it("rejects wrong totals, over-recorded money and an unearned workmanship request", () => {
    for (const patch of [
      { materials: { totalKobo: "1", recordedKobo: "0" } },
      { materials: { ...summary.materials, recordedKobo: "3000001" } },
      {
        nextPayment: {
          ...summary.nextPayment!,
          stage: "WORKMANSHIP" as const,
          amountKobo: "4363750",
        },
      },
      { nextPayment: { ...summary.nextPayment!, invoiceVersion: 2 } },
      { nextPayment: { ...summary.nextPayment!, amountKobo: "7363750" } },
      { paymentPending: true },
      { financialReviewRequired: true },
    ])
      expect(() =>
        parseInvoice({ ...invoiceRecord(), servicePayment: { ...summary, ...patch } }),
      ).toThrow();
  });
  it("shows each stage separately and does not claim work completion", () => {
    render(<ServicePaymentSummary summary={summary} />);
    expect(
      screen.getByRole("region", { name: "Workshop payment stages" }).textContent,
    ).toContain("Materials payments recorded");
    expect(screen.getByText(/has not recorded completion/)).toBeTruthy();
    expect(screen.queryByText(/Work completion is recorded/)).toBeNull();
  });
  it("gives financial review priority over another payment suggestion", () => {
    render(
      <ServicePaymentSummary
        summary={{ ...summary, financialReviewRequired: true, nextPayment: null }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("before paying again");
  });
  it("explains an existing request and distinguishes completion from vehicle release", () => {
    const view = render(
      <ServicePaymentSummary
        summary={{ ...summary, paymentPending: true, nextPayment: null }}
      />,
    );
    expect(screen.getByText(/request is already in progress/)).toBeTruthy();
    view.rerender(
      <ServicePaymentSummary
        summary={{ ...summary, workCompleted: true, nextPayment: null }}
      />,
    );
    expect(screen.getByText(/Vehicle release still requires/)).toBeTruthy();
  });
});
