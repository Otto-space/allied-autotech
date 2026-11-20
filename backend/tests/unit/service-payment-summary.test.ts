import { describe, expect, it } from "vitest";
import {
  buildServicePaymentPlan,
  hasServiceFinancialHold,
} from "../../src/modules/billing/service-payment-plan.js";
import { servicePaymentSummary } from "../../src/modules/billing/service-payment-summary.js";
import { invoiceJsonSafe } from "../../src/modules/billing/billing.types.js";
const id = (n: number) => `f7400000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const totals = {
  subtotalKobo: 200n,
  taxKobo: 15n,
  depositCreditKobo: 0n,
  totalKobo: 215n,
};
const plan = buildServicePaymentPlan(
  {
    id: id(1),
    version: 1,
    items: [
      { id: id(2), type: "PART", quantity: 1, unitPriceKobo: 100n, subtotalKobo: 100n },
      { id: id(3), type: "LABOUR", quantity: 1, unitPriceKobo: 100n, subtotalKobo: 100n },
    ],
  },
  totals,
);
const invoice = {
  ...totals,
  documentSnapshot: { servicePaymentPlan: plan, private: "Do not expose this" },
  version: 1,
  status: "ISSUED",
  booking: { id: id(4), status: "IN_PROGRESS", completedAt: null as Date | null },
  payments: [],
};
const material = {
  paymentNumber: "SYNTHETIC-MATERIALS",
  status: "SUCCEEDED",
  amountKobo: 108n,
  attempts: [],
  policySnapshot: {
    servicePayment: {
      quoteId: id(1),
      quoteVersion: 1,
      stage: "MATERIALS",
      invoiceVersion: 1,
      amountKobo: "108",
    },
    private: "Never expose policy",
  },
};

describe("safe service invoice projection", () => {
  it("offers materials only before completion", () => {
    expect(servicePaymentSummary(invoice)).toMatchObject({
      workCompleted: false,
      materials: { totalKobo: "108", recordedKobo: "0" },
      workmanship: { totalKobo: "107", recordedKobo: "0" },
      nextPayment: { stage: "MATERIALS", invoiceVersion: 1, amountKobo: "108" },
    });
  });
  it("distinguishes materials received from workmanship still not payable", () => {
    expect(
      servicePaymentSummary({ ...invoice, version: 2, payments: [material] }),
    ).toMatchObject({
      materials: { recordedKobo: "108" },
      nextPayment: null,
      paymentPending: false,
    });
  });
  it("offers only the outstanding workmanship after recorded completion", () => {
    expect(
      servicePaymentSummary({
        ...invoice,
        version: 2,
        payments: [material],
        booking: { ...invoice.booking, status: "COMPLETED", completedAt: new Date() },
      }),
    ).toMatchObject({
      nextPayment: { stage: "WORKMANSHIP", invoiceVersion: 2, amountKobo: "107" },
    });
  });
  it.each(["DRAFT", "PAID", "VOID"])("does not offer a charge on %s", (status) => {
    expect(servicePaymentSummary({ ...invoice, status })?.nextPayment).toBeNull();
  });
  it("requires an actual completion date and respects cancellation", () => {
    const paid = { ...invoice, payments: [material] };
    expect(
      servicePaymentSummary({
        ...paid,
        booking: { ...paid.booking, status: "COMPLETED" },
      })?.workCompleted,
    ).toBe(false);
    expect(
      servicePaymentSummary({
        ...invoice,
        booking: { ...invoice.booking, status: "CANCELLED" },
      })?.nextPayment,
    ).toBeNull();
  });
  it("does not suggest a second request while an existing request or unresolved attempt exists", () => {
    expect(
      servicePaymentSummary({
        ...invoice,
        payments: [{ ...material, status: "PROCESSING" }],
      }),
    ).toMatchObject({ paymentPending: true, nextPayment: null });
    expect(
      servicePaymentSummary({ ...invoice, payments: [{ ...material, attempts: [{}] }] }),
    ).toMatchObject({ paymentPending: true, nextPayment: null });
  });
  it("requires staff review for refunds, disputes and unresolved anomalies", () => {
    for (const payment of [
      {
        ...material,
        settledAttempt: { refunds: [{ status: "SUCCEEDED" }], disputes: [] },
      },
      { ...material, settledAttempt: { refunds: [], disputes: [{ status: "LOST" }] } },
      { ...material, anomalies: [{ status: "OPEN" }] },
      { ...material, status: "REQUIRES_REVIEW" },
    ]) {
      expect(servicePaymentSummary({ ...invoice, payments: [payment] })).toMatchObject({
        financialReviewRequired: true,
        nextPayment: null,
      });
    }
    expect(
      hasServiceFinancialHold([
        {
          ...material,
          settledAttempt: {
            refunds: [{ status: "FAILED" }],
            disputes: [{ status: "WON" }],
          },
          anomalies: [{ status: "RESOLVED" }],
        },
      ]),
    ).toBe(false);
  });
  it("exposes only the summary and stage label, preserving existing response shape", () => {
    const result = invoiceJsonSafe({ ...invoice, payments: [material] });
    expect(result).toMatchObject({
      servicePayment: { materials: { recordedKobo: "108" } },
      payments: [{ serviceStage: "MATERIALS" }],
    });
    const json = JSON.stringify(result);
    for (const privateKey of [
      "documentSnapshot",
      "policySnapshot",
      "quoteId",
      "completedAt",
      "Never expose",
      "Do not expose",
      "attempts",
    ])
      expect(json).not.toContain(privateKey);
  });
  it("does not retrofit legacy or non-service invoices", () => {
    expect(servicePaymentSummary({ ...invoice, documentSnapshot: null })).toBeNull();
    expect(invoiceJsonSafe({ ...invoice, documentSnapshot: null })).not.toHaveProperty(
      "servicePayment",
    );
  });
});
