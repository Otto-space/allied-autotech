import { z } from "zod";
import { orderSchema } from "../api/commerce-schemas";
import { paymentSchema } from "../api/payment-schemas";
export const guestOrderSchema = orderSchema.extend({
  paymentId: z.uuid().nullable().optional(),
  confirmedAt: z.iso.datetime({ offset: true }).nullable(),
  fulfillmentEvidenceAt: z.iso.datetime({ offset: true }).nullable(),
  fulfillmentEvidenceReference: z.string().nullable(),
});
export type GuestOrder = z.infer<typeof guestOrderSchema>;
export const parseGuestOrder = (value: unknown) => guestOrderSchema.parse(value);
export const parseGuestOrders = (value: unknown) =>
  z
    .object({ items: z.array(guestOrderSchema), nextCursor: z.uuid().optional() })
    .parse(value);
export const guestPaymentSchema = paymentSchema
  .extend({
    attempts: z.array(
      paymentSchema.shape.attempts.element.extend({
        attemptNumber: z.number().int().positive(),
      }),
    ),
  })
  .refine(
    (payment) =>
      payment.orderId !== null &&
      payment.bookingId === null &&
      payment.vehicleTransactionId === null &&
      payment.purpose === "ORDER_PAYMENT",
  );
export const parseGuestPayment = (value: unknown) => guestPaymentSchema.parse(value);
export type GuestPayment = z.infer<typeof guestPaymentSchema>;
// These are retry keys, never authentication. One logical intent per order and
// one initialization per server attempt number can be recovered in another tab.
export const guestIntentKey = (orderId: string) => `purchase-intent:${orderId}`;
export const guestCheckoutKey = (
  paymentId: string,
  provider: "PAYSTACK" | "MONNIFY",
  attemptNumber: number,
) => `purchase-checkout:${paymentId}:${provider}:${attemptNumber}`;
