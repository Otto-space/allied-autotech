import { z } from "zod";
import { trustedCheckoutUrl } from "./client";
import type { PaymentRecord } from "./payment-schemas";
export type CheckoutProvider = "PAYSTACK" | "MONNIFY";
export function paymentDeadlineUnavailable(payment: PaymentRecord, now = Date.now()) {
  if (payment.expiresAt === null) return undefined;
  if (!z.iso.datetime({ offset: true }).safeParse(payment.expiresAt).success)
    return "The payment deadline could not be verified. Refresh its status before continuing.";
  if (Date.parse(payment.expiresAt) <= now)
    return "The payment deadline has passed. Refresh its status and contact customer care if you already paid.";
  return undefined;
}
export function hasPendingPaymentAttempt(payment: PaymentRecord) {
  return payment.attempts.some(
    (attempt) => !["FAILED", "CANCELLED", "ABANDONED"].includes(attempt.status),
  );
}
export function newPaymentAttemptUnavailable(payment: PaymentRecord, now = Date.now()) {
  if (payment.status !== "REQUIRES_PAYMENT")
    return "Check the current payment status before making another payment.";
  if (payment.bookingId)
    return "Booking deposits are not available. Review your booking or contact customer care.";
  if (BigInt(payment.amountKobo) <= BigInt(0))
    return "This request does not have an amount available to pay.";
  return (
    paymentDeadlineUnavailable(payment, now) ??
    (hasPendingPaymentAttempt(payment)
      ? "An existing payment attempt is awaiting confirmation. Check its status before paying again."
      : undefined)
  );
}
export function paymentIdentity(payment: PaymentRecord) {
  return JSON.stringify([
    payment.id,
    payment.amountKobo,
    payment.currency,
    payment.purpose,
    payment.orderId,
    payment.invoiceId,
    payment.bookingId,
    payment.vehicleTransactionId,
  ]);
}
export function validatedCheckout(
  value: unknown,
  provider: CheckoutProvider,
  now = Date.now(),
) {
  const checkout = z
    .object({
      attemptId: z.uuid(),
      authorizationUrl: z.url(),
      authorizationExpiresAt: z.iso.datetime({ offset: true }),
    })
    .parse(value);
  if (Date.parse(checkout.authorizationExpiresAt) <= now)
    throw new Error("Checkout authorization expired");
  const url = trustedCheckoutUrl(checkout.authorizationUrl);
  const host = new URL(url).hostname;
  const permitted =
    provider === "PAYSTACK"
      ? ["checkout.paystack.com", "standard.paystack.co"]
      : ["sdk.monnify.com", "sandbox.sdk.monnify.com"];
  if (!permitted.includes(host)) throw new Error("Checkout provider does not match");
  return { ...checkout, authorizationUrl: url };
}
