import { prisma } from "../../config/database.js";
import {
  servicePaymentBinding,
  type ServicePaymentStage,
} from "./service-payment-plan.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { assertInvoiceCustomer, assertInvoiceOperator } from "./billing.policy.js";
import { invoiceConflict, invoiceNotFound, invoiceStale } from "./billing.errors.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { env } from "../../config/env.js";
import { PurchaseGuestAccessService } from "../orders/purchase-guest-access.service.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import {
  assertDocumentTotals,
  buildInvoiceSnapshot,
  issuerFromPolicy,
} from "./document-snapshot.js";
import {
  invoiceDocumentSchema,
  staffInvoiceDocumentSchema,
  invoiceSnapshotSchema,
  receiptDocumentSchema,
  type ReceiptDocument,
} from "./document.schemas.js";

export const receiptPaymentSelect = {
  id: true,
  paymentNumber: true,
  customerId: true,
  amountKobo: true,
  currency: true,
  status: true,
  succeededAt: true,
  policySnapshot: true,
  orderId: true,
  invoiceId: true,
  bookingId: true,
  vehicleTransactionId: true,
  settledAttempt: {
    select: {
      paymentId: true,
      status: true,
      verificationStatus: true,
      verifiedAmountKobo: true,
      verifiedCurrency: true,
      verifiedAt: true,
      paidAt: true,
      provider: true,
      method: true,
      refunds: { where: { status: "SUCCEEDED" as const }, select: { amountKobo: true } },
    },
  },
} satisfies Prisma.PaymentSelect;
type ReceiptPayment = Prisma.PaymentGetPayload<{ select: typeof receiptPaymentSelect }>;
type DocumentBuyer =
  | { kind: "account"; actor: AuthenticatedActor }
  | { kind: "guest"; sessionToken: string };

/** A submitted report or duplicate successful attempt is never a receipt source. */
export function confirmedReceipt(payment: ReceiptPayment): {
  amountKobo: string;
  confirmedAt: string;
  refundedKobo: string;
  method: string;
  serviceStage?: ServicePaymentStage;
} | null {
  const attempt = payment.settledAttempt;
  if (
    payment.status !== "SUCCEEDED" ||
    !payment.succeededAt ||
    !attempt ||
    attempt.paymentId !== payment.id ||
    attempt.status !== "SUCCESSFUL" ||
    attempt.verificationStatus !== "VERIFIED" ||
    !attempt.verifiedAt ||
    !attempt.paidAt ||
    payment.currency !== "NGN" ||
    attempt.verifiedCurrency !== "NGN" ||
    attempt.verifiedAmountKobo === null ||
    attempt.verifiedAmountKobo <= 0n ||
    attempt.verifiedAmountKobo !== payment.amountKobo
  )
    return null;
  const refunded = attempt.refunds.reduce(
    (total, refund) => total + refund.amountKobo,
    0n,
  );
  if (refunded < 0n || refunded > attempt.verifiedAmountKobo) return null;
  const method =
    attempt.method === "CASH"
      ? "Cash"
      : attempt.method === "BANK_TRANSFER"
        ? "Bank transfer"
        : attempt.provider === "MANUAL"
          ? "Verified manual payment"
          : attempt.provider === "PAYSTACK"
            ? "Paystack"
            : "Monnify";
  const binding = servicePaymentBinding(payment.policySnapshot);
  if (
    binding &&
    (!payment.invoiceId || BigInt(binding.amountKobo) !== payment.amountKobo)
  )
    return null;
  return {
    amountKobo: attempt.verifiedAmountKobo.toString(),
    confirmedAt: payment.succeededAt.toISOString(),
    refundedKobo: refunded.toString(),
    method,
    ...(binding ? { serviceStage: binding.stage } : {}),
  };
}

