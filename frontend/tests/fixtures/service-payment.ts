import type { Page } from "@playwright/test";
import { invoicesFixture, invoiceId } from "./customer-invoices";
import { publicCapabilitiesFixture } from "./public-capabilities";
import type { ServicePaymentSummary } from "@/lib/api/service-payment-schemas";

export async function servicePaymentFixture(page: Page) {
  const base = await invoicesFixture(page);
  const invoice = base.records[0]!;
  Object.assign(invoice, {
    subtotalKobo: "20000",
    taxKobo: "1500",
    depositCreditKobo: "0",
    totalKobo: "21500",
    dueAt: null,
  });
  invoice.servicePayment = {
    materials: { totalKobo: "10750", recordedKobo: "0" },
    workmanship: { totalKobo: "10750", recordedKobo: "0" },
    workCompleted: false,
    paymentPending: false,
    financialReviewRequired: false,
    nextPayment: { stage: "MATERIALS", invoiceVersion: 1, amountKobo: "10750" },
  };
  const state = {
    base,
    invoice,
    mode: "normal",
    writes: [] as {
      body: Record<string, unknown>;
      key: string | undefined;
      csrf: string | undefined;
    }[],
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      message: "Synthetic service payment fixture",
      data,
      meta: { requestId: "synthetic-service-stage" },
    },
  });
  await page.route("**/api/v1/public/capabilities", (r) =>
    r.fulfill(ok(publicCapabilitiesFixture("full"))),
  );
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill(ok({ csrfToken: "synthetic-service-stage-csrf-token".repeat(2) })),
  );
  await page.route("**/api/v1/customers/invoices/*", (r) => {
    if (!r.request().url().endsWith("/document")) return r.fulfill(ok(invoice));
    return r.fulfill(
      ok({
        schemaVersion: 1,
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
        status: invoice.status,
        version: invoice.version,
        issuedAt: invoice.issuedAt,
        dueAt: null,
        paidAt: invoice.paidAt,
        issuer: {
          name: "Allied AutoTech",
          address: "Synthetic workshop",
          paymentTerms: "",
        },
        billTo: { name: "Synthetic customer", address: null, reference: invoiceId(302) },
        source: {
          type: "BOOKING",
          id: invoice.booking!.id,
          reference: "SYNTHETIC-QUOTE",
          description: "Service booking",
        },
        lines: [
          {
            description: "Synthetic materials",
            quantity: 1,
            unitPriceKobo: "10000",
            subtotalKobo: "10000",
          },
          {
            description: "Synthetic workmanship",
            quantity: 1,
            unitPriceKobo: "10000",
            subtotalKobo: "10000",
          },
        ],
        discountKobo: "0",
        deliveryKobo: "0",
        detailBasis: "SNAPSHOT",
        subtotalKobo: invoice.subtotalKobo,
        taxKobo: invoice.taxKobo,
        depositCreditKobo: "0",
        totalKobo: invoice.totalKobo,
        paymentRequests: invoice.payments,
        receipts: [],
        servicePaymentPlan: {
          version: 1,
          quoteId: invoiceId(501),
          quoteVersion: 1,
          rule: "SAVED_QUOTE_TOTALS_LARGEST_REMAINDER",
          feeTiming: "DEFER_UNTIL_WORK_COMPLETED",
          materials: {
            subtotalKobo: "10000",
            taxKobo: "750",
            creditKobo: "0",
            totalKobo: "10750",
          },
          workmanship: {
            subtotalKobo: "10000",
            taxKobo: "750",
            creditKobo: "0",
            totalKobo: "10750",
          },
          lines: ["MATERIALS", "WORKMANSHIP"].map((stage, index) => ({
            quoteItemId: invoiceId(502 + index),
            stage,
            subtotalKobo: "10000",
            taxKobo: "750",
            creditKobo: "0",
            totalKobo: "10750",
          })),
        },
      }),
    );
  });
  await page.route("**/api/v1/customers/payments", async (r) => {
    if (r.request().method() !== "POST") return r.fulfill(ok({ items: [] }));
    const body = r.request().postDataJSON(),
      headers = r.request().headers();
    state.writes.push({
      body,
      key: headers["idempotency-key"],
      csrf: headers["x-csrf-token"],
    });
    const accepted = body.acceptedServiceStage as NonNullable<
      ServicePaymentSummary["nextPayment"]
    >;
    let payment = invoice.payments.find(
      (p) => p.serviceStage === accepted.stage && p.status === "REQUIRES_PAYMENT",
    );
    const replayed = !!payment;
    if (!payment) {
      payment = {
        id: invoiceId(601 + invoice.payments.length),
        paymentNumber: `SYNTHETIC-${accepted.stage}`,
        amountKobo: accepted.amountKobo,
        status: "REQUIRES_PAYMENT",
        succeededAt: null,
        serviceStage: accepted.stage,
      };
      invoice.payments.push(payment);
      invoice.servicePayment!.paymentPending = true;
      invoice.servicePayment!.nextPayment = null;
    }
    if (state.mode === "lost" && !replayed) return r.abort("failed");
    return r.fulfill(
      ok({
        replayed,
        payment: {
          ...payment,
          currency: "NGN",
          purpose: "SERVICE_INVOICE",
          invoiceId: invoice.id,
          orderId: null,
          bookingId: null,
          vehicleTransactionId: null,
          expiresAt: null,
          attempts: [],
        },
      }),
    );
  });
  return state;
}
