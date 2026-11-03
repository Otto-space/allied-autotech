import { z } from "zod";
import { apiRequest } from "./client";
import { parseOrder } from "./commerce-schemas";
import { parsePayments, paymentSchema, type PaymentRecord } from "./payment-schemas";

export type CustomerOrder = ReturnType<typeof parseOrder>;

export function orderPaymentUnavailable(order: CustomerOrder, now = Date.now()) {
  if (order.paidAt) return "Payment is already recorded for this order.";
  if (order.status !== "PENDING")
    return "This order is not open for a new payment request.";
  if (BigInt(order.totalKobo) <= BigInt(0))
    return "This order does not have an amount available to pay.";
  if (order.paymentDueAt !== null) {
    if (!z.iso.datetime({ offset: true }).safeParse(order.paymentDueAt).success)
      return "The payment deadline could not be verified. Refresh the order.";
    if (Date.parse(order.paymentDueAt) <= now)
      return "The payment deadline has passed. Check existing payments or contact customer care.";
  }
  const review = order.purchaseReviews?.[0];
  if (!review || review.status !== "APPROVED" || !review.decidedAt)
    return "Final compatibility and availability review is required before payment.";
  if (
    !order.paymentDueAt ||
    !review.expiresAt ||
    Date.parse(review.expiresAt) <= now ||
    Date.parse(review.expiresAt) !== Date.parse(order.paymentDueAt)
  )
    return "The approved offer is not currently payable. Ask the team for an updated review.";
  return undefined;
}

export function orderPaymentSnapshot(order: CustomerOrder) {
  return JSON.stringify([
    order.id,
    order.version,
    order.status,
    order.totalKobo,
    order.paymentDueAt,
    order.paidAt,
    order.purchaseReviews?.[0]?.id,
    order.purchaseReviews?.[0]?.revision,
    order.purchaseReviews?.[0]?.status,
    order.purchaseReviews?.[0]?.expiresAt,
  ]);
}

export function blockingOrderPayment(payment: PaymentRecord) {
  return (
    ["REQUIRES_PAYMENT", "PROCESSING", "REQUIRES_REVIEW", "SUCCEEDED"].includes(
      payment.status,
    ) ||
    payment.attempts.some(
      (attempt) => !["FAILED", "CANCELLED", "ABANDONED"].includes(attempt.status),
    )
  );
}

export function parseOrderPayment(value: unknown, orderId: string) {
  const payment = paymentSchema.parse(value);
  if (
    payment.orderId !== orderId ||
    payment.purpose !== "ORDER_PAYMENT" ||
    payment.bookingId !== null ||
    payment.invoiceId !== null ||
    payment.vehicleTransactionId !== null ||
    BigInt(payment.amountKobo) <= BigInt(0)
  )
    throw new Error("Unexpected order payment receipt");
  return payment;
}

// No order filter exists. A partial history must never imply there is no payment.
export async function readOrderPayments(orderId: string, signal: AbortSignal) {
  const matching: PaymentRecord[] = [];
  const seenCursors = new Set<string>();
  const seenIds = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const response = await apiRequest(
      `/customers/payments?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal },
    );
    if (signal.aborted) throw new Error("Payment history check interrupted");
    const parsed = parsePayments(response.data);
    for (const payment of parsed.items) {
      if (seenIds.has(payment.id))
        throw new Error("Payment history changed while paging");
      seenIds.add(payment.id);
      if (payment.orderId === orderId) matching.push(parseOrderPayment(payment, orderId));
    }
    if (!parsed.nextCursor) return matching;
    if (
      !z.uuid().safeParse(parsed.nextCursor).success ||
      seenCursors.has(parsed.nextCursor)
    )
      throw new Error("Invalid payment history cursor");
    seenCursors.add(parsed.nextCursor);
    cursor = parsed.nextCursor;
  }
  throw new Error("Payment history could not be fully checked");
}
