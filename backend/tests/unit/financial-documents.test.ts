import { describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import {
  FinancialDocumentsService,
  confirmedReceipt,
  receiptPaymentSelect,
} from "../../src/modules/billing/documents.service.js";
import {
  approvedIssuer,
  assertDocumentTotals,
  buildInvoiceSnapshot,
  issuerFromPolicy,
} from "../../src/modules/billing/document-snapshot.js";
import type {
  InvoiceDocument,
  InvoiceSnapshot,
} from "../../src/modules/billing/document.schemas.js";
import {
  documentFilename,
  documentMoney,
  renderFinancialPdf,
} from "../../src/modules/billing/document-pdf.js";

const id = "f7000000-0000-4000-8000-000000000001",
  account = "f7000000-0000-4000-8000-000000000002";
const customer: AuthenticatedActor = {
  userId: account,
  sessionId: id,
  email: "docs@example.test",
  role: "CUSTOMER",
  mfaRequired: false,
  mfaVerifiedAt: null,
};
const at = new Date("2026-10-08T09:00:00Z");
const invoice = {
  customerId: account,
  bookingId: id,
  subtotalKobo: 8500000n,
  taxKobo: 637500n,
  depositCreditKobo: 0n,
  totalKobo: 9137500n,
};
export const snapshot: InvoiceSnapshot = {
  schemaVersion: 1,
  issuer: { ...approvedIssuer },
  billTo: {
    name: "Synthetic Customer",
    address: "Port Harcourt, Nigeria",
    reference: account,
  },
  source: {
    type: "BOOKING",
    id,
    reference: "AA-QUOTE-2041",
    description: "Service booking",
  },
  lines: [
    {
      description: "Diagnostic inspection",
      quantity: 1,
      unitPriceKobo: "2500000",
      subtotalKobo: "2500000",
    },
    {
      description: "Maintenance labour",
      quantity: 1,
      unitPriceKobo: "6000000",
      subtotalKobo: "6000000",
    },
  ],
  discountKobo: "0",
  deliveryKobo: "0",
  detailBasis: "SNAPSHOT",
};
const document: InvoiceDocument = {
  ...snapshot,
  id,
  invoiceNumber: "AA-INV-2041",
  currency: "NGN",
  status: "ISSUED",
  version: 1,
  issuedAt: at.toISOString(),
  dueAt: "2026-10-15T09:00:00Z",
  paidAt: null,
  subtotalKobo: "8500000",
  taxKobo: "637500",
  depositCreditKobo: "0",
  totalKobo: "9137500",
  receipts: [],
  paymentRequests: [],
};
type Payment = Prisma.PaymentGetPayload<{ select: typeof receiptPaymentSelect }>;
const payment = (): Payment => ({
  id,
  paymentNumber: "AA-PAY-2041",
  customerId: account,
  amountKobo: 9137500n,
  currency: "NGN",
  status: "SUCCEEDED",
  succeededAt: at,
  policySnapshot: null,
  orderId: null,
  invoiceId: id,
  bookingId: null,
  vehicleTransactionId: null,
  settledAttempt: {
    paymentId: id,
    status: "SUCCESSFUL",
    verificationStatus: "VERIFIED",
    verifiedAmountKobo: 9137500n,
    verifiedCurrency: "NGN",
    verifiedAt: at,
    paidAt: at,
    provider: "MANUAL",
    method: "BANK_TRANSFER",
    refunds: [],
  },
});
describe("financial document authority", () => {
  it.each(["ORDER", "VEHICLE_TRANSACTION"] as const)(
    "includes owned %s payments without claiming full invoice settlement",
    async (sourceType) => {
      const sourceId = "f7000000-0000-4000-8000-000000000009";
      const sourceField = sourceType === "ORDER" ? "orderId" : "vehicleTransactionId";
      const findMany = vi.fn().mockResolvedValue([
        {
          ...payment(),
          invoiceId: null,
          [sourceField]: sourceId,
          amountKobo: 10000n,
          settledAttempt: { ...payment().settledAttempt!, verifiedAmountKobo: 10000n },
        },
      ]);
      const db = {
        customerProfile: { findUnique: vi.fn().mockResolvedValue({ id: account }) },
        invoice: {
          findFirst: vi.fn().mockResolvedValue({
            ...invoice,
            id,
            invoiceNumber: "INV-1",
            currency: "NGN",
            version: 1,
            status: "ISSUED",
            issuedAt: at,
            dueAt: null,
            paidAt: null,
            bookingId: null,
            orderId: null,
            vehicleTransactionId: null,
            [sourceField]: sourceId,
            policySnapshot: null,
            documentSnapshot: {
              ...snapshot,
              source: { ...snapshot.source, type: sourceType, id: sourceId },
            },
          }),
        },
        payment: { findMany },
      };
      const service = new FinancialDocumentsService({
        $transaction: (fn: (value: unknown) => unknown) => fn(db),
      } as unknown as PrismaClient);
      const result = await service.invoice(customer, id);
      expect(result.status).toBe("ISSUED");
      expect(result.receipts[0]?.amountKobo).toBe("10000");
      expect(result.paymentRequests[0]?.id).toBe(id);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customerId: account,
            OR: [{ invoiceId: id }, { [sourceField]: sourceId }],
          },
          take: 201,
        }),
      );
    },
  );
  it("reconciles lines, adjustments, tax and deposit credit with integer money", () => {
    expect(() => assertDocumentTotals(snapshot, invoice)).not.toThrow();
    expect(() =>
      assertDocumentTotals(snapshot, { ...invoice, totalKobo: invoice.totalKobo + 1n }),
    ).toThrow();
    expect(() =>
      assertDocumentTotals(
        {
          ...snapshot,
          lines: [{ ...snapshot.lines[0]!, quantity: 2 }, snapshot.lines[1]!],
        },
        invoice,
      ),
    ).toThrow();
    expect(() =>
      assertDocumentTotals(
        { ...snapshot, discountKobo: "500", deliveryKobo: "1000" },
        {
          ...invoice,
          subtotalKobo: 8500500n,
          depositCreditKobo: 10000n,
          totalKobo: 9128000n,
        },
      ),
    ).not.toThrow();
  });
  it("uses historical finance identity without exposing policy approval internals", () => {
    expect(
      issuerFromPolicy({
        settings: {
          invoiceName: "Recorded company",
          invoiceAddress: "Recorded workshop address",
          paymentTerms: "Payment due on the recorded date",
        },
        source: "internal review",
      }),
    ).toEqual({
      name: "Recorded company",
      address: "Recorded workshop address",
      paymentTerms: "Payment due on the recorded date",
    });
    expect(issuerFromPolicy(null)).toEqual(approvedIssuer);
  });
  it.each([
    "REQUIRES_PAYMENT",
    "REQUIRES_REVIEW",
    "PROCESSING",
    "CANCELLED",
    "EXPIRED",
  ] as const)("does not produce a receipt for %s", (status) => {
    expect(confirmedReceipt({ ...payment(), status })).toBeNull();
  });
  it("requires the selected verified attempt, exact amount, currency, ownership and dates", () => {
    const paid = payment();
    expect(confirmedReceipt(paid)?.amountKobo).toBe("9137500");
    for (const change of [
      { paymentId: account },
      { verificationStatus: "UNVERIFIED" as const },
      { status: "FAILED" as const },
      { verifiedAmountKobo: 1n },
      { verifiedCurrency: "USD" },
      { verifiedAt: null },
      { paidAt: null },
    ])
      expect(
        confirmedReceipt({
          ...paid,
          settledAttempt: { ...paid.settledAttempt!, ...change },
        }),
      ).toBeNull();
    expect(confirmedReceipt({ ...paid, settledAttempt: null })).toBeNull();
    expect(confirmedReceipt({ ...paid, succeededAt: null })).toBeNull();
  });
  it("records completed refunds separately without changing received amount", () => {
    const paid = payment();
    expect(
      confirmedReceipt({
        ...paid,
        settledAttempt: { ...paid.settledAttempt!, refunds: [{ amountKobo: 50000n }] },
      }),
    ).toMatchObject({ amountKobo: "9137500", refundedKobo: "50000" });
    expect(
      confirmedReceipt({
        ...paid,
        settledAttempt: { ...paid.settledAttempt!, refunds: [{ amountKobo: 99999999n }] },
      }),
    ).toBeNull();
  });
  it.each(["STAFF", "ADMIN", "SUPER_ADMIN"] as const)(
    "denies %s before any document query",
    async (role) => {
      const transaction = vi.fn();
      const service = new FinancialDocumentsService({
        $transaction: transaction,
      } as unknown as PrismaClient);
      await expect(service.invoice({ ...customer, role }, id)).rejects.toThrow();
      await expect(service.receipt({ ...customer, role }, id)).rejects.toThrow();
      expect(transaction).not.toHaveBeenCalled();
    },
  );
  it("applies ownership and draft exclusion to the document read", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = {
      customerProfile: { findUnique: vi.fn().mockResolvedValue({ id: account }) },
      invoice: { findFirst },
    };
    const service = new FinancialDocumentsService({
      $transaction: (fn: (value: unknown) => unknown) => fn(db),
    } as unknown as PrismaClient);
    await expect(service.invoice(customer, id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id, customerId: account, status: { not: "DRAFT" } },
      }),
    );
  });
  it("denies another customer's payment and never looks up its source", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const source = vi.fn();
    const db = {
      customerProfile: { findUnique: vi.fn().mockResolvedValue({ id: account }) },
      payment: { findFirst },
      invoice: { findFirst: source },
    };
    const service = new FinancialDocumentsService({
      $transaction: (fn: (value: unknown) => unknown) => fn(db),
    } as unknown as PrismaClient);
    await expect(service.receipt(customer, id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, customerId: account } }),
    );
    expect(source).not.toHaveBeenCalled();
  });
  it("captures creation identity and accepted quotation lines without live catalogue prices", async () => {
    const db = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          firstName: "Ada",
          lastName: "Example",
          address: null,
          city: "Port Harcourt",
          state: "Rivers",
          country: "Nigeria",
        }),
      },
      serviceQuote: {
        findFirst: vi.fn().mockResolvedValue({
          quoteNumber: "QUOTE-1",
          items: snapshot.lines.map((item) => ({
            ...item,
            unitPriceKobo: BigInt(item.unitPriceKobo),
            subtotalKobo: BigInt(item.subtotalKobo),
          })),
        }),
      },
    } as unknown as Prisma.TransactionClient;
    expect(await buildInvoiceSnapshot(db, invoice)).toMatchObject({
      billTo: { name: "Ada Example" },
      lines: snapshot.lines,
      detailBasis: "SNAPSHOT",
    });
    expect(await buildInvoiceSnapshot(db, invoice, true)).toMatchObject({
      billTo: { name: "Account holder", address: null },
      detailBasis: "SOURCE_RECORDS",
    });
  });
  it("labels missing legacy itemization and fails closed for new inconsistent sources", async () => {
    const db = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          firstName: "Ada",
          lastName: "Example",
          country: "Nigeria",
        }),
      },
      serviceQuote: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as Prisma.TransactionClient;
    expect(await buildInvoiceSnapshot(db, invoice, true)).toMatchObject({
      detailBasis: "LEGACY_SUMMARY",
      lines: [{ description: "Recorded invoice subtotal", subtotalKobo: "8500000" }],
    });
    await expect(buildInvoiceSnapshot(db, invoice)).rejects.toThrow();
  });
  it("formats money without floating point and sanitizes attachment names", () => {
    expect(documentMoney("900719925474099199")).toBe("NGN 9,007,199,254,740,991.99");
    expect(documentFilename("invoice", '../INV\r\n"bad')).toBe(
      "invoice----INV---bad.pdf",
    );
  });
  it("renders a real bounded PDF with bundled font, including multi-page lines", async () => {
    const pdf = await renderFinancialPdf({
      ...document,
      lines: Array.from({ length: 35 }, (_, i) => ({
        ...snapshot.lines[0]!,
        description: `Inspection line ${i + 1}: ${"Detailed automotive diagnostic checks. ".repeat(12)}`,
      })),
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(10000);
    expect(pdf.length).toBeLessThan(4 * 1024 * 1024);
    const pageCount = Number(pdf.toString("latin1").match(/\/Count (\d+)/)?.[1]);
    expect(pageCount).toBeGreaterThan(1);
    expect(pageCount).toBeLessThanOrEqual(50);
  });
});
