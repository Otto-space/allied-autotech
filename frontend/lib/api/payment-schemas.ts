import { z } from "zod";
import { money } from "./commerce-schemas";
export const paymentSchema = z.object({
  id: z.string().uuid(),
  paymentNumber: z.string(),
  amountKobo: money,
  currency: z.literal("NGN"),
  status: z.enum([
    "REQUIRES_PAYMENT",
    "PROCESSING",
    "REQUIRES_REVIEW",
    "SUCCEEDED",
    "CANCELLED",
    "EXPIRED",
  ]),
  purpose: z.string(),
  expiresAt: z.string().nullable(),
  orderId: z.string().uuid().nullable(),
  invoiceId: z.string().uuid().nullable(),
  bookingId: z.string().uuid().nullable(),
  vehicleTransactionId: z.string().uuid().nullable(),
  attempts: z.array(
    z.object({
      id: z.string().uuid(),
      provider: z.enum(["PAYSTACK", "MONNIFY", "MANUAL"]),
      status: z.string(),
      verificationStatus: z.string(),
      initiatedAt: z.string(),
      paidAt: z.string().nullable(),
    }),
  ),
});
export type PaymentRecord = z.infer<typeof paymentSchema>;
export const parsePayment = (value: unknown) => paymentSchema.parse(value);
export const parsePayments = (value: unknown) =>
  z
    .object({ items: z.array(paymentSchema), nextCursor: z.string().optional() })
    .parse(value);
export const paymentMessages: Record<PaymentRecord["status"], string> = {
  REQUIRES_PAYMENT:
    "Payment has not been confirmed. Check any existing payment attempt before starting another.",
  PROCESSING:
    "Your payment is being processed. Please check its status before paying again.",
  REQUIRES_REVIEW:
    "Your payment needs review. Contact customer care if you need assistance; do not pay again while confirmation is pending.",
  SUCCEEDED:
    "Payment is confirmed. Review the linked order, booking or reservation for its current fulfilment status.",
  CANCELLED:
    "This payment request was cancelled. If money left your account, contact customer care before making another payment.",
  EXPIRED:
    "This payment request expired. If you already paid, contact customer care before making another payment.",
};
