import { assertSupplementalInvoiceCurrent } from "../billing/service-invoice-context.js";
import type { Invoice, Prisma } from "../../generated/prisma/client.js";
import { invoiceSnapshotSchema } from "../billing/document.schemas.js";
import { assertDocumentTotals } from "../billing/document-snapshot.js";
import { confirmedReceipt, receiptPaymentSelect } from "../billing/documents.service.js";
import {
  hasServiceFinancialHold,
  servicePaymentPlanFromSnapshot,
  serviceStagePaid,
} from "../billing/service-payment-plan.js";
import type { ServiceLineItemInput } from "./service-operations.schemas.js";
import type { PricedLine } from "./service-operations.types.js";
import { serviceOperationConflict } from "./service-operations.errors.js";

/** Call only after authorization and the Booking row lock. Never retrofit an
 * issued historical invoice. The saved quotation, not today's catalogue price,
 * defines the work which the customer actually accepted. */
async function invoiceWorkAgreement(
  tx: Prisma.TransactionClient,
  bookingId: string,
  invoice: Invoice,
) {
  const plan = servicePaymentPlanFromSnapshot(invoice.documentSnapshot, invoice);
  if (!plan) return null;
  if (invoice.status === "VOID")
    throw serviceOperationConflict(
      "The service invoice was voided; review the agreed scope before authorising work",
    );
  const snapshot = invoiceSnapshotSchema.safeParse(invoice.documentSnapshot);
  if (!snapshot.success)
    throw serviceOperationConflict("The agreed invoice needs financial review");
  assertDocumentTotals(snapshot.data, invoice);
  const quote = await tx.serviceQuote.findUnique({
    where: { id: plan.quoteId },
    include: { items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  if (
    !quote ||
    quote.bookingId !== bookingId ||
    (invoice.additionalQuoteId
      ? quote.id !== invoice.additionalQuoteId
      : quote.originalInvoiceId !== null) ||
    quote.status !== "ACCEPTED" ||
    !quote.acceptedAt ||
    quote.version !== plan.quoteVersion ||
    quote.items.length !== plan.lines.length ||
    quote.items.some((line, i) => {
      const saved = snapshot.data.lines[i]!;
      return (
        line.id !== plan.lines[i]!.quoteItemId ||
        (line.type === "PART" ? "MATERIALS" : "WORKMANSHIP") !== plan.lines[i]!.stage ||
        line.description !== saved.description ||
        line.quantity !== saved.quantity ||
        line.unitPriceKobo.toString() !== saved.unitPriceKobo ||
        line.subtotalKobo.toString() !== saved.subtotalKobo
      );
    })
  )
    throw serviceOperationConflict(
      "The accepted scope no longer matches the saved invoice; review the change with the customer",
    );
  return { invoice, plan, lines: quote.items };
}
type Agreement = NonNullable<Awaited<ReturnType<typeof invoiceWorkAgreement>>>;

/** Caller holds Booking. Include only separately issued, explicitly agreed additions. */
export async function agreedServiceWork(tx: Prisma.TransactionClient, bookingId: string) {
  await tx.$queryRaw`SELECT i."id" FROM "Invoice" i LEFT JOIN "ServiceQuote" q ON q."id"=i."additionalQuoteId" WHERE i."bookingId"=${bookingId}::uuid OR q."bookingId"=${bookingId}::uuid ORDER BY i."id" FOR SHARE OF i`;
  const original = await tx.invoice.findUnique({ where: { bookingId } });
  if (!original) return null;
  const base = await invoiceWorkAgreement(tx, bookingId, original);
  if (!base) return null;
  const additions = await tx.serviceQuote.findMany({
    where: { bookingId, originalInvoiceId: original.id, status: "ACCEPTED" },
    orderBy: { version: "asc" },
    include: { supplementalInvoice: true },
  });
  const obligations: Agreement[] = [base];
  let pendingAdditions = false;
  for (const addition of additions) {
    const invoice = addition.supplementalInvoice;
    if (!invoice || !["ISSUED", "PAID"].includes(invoice.status)) {
      pendingAdditions = true;
      continue;
    }
    await assertSupplementalInvoiceCurrent(tx, invoice.id);
    const agreement = await invoiceWorkAgreement(tx, bookingId, invoice);
    if (!agreement)
      throw serviceOperationConflict(
        "The additional invoice needs a reviewed payment allocation",
      );
    obligations.push(agreement);
  }
  return {
    ...base,
    obligations,
    pendingAdditions,
    lines: obligations.flatMap((agreement) => agreement.lines),
  };
}

const key = (line: Omit<PricedLine, "quantity" | "subtotalKobo">) =>
  JSON.stringify([
    line.type,
    line.productId,
    line.description,
    line.unitPriceKobo.toString(),
  ]);

/** Match quantities across identical lines; splitting a row cannot bypass the
 * accepted limit. Completion additionally requires every agreed line to be done. */
export function assertAgreedWorkScope(
  agreed: readonly PricedLine[],
  work: readonly PricedLine[],
  complete = false,
) {
  const remaining = new Map<string, number>();
  for (const line of agreed) {
    if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.unitPriceKobo < 0n ||
      line.subtotalKobo !== line.unitPriceKobo * BigInt(line.quantity)
    )
      throw serviceOperationConflict("The accepted work scope needs review");
    remaining.set(key(line), (remaining.get(key(line)) ?? 0) + line.quantity);
  }
  if (work.length === 0)
    throw serviceOperationConflict(
      "Prepare the agreed work items before starting or completing this job",
    );
  for (const line of work) {
    const available = remaining.get(key(line)) ?? 0;
    if (
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > available ||
      line.subtotalKobo !== line.unitPriceKobo * BigInt(line.quantity)
    )
      throw serviceOperationConflict(
        "Work items exceed or differ from the customer's accepted quotation; obtain an agreed change before proceeding",
      );
    remaining.set(key(line), available - line.quantity);
  }
  if (complete && [...remaining.values()].some((quantity) => quantity !== 0))
    throw serviceOperationConflict(
      "Record all agreed work before completion; changed scope needs customer agreement",
    );
}

/** Resolve an unambiguous accepted item, preserving its description and price.
 * A changed material description must be explicitly the accepted description. */
export function priceAgreedWorkInputs(
  agreed: readonly PricedLine[],
  inputs: readonly ServiceLineItemInput[],
): PricedLine[] {
  return inputs.map((input) => {
    const matches = agreed.filter(
      (line) =>
        line.type === input.type &&
        (input.type === "PART"
          ? line.productId === input.productId &&
            (input.description === undefined || line.description === input.description)
          : line.description === input.description &&
            line.unitPriceKobo === BigInt(input.unitPriceKobo)),
    );
    const distinct = new Map(matches.map((line) => [key(line), line]));
    if (distinct.size !== 1)
      throw serviceOperationConflict(
        "Choose the exact item and description from the accepted quotation; additional work needs customer agreement",
      );
    const accepted = [...distinct.values()][0]!;
    return {
      type: accepted.type,
      productId: accepted.productId,
      description: accepted.description,
      quantity: input.quantity,
      unitPriceKobo: accepted.unitPriceKobo,
      subtotalKobo: accepted.unitPriceKobo * BigInt(input.quantity),
    };
  });
}

/** Engineering timing choice: a work order containing quoted materials cannot
 * enter active work before their agreed stage is verified. Labour-only work can
 * proceed; this never collects workmanship early or turns it into a deposit. */
async function assertSingleAgreementMaterialsReady(
  tx: Prisma.TransactionClient,
  agreement: Agreement,
  work: readonly PricedLine[],
  requireWholeBalance = false,
) {
  if (!requireWholeBalance && !work.some((line) => line.type === "PART")) return;
  const credit = agreement.invoice.depositCreditKobo;
  // Refund creation serializes on the settled attempt. Do not wait while holding
  // Booking: verification may already hold Attempt before acquiring Booking.
  // Lock every available proof, then require each settled proof to be in that
  // set. SKIP LOCKED does not authorize a partial set or depend on adapter errors.
  const locked = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT a."id" FROM "PaymentAttempt" a JOIN "Payment" p ON p."settledAttemptId" = a."id" WHERE p."invoiceId" = ${agreement.invoice.id}::uuid OR (p."bookingId" = ${agreement.invoice.bookingId}::uuid AND ${credit > 0n}) ORDER BY a."id" FOR SHARE OF a SKIP LOCKED`;
  const lockedIds = new Set(locked.map((row) => row.id));
  const payments = await tx.payment.findMany({
    where: {
      OR: [
        { invoiceId: agreement.invoice.id },
        ...(credit > 0n ? [{ bookingId: agreement.invoice.bookingId }] : []),
      ],
    },
    select: {
      ...receiptPaymentSelect,
      anomalies: {
        where: { status: { in: ["OPEN", "INVESTIGATING"] } },
        select: { status: true },
      },
      settledAttempt: {
        select: {
          ...receiptPaymentSelect.settledAttempt.select,
          id: true,
          refunds: { select: { status: true, amountKobo: true } },
          disputes: { select: { status: true } },
        },
      },
    },
  });
  if (
    payments.some(
      (payment) => payment.settledAttempt && !lockedIds.has(payment.settledAttempt.id),
    )
  )
    throw serviceOperationConflict(
      requireWholeBalance
        ? "Payment verification is busy; reload before vehicle collection"
        : "Materials payment is being updated; reload the job after verification finishes",
    );
  const invoicePayments = payments.filter((p) => p.invoiceId === agreement.invoice.id);
  const deposits =
    credit > 0n
      ? payments.filter((p) => p.bookingId === agreement.invoice.bookingId)
      : [];
  // A completed historical deposit refund may already be included in the saved
  // net credit. Pending adjustments still hold; the exact remaining credit is
  // verified below. Never interpret a refund as permission to recharge.
  if (
    hasServiceFinancialHold(invoicePayments) ||
    hasServiceFinancialHold(
      deposits.map((payment) => ({
        ...payment,
        settledAttempt: payment.settledAttempt && {
          ...payment.settledAttempt,
          refunds: payment.settledAttempt.refunds.filter((r) => r.status !== "SUCCEEDED"),
        },
      })),
    )
  )
    throw serviceOperationConflict(
      requireWholeBalance
        ? "Resolve financial adjustments before vehicle collection"
        : "Materials payment needs financial review before work using those materials can proceed",
    );
  for (const payment of payments.filter((p) => p.status === "SUCCEEDED")) {
    const receipt = confirmedReceipt({
      ...payment,
      settledAttempt: payment.settledAttempt && {
        ...payment.settledAttempt,
        refunds: payment.settledAttempt.refunds.filter((r) => r.status === "SUCCEEDED"),
      },
    });
    if (
      !receipt ||
      (payment.invoiceId === agreement.invoice.id && receipt.refundedKobo !== "0")
    )
      throw serviceOperationConflict(
        requireWholeBalance
          ? "Verify the recorded service payments before vehicle collection"
          : "Verify the recorded materials payment before proceeding",
      );
  }
  if (credit > 0n) {
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: agreement.invoice.bookingId! },
      select: { depositPaidAt: true, depositForfeitedAt: true },
    });
    const deposit = payments.find((p) => p.bookingId === agreement.invoice.bookingId);
    const receipt =
      deposit &&
      confirmedReceipt({
        ...deposit,
        settledAttempt: deposit.settledAttempt && {
          ...deposit.settledAttempt,
          refunds: deposit.settledAttempt.refunds.filter((r) => r.status === "SUCCEEDED"),
        },
      });
    if (
      !booking.depositPaidAt ||
      booking.depositForfeitedAt ||
      !receipt ||
      BigInt(receipt.amountKobo) - BigInt(receipt.refundedKobo) < credit
    )
      throw serviceOperationConflict(
        requireWholeBalance
          ? "Review the saved historical credit before vehicle collection"
          : "The saved materials credit needs financial review before proceeding",
      );
  }
  if (
    requireWholeBalance &&
    payments.some((p) =>
      ["REQUIRES_PAYMENT", "PROCESSING", "REQUIRES_REVIEW"].includes(p.status),
    )
  )
    throw serviceOperationConflict(
      "Resolve pending payment requests before vehicle collection",
    );
  const paid = serviceStagePaid(agreement.plan, invoicePayments);
  if (paid.MATERIALS !== BigInt(agreement.plan.materials.totalKobo))
    throw serviceOperationConflict(
      requireWholeBalance
        ? "The agreed materials balance must be verified before vehicle collection"
        : "The agreed materials payment must be verified before starting work that uses those materials",
    );
  if (
    requireWholeBalance &&
    paid.WORKMANSHIP !== BigInt(agreement.plan.workmanship.totalKobo)
  )
    throw serviceOperationConflict(
      "The agreed workmanship balance must be verified before vehicle collection",
    );
}

/** Check each separately billed materials obligation without reusing an original payment. */
export async function assertAgreedMaterialsReady(
  tx: Prisma.TransactionClient,
  agreement: Agreement & { obligations?: Agreement[] },
  work: readonly PricedLine[],
) {
  if (!agreement.obligations)
    return assertSingleAgreementMaterialsReady(tx, agreement, work);
  // Allocate identical rows in agreement order, original first. A paid original
  // quantity cannot cover an unpaid additional quantity with the same identity.
  const remaining = new Map<string, number>();
  for (const line of work)
    remaining.set(key(line), (remaining.get(key(line)) ?? 0) + line.quantity);
  for (const obligation of agreement.obligations) {
    const used: PricedLine[] = [];
    for (const line of obligation.lines) {
      const quantity = Math.min(line.quantity, remaining.get(key(line)) ?? 0);
      if (quantity) {
        used.push({
          ...line,
          quantity,
          subtotalKobo: line.unitPriceKobo * BigInt(quantity),
        });
        remaining.set(key(line), remaining.get(key(line))! - quantity);
      }
    }
    await assertSingleAgreementMaterialsReady(tx, obligation, used);
  }
}

/** Shared by direct booking transitions, legacy work orders and managed jobs. */
export async function assertAgreedWorkCanProceed(
  tx: Prisma.TransactionClient,
  bookingId: string,
  complete = false,
) {
  const agreement = await agreedServiceWork(tx, bookingId);
  if (!agreement) return;
  const work = await tx.workOrder.findUnique({
    where: { bookingId },
    include: { items: true },
  });
  if (!work || work.status === "CANCELLED")
    throw serviceOperationConflict(
      "Prepare the agreed work order before starting or completing this job",
    );
  if (complete && agreement.pendingAdditions)
    throw serviceOperationConflict(
      "Prepare and issue the agreed additional-work invoices before completing this job",
    );
  assertAgreedWorkScope(agreement.lines, work.items, complete);
  await assertAgreedMaterialsReady(tx, agreement, work.items);
}

/** Caller holds Booking. This is a financial/operational check, never a payment or release. */
export async function serviceVehicleReleaseProof(
  tx: Prisma.TransactionClient,
  bookingId: string,
) {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: {
      status: true,
      completedAt: true,
      workOrder: { select: { status: true, completedAt: true, items: true } },
    },
  });
  if (
    booking.status !== "COMPLETED" ||
    !booking.completedAt ||
    booking.workOrder?.status !== "COMPLETED" ||
    !booking.workOrder.completedAt
  )
    throw serviceOperationConflict(
      "Record actual completion before reviewing vehicle collection",
    );
  const agreement = await agreedServiceWork(tx, bookingId);
  if (!agreement || agreement.pendingAdditions)
    throw serviceOperationConflict(
      "Review every agreed service invoice before vehicle collection; historical invoices need authorised financial review",
    );
  assertAgreedWorkScope(agreement.lines, booking.workOrder.items, true);
  for (const obligation of agreement.obligations) {
    if (!["ISSUED", "PAID"].includes(obligation.invoice.status))
      throw serviceOperationConflict(
        "Issue and settle every agreed service invoice before vehicle collection",
      );
    await assertSingleAgreementMaterialsReady(tx, obligation, obligation.lines, true);
  }
  return {
    kind: "CLEARED_SERVICE_INVOICES_V1",
    invoices: agreement.obligations.map(({ invoice, plan }) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      version: invoice.version,
      totalKobo: invoice.totalKobo.toString(),
      depositCreditKobo: invoice.depositCreditKobo.toString(),
      materialsKobo: plan.materials.totalKobo,
      workmanshipKobo: plan.workmanship.totalKobo,
    })),
  };
}
