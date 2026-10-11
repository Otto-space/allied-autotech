import { z } from "zod";
const date = z.iso.datetime({ offset: true });
const amount = z.string().regex(/^\d+$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
const booking = z.object({
  id: z.uuid(),
  serviceName: z.string(),
  status: z.enum(["REQUESTED", "CONFIRMED", "IN_PROGRESS"]),
  scheduledAt: date,
  requestedAt: date,
  confirmedAt: date.nullable(),
  startedAt: date.nullable(),
});
export const customerCareSchema = z.object({
  vehicle: z
    .object({
      id: z.uuid(),
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
      registrationNumber: z.string().nullable(),
    })
    .nullable(),
  vehicleSource: z.enum(["BOOKING", "RECENT", "NONE"]),
  currentBooking: booking.nullable(),
  nextBooking: booking.nullable(),
  quote: z
    .object({
      id: z.uuid(),
      bookingId: z.uuid(),
      quoteNumber: z.string(),
      currency,
      totalKobo: amount,
      issuedAt: date,
      expiresAt: date.nullable(),
    })
    .nullable(),
  payment: z
    .object({
      id: z.uuid(),
      paymentNumber: z.string(),
      currency,
      amountKobo: amount,
      status: z.enum(["REQUIRES_PAYMENT", "PROCESSING", "REQUIRES_REVIEW"]),
      expiresAt: date.nullable(),
    })
    .nullable(),
  order: z
    .object({
      id: z.uuid(),
      orderNumber: z.string(),
      status: z.enum([
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "READY",
        "COMPLETED",
        "CANCELLED",
      ]),
      fulfillmentMethod: z.enum(["COLLECTION", "DELIVERY"]),
      createdAt: date,
    })
    .nullable(),
  inspection: z
    .object({
      id: z.uuid(),
      title: z.string(),
      status: z.enum(["REQUESTED", "CONFIRMED", "RESCHEDULED"]),
      dateKind: z.enum(["SCHEDULED", "PREFERRED"]),
      startsAt: date,
    })
    .nullable(),
  notification: z
    .object({ id: z.uuid(), title: z.string(), createdAt: date, readAt: date.nullable() })
    .nullable(),
});

export type CustomerCare = z.infer<typeof customerCareSchema>;
