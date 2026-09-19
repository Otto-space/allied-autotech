import { z } from "zod";
import { apiRequest } from "./client";
import { parsePayments, type PaymentRecord } from "./payment-schemas";
import type { parseVehicleTransaction } from "./vehicle-schemas";
export type CustomerVehicleSale = ReturnType<typeof parseVehicleTransaction>;
export const vehiclePaymentPurposes = {
  VEHICLE_RESERVATION: "Reservation payment",
  VEHICLE_PARTIAL_PAYMENT: "Partial payment",
  VEHICLE_BALANCE_PAYMENT: "Remaining balance",
  VEHICLE_FULL_PAYMENT: "Full payment",
} as const;
export type VehiclePaymentPurpose = keyof typeof vehiclePaymentPurposes;
export function vehiclePaymentUnavailable(record: CustomerVehicleSale, now = Date.now()) {
  if (
    ["CANCELLED", "EXPIRED", "COMPLETED", "PAID", "HANDOVER_PENDING"].includes(
      record.status,
    ) ||
    record.paidAt
  )
    return "This purchase is not open for another payment request.";
  if (record.agreedPriceKobo === null || BigInt(record.agreedPriceKobo) <= BigInt(0))
    return "An agreed price is needed before requesting a payment amount.";
  if (record.reservationExpiresAt) {
    if (!z.iso.datetime({ offset: true }).safeParse(record.reservationExpiresAt).success)
      return "The reservation deadline could not be verified. Refresh purchase progress.";
    if (Date.parse(record.reservationExpiresAt) <= now)
      return "The recorded reservation deadline has passed. Contact the team before making another payment.";
  }
  return undefined;
}
export function unresolvedVehiclePayment(payment: PaymentRecord) {
  return (
    ["REQUIRES_PAYMENT", "PROCESSING", "REQUIRES_REVIEW"].includes(payment.status) ||
    (payment.status !== "SUCCEEDED" &&
      payment.attempts.some(
        (attempt) => !["FAILED", "CANCELLED", "ABANDONED"].includes(attempt.status),
      ))
  );
}
export function allowedVehiclePurpose(
  record: CustomerVehicleSale,
  payments: PaymentRecord[],
  purpose: VehiclePaymentPurpose,
) {
  if (purpose === "VEHICLE_FULL_PAYMENT")
    return !payments.some((payment) => payment.status === "SUCCEEDED");
  if (purpose === "VEHICLE_RESERVATION" || purpose === "VEHICLE_PARTIAL_PAYMENT")
    return (
      record.reservationRequiredKobo !== null &&
      BigInt(record.reservationRequiredKobo) > BigInt(0) &&
      record.agreedPriceKobo !== null &&
      BigInt(record.reservationRequiredKobo) <= BigInt(record.agreedPriceKobo)
    );
  return true;
}
// The backend has no target filter. Never infer an empty purchase history from one page.
export async function readVehiclePayments(transactionId: string, signal: AbortSignal) {
  const matching: PaymentRecord[] = [];
  const seenCursors = new Set<string>();
  const seenIds = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const response = await apiRequest(
      `/customers/payments?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal },
    );
    const parsed = parsePayments(response.data);
    for (const payment of parsed.items) {
      if (seenIds.has(payment.id))
        throw new Error("Payment history changed while paging");
      seenIds.add(payment.id);
      if (payment.vehicleTransactionId === transactionId) matching.push(payment);
    }
    if (!parsed.nextCursor) return matching;
    if (
      !z.uuid().safeParse(parsed.nextCursor).success ||
      seenCursors.has(parsed.nextCursor)
    )
      throw new Error("Invalid payment cursor");
    seenCursors.add(parsed.nextCursor);
    cursor = parsed.nextCursor;
  }
  throw new Error("Payment history could not be fully checked");
}
