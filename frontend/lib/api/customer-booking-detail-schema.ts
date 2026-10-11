import { z } from "zod";
import { bookingSchema } from "./booking-schemas";

const recordedDate = z.iso.datetime({ offset: true }).nullable().optional();
export const customerBookingDetailSchema = bookingSchema.extend({
  bookingSlotId: z.uuid().nullable().optional(),
  requestedAt: recordedDate,
  confirmedAt: recordedDate,
  startedAt: recordedDate,
  completedAt: recordedDate,
  cancelledAt: recordedDate,
});
export type CustomerBookingDetail = z.infer<typeof customerBookingDetailSchema>;
export function parseCustomerBookingDetail(value: unknown, bookingId: string) {
  const booking = customerBookingDetailSchema.parse(value);
  if (booking.id !== bookingId) throw new Error("Booking identity did not match.");
  return booking;
}