export class FinancialDocumentsService {
  constructor(private readonly database: PrismaClient = prisma) {}
  async invoice(actor: AuthenticatedActor, invoiceId: string) {
    assertInvoiceCustomer(actor);
    return invoiceDocumentSchema.parse(
      await this.readInvoice({ kind: "account", actor }, invoiceId),
    );
  }
  async guestInvoice(sessionToken: string, invoiceId: string) {
    return invoiceDocumentSchema.parse(
      await this.readInvoice({ kind: "guest", sessionToken }, invoiceId),
    );
  }
  async staffInvoice(
    actor: AuthenticatedActor,
    invoiceId: string,
    context: RequestSecurityContext,
    format: "document" | "download",
    expected?: { expectedVersion: number; expectedStatus: string },
  ) {
    assertInvoiceOperator(actor);
    return staffInvoiceDocumentSchema.parse(
      await this.readInvoice({ kind: "account", actor }, invoiceId, {
        context,
        format,
        ...(expected ? { expected } : {}),
      }),
    );
  }
  private async readInvoice(
    buyer: DocumentBuyer,
    invoiceId: string,
    staff?: {
      context: RequestSecurityContext;
      format: "document" | "download";
      expected?: { expectedVersion: number; expectedStatus: string };
    },
  ) {
    return withTransactionRetry(
      this.database,
      async (database) => {
        const guest =
          buyer.kind === "guest"
            ? await this.guestOwner(database, buyer.sessionToken)
            : null;
        const customer =
          staff || buyer.kind === "guest"
            ? null
            : await database.customerProfile.findUnique({
                where: { userId: buyer.actor.userId },
                select: { id: true },
              });
        if (!staff && !customer && !guest) throw invoiceNotFound();
        const invoice = await database.invoice.findFirst({
          where: {
            id: invoiceId,
            ...(staff
              ? {}
              : {
                  ...(guest
                    ? {
                        guestId: guest.guestId,
                        customerId: null,
                        order: { guestId: guest.guestId, customerId: null },
                      }
                    : { customerId: customer!.id, guestId: null }),
                  status: { not: "DRAFT" as const },
                }),
          },
          select: {
            id: true,
            invoiceNumber: true,
            customerId: true,
            guestId: true,
            orderId: true,
            bookingId: true,
            vehicleTransactionId: true,
            currency: true,
            status: true,
            version: true,
            issuedAt: true,
            dueAt: true,
            paidAt: true,
            subtotalKobo: true,
            taxKobo: true,
            depositCreditKobo: true,
            totalKobo: true,
            policySnapshot: true,
            documentSnapshot: true,
            createdAt: true,
            updatedAt: true,
            voidedAt: true,
          },
        });
        if (!invoice) throw invoiceNotFound();
        if (
          staff?.expected &&
          (invoice.version !== staff.expected.expectedVersion ||
            invoice.status !== staff.expected.expectedStatus)
        )
          throw invoiceStale();
        const stored =
          invoice.documentSnapshot === null
            ? null
            : invoiceSnapshotSchema.safeParse(invoice.documentSnapshot);
        if (stored && !stored.success)
          throw invoiceConflict("The invoice document needs review");
        const snapshot = stored?.success
          ? stored.data
          : await buildInvoiceSnapshot(database, invoice, true);
        assertDocumentTotals(snapshot, invoice);
        const expectedSource =
          invoice.orderId ?? invoice.bookingId ?? invoice.vehicleTransactionId;
        const expectedType = invoice.orderId
          ? "ORDER"
          : invoice.bookingId
            ? "BOOKING"
            : "VEHICLE_TRANSACTION";
        if (
          snapshot.billTo.reference !== (invoice.customerId ?? invoice.guestId) ||
          snapshot.source.id !== expectedSource ||
          snapshot.source.type !== expectedType
        )
          throw invoiceConflict("The invoice document needs review");
        const payments = await database.payment.findMany({
          where: {
            customerId: invoice.customerId,
            ...(invoice.guestId
              ? { order: { guestId: invoice.guestId, customerId: null } }
              : {}),
            OR: [
              { invoiceId },
              ...(invoice.orderId ? [{ orderId: invoice.orderId }] : []),
              ...(invoice.vehicleTransactionId
                ? [{ vehicleTransactionId: invoice.vehicleTransactionId }]
                : []),
            ],
          },
          select: receiptPaymentSelect,
          take: 201,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        if (payments.length > 200)
          throw invoiceConflict("This document requires an account review");
        const receipts = payments.flatMap((payment) => {
          const receipt = confirmedReceipt(payment);
          return receipt
            ? [
                {
                  paymentId: payment.id,
                  paymentNumber: payment.paymentNumber,
                  amountKobo: receipt.amountKobo,
                  confirmedAt: receipt.confirmedAt,
                  refundedKobo: receipt.refundedKobo,
                  ...(receipt.serviceStage ? { serviceStage: receipt.serviceStage } : {}),
                },
              ]
            : [];
        });
        const document = (
          staff ? staffInvoiceDocumentSchema : invoiceDocumentSchema
        ).parse({
          ...snapshot,
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          currency: invoice.currency,
          status: invoice.status,
          version: invoice.version,
          ...(staff
            ? {
                createdAt: invoice.createdAt.toISOString(),
                updatedAt: invoice.updatedAt.toISOString(),
                voidedAt: invoice.voidedAt?.toISOString() ?? null,
              }
            : {}),
          issuedAt: invoice.issuedAt?.toISOString() ?? null,
          dueAt: invoice.dueAt?.toISOString() ?? null,
          paidAt: invoice.paidAt?.toISOString() ?? null,
          subtotalKobo: invoice.subtotalKobo.toString(),
          taxKobo: invoice.taxKobo.toString(),
          depositCreditKobo: invoice.depositCreditKobo.toString(),
          totalKobo: invoice.totalKobo.toString(),
          receipts,
          paymentRequests: payments.map((payment) => ({
            id: payment.id,
            paymentNumber: payment.paymentNumber,
            amountKobo: payment.amountKobo.toString(),
            status: payment.status,
            succeededAt: payment.succeededAt?.toISOString() ?? null,
            ...(servicePaymentBinding(payment.policySnapshot)
              ? { serviceStage: servicePaymentBinding(payment.policySnapshot)!.stage }
              : {}),
          })),
        });
        if (staff && buyer.kind === "account")
          await appendAuditEvent(database, {
            actorUserId: buyer.actor.userId,
            action: "READ",
            entityType: "INVOICE",
            entityId: invoice.id,
            newValues: {
              document: "invoice",
              format: staff.format,
              version: invoice.version,
              status: invoice.status,
            },
            context: staff.context,
          });
        return document;
      },
      { isolationLevel: "RepeatableRead" },
    );
  }

  async receipt(actor: AuthenticatedActor, paymentId: string): Promise<ReceiptDocument> {
    assertInvoiceCustomer(actor);
    return this.readReceipt({ kind: "account", actor }, paymentId);
  }
  async guestReceipt(sessionToken: string, paymentId: string): Promise<ReceiptDocument> {
    return this.readReceipt({ kind: "guest", sessionToken }, paymentId);
  }
  private async guestOwner(database: Prisma.TransactionClient, sessionToken: string) {
    if (env.PUBLIC_LAUNCH_MODE === "catalogue") throw invoiceNotFound();
    return new PurchaseGuestAccessService(this.database).lockAccess(
      database,
      sessionToken,
      { kind: "read" },
    );
  }
  private async readReceipt(
    buyer: DocumentBuyer,
    paymentId: string,
  ): Promise<ReceiptDocument> {
    return withTransactionRetry(
      this.database,
      async (database) => {
        const guest =
          buyer.kind === "guest"
            ? await this.guestOwner(database, buyer.sessionToken)
            : null;
        const customer =
          buyer.kind === "account"
            ? await database.customerProfile.findUnique({
                where: { userId: buyer.actor.userId },
                select: { id: true },
              })
            : null;
        if (!customer && !guest) throw invoiceNotFound();
        const owner = guest
          ? { guestId: guest.guestId, customerId: null }
          : { customerId: customer!.id, guestId: null };
        const payment = await database.payment.findFirst({
          where: {
            id: paymentId,
            ...(guest
              ? {
                  customerId: null,
                  order: owner,
                  bookingId: null,
                  vehicleTransactionId: null,
                }
              : { customerId: customer!.id }),
          },
          select: receiptPaymentSelect,
        });
        if (!payment) throw invoiceNotFound();
        const receipt = confirmedReceipt(payment);
        if (!receipt)
          throw invoiceConflict("A confirmed payment receipt is not available");
        let source: ReceiptDocument["source"];
        if (payment.invoiceId) {
          const invoice = await database.invoice.findFirst({
            where: {
              id: payment.invoiceId,
              ...owner,
              status: { not: "DRAFT" },
            },
            select: {
              id: true,
              invoiceNumber: true,
              orderId: true,
              bookingId: true,
              vehicleTransactionId: true,
            },
          });
          if (!invoice) throw invoiceNotFound();
          source = {
            id: invoice.id,
            type: "INVOICE",
            reference: invoice.invoiceNumber,
            description: "Invoice",
          };
        } else if (payment.orderId) {
          const order = await database.order.findFirst({
            where: { id: payment.orderId, ...owner },
            select: { id: true, orderNumber: true },
          });
          if (!order) throw invoiceNotFound();
          source = {
            id: order.id,
            type: "ORDER",
            reference: order.orderNumber,
            description: "Parts order",
          };
        } else if (payment.vehicleTransactionId) {
          if (!customer) throw invoiceNotFound();
          const purchase = await database.vehicleTransaction.findFirst({
            where: { id: payment.vehicleTransactionId, customerId: customer.id },
            select: { id: true, transactionNumber: true },
          });
          if (!purchase) throw invoiceNotFound();
          source = {
            id: purchase.id,
            type: "VEHICLE_TRANSACTION",
            reference: purchase.transactionNumber,
            description: "Vehicle purchase",
          };
        } else if (payment.bookingId) {
          if (!customer) throw invoiceNotFound();
          const booking = await database.booking.findFirst({
            where: { id: payment.bookingId, customerId: customer.id },
            select: { id: true },
          });
          if (!booking) throw invoiceNotFound();
          source = {
            id: booking.id,
            type: "BOOKING",
            reference: booking.id,
            description: "Booking deposit",
          };
        } else throw invoiceConflict("The payment source needs review");
        return receiptDocumentSchema.parse({
          ...receipt,
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
          currency: payment.currency,
          issuer: issuerFromPolicy(payment.policySnapshot),
          customerReference: guest?.guestId ?? customer!.id,
          source,
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
export const financialDocumentsService = new FinancialDocumentsService();
