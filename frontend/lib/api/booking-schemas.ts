import { z } from "zod";
import { serviceSchema } from "./public-schemas";
import { branchRef, money } from "./commerce-schemas";
export const bookingPolicySchema = z.object({
  version: z.string(),
  minimumAdvanceHours: z.number(),
  maximumAdvanceHours: z.number(),
  paymentHoldMinutes: z.number(),
  depositBasisPoints: z.number().int(),
  depositRefundableForCustomerCancellation: z.boolean(),
  customerRescheduleLimit: z.number(),
  customerRescheduleCutoffHours: z.number(),
  reminderHoursBeforeAppointment: z.array(z.number()),
});
export const parseBookingPolicy = (value: unknown) => bookingPolicySchema.parse(value);
export const slotSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startsAt: z.string(),
  endsAt: z.string(),
  version: z.number(),
});
export const parseSlots = (value: unknown) =>
  z
    .object({ items: z.array(slotSchema), nextCursor: z.string().optional() })
    .parse(value);
export const quoteSchema = z.object({
  id: z.string().uuid(),
  quoteNumber: z.string(),
  version: z.number(),
  revision: z.number(),
  status: z.string(),
  totalKobo: money,
  subtotalKobo: money,
  taxKobo: money,
  expiresAt: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      description: z.string(),
      quantity: z.number(),
      unitPriceKobo: money,
      subtotalKobo: money,
    }),
  ),
});
export const bookingSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  version: z.number().int(),
  scheduledAt: z.string().nullable(),
  service: serviceSchema,
  branch: branchRef.nullable(),
  depositAmountKobo: money.nullable(),
  depositPaidAt: z.string().nullable(),
  paymentHoldExpiresAt: z.string().nullable(),
  customerRescheduleCount: z.number(),
  disruptionRequestedAt: z.string().nullable(),
  disruptionReason: z.string().nullable(),
  disruptionResolution: z.string().nullable(),
  depositPayment: z
    .object({ id: z.string().uuid(), status: z.string(), amountKobo: money })
    .nullable(),
  quotes: z.array(quoteSchema),
  workOrder: z
    .object({
      workOrderNumber: z.string(),
      status: z.string(),
      diagnosis: z.string().nullable(),
    })
    .nullable(),
});
export const parseBooking = (value: unknown) => bookingSchema.parse(value);
export const parseBookings = (value: unknown) =>
  z
    .object({ items: z.array(bookingSchema), nextCursor: z.string().optional() })
    .parse(value);
