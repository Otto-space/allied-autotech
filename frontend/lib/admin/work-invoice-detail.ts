import { z } from "zod";
import { invoiceDocumentSchema } from "@/lib/api/document-schemas";
import { invoiceSource, parseWorkInvoice, type WorkInvoice } from "./work-invoices";
const date = z.iso.datetime({ offset: true });
export const staffInvoiceDocumentSchema = z
  .object({
    ...invoiceDocumentSchema.shape,
    status: z.enum(["DRAFT", "ISSUED", "PAID", "VOID"]),
    createdAt: date,
    updatedAt: date,
    voidedAt: date.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    // Reuse every customer document arithmetic/duplicate rule while adding the
    // separately authorized staff draft status and lifecycle metadata.
    const result = invoiceDocumentSchema.safeParse({
      ...value,
      status: value.status === "DRAFT" ? "ISSUED" : value.status,
    });
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
export type StaffInvoiceDocument = z.infer<typeof staffInvoiceDocumentSchema>;
export type InvoiceAction = "issue" | "void";
export type InvoiceTransition = {
  invoice: WorkInvoice;
  action: InvoiceAction;
  body: { expectedVersion: number };
};
export function parseInvoiceDetail(value: unknown, id: string) {
  const v = parseWorkInvoice(value);
  if (v.id !== id) throw Error("Invoice scope could not be confirmed");
  return v;
}
export function parseStaffInvoiceDocument(value: unknown, id: string) {
  const v = staffInvoiceDocumentSchema.parse(value);
  if (
    v.id !== id ||
    v.receipts.some((r) => {
      const p = v.paymentRequests.find((p) => p.id === r.paymentId);
      return (
        !p ||
        p.status !== "SUCCEEDED" ||
        p.amountKobo !== r.amountKobo ||
        p.paymentNumber !== r.paymentNumber ||
        p.succeededAt !== r.confirmedAt ||
        BigInt(r.refundedKobo) > BigInt(r.amountKobo)
      );
    })
  )
    throw Error("Invoice document scope could not be confirmed");
  return v;
}
export function invoiceDocumentMatches(
  invoice: WorkInvoice,
  document: StaffInvoiceDocument,
) {
  const source = invoiceSource(invoice);
  return (
    invoice.id === document.id &&
    invoice.invoiceNumber === document.invoiceNumber &&
    invoice.status === document.status &&
    invoice.version === document.version &&
    invoice.currency === document.currency &&
    source.kind === document.source.type &&
    source.id === document.source.id &&
    (source.kind === "BOOKING" || source.reference === document.source.reference) &&
    (
      [
        "createdAt",
        "updatedAt",
        "issuedAt",
        "dueAt",
        "paidAt",
        "voidedAt",
        "subtotalKobo",
        "taxKobo",
        "depositCreditKobo",
        "totalKobo",
      ] as const
    ).every((key) => invoice[key] === document[key]) &&
    invoice.payments.every((p) =>
      document.paymentRequests.some(
        (r) =>
          r.id === p.id &&
          r.paymentNumber === p.paymentNumber &&
          r.amountKobo === p.amountKobo &&
          r.status === p.status &&
          r.succeededAt === p.succeededAt,
      ),
    )
  );
}
export function invoiceCanTransition(invoice: WorkInvoice, action: InvoiceAction) {
  return action === "issue"
    ? invoice.status === "DRAFT"
    : ["DRAFT", "ISSUED"].includes(invoice.status) &&
        !invoice.payments.some((p) => p.status === "SUCCEEDED");
}
export const invoiceDetailSnapshot = (v: WorkInvoice) => JSON.stringify(v);
function immutable(v: WorkInvoice) {
  return JSON.stringify([
    v.id,
    v.invoiceNumber,
    v.currency,
    v.createdAt,
    v.dueAt,
    v.subtotalKobo,
    v.taxKobo,
    v.depositCreditKobo,
    v.totalKobo,
    v.order,
    v.booking,
    v.vehicleTransaction,
    v.payments,
  ]);
}
export function validateInvoiceTransition(value: unknown, change: InvoiceTransition) {
  const v = parseInvoiceDetail(value, change.invoice.id),
    before = change.invoice;
  if (
    !invoiceCanTransition(before, change.action) ||
    change.body.expectedVersion !== before.version ||
    immutable(v) !== immutable(before) ||
    v.version !== before.version + 1 ||
    v.status !== (change.action === "issue" ? "ISSUED" : "VOID") ||
    v.paidAt !== before.paidAt ||
    Date.parse(v.updatedAt) < Date.parse(before.updatedAt) ||
    (change.action === "issue"
      ? !v.issuedAt ||
        Date.parse(v.issuedAt) < Date.parse(before.createdAt) ||
        v.voidedAt !== before.voidedAt
      : !v.voidedAt ||
        Date.parse(v.voidedAt) < Date.parse(before.createdAt) ||
        v.issuedAt !== before.issuedAt)
  )
    throw Error("Invoice change could not be confirmed");
  return v;
}
