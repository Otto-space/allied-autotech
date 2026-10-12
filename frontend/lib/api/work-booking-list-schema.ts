import { z } from "zod";
import { staffBookingSchema } from "./staff-booking-schemas";
import { bookingStatuses } from "../customer-booking-query";
export const workBookingListItem = staffBookingSchema
  .pick({
    id: true,
    service: true,
    branch: true,
    assignedStaff: true,
    vehicle: true,
    scheduledAt: true,
    status: true,
  })
  .extend({
    status: z.enum(bookingStatuses),
    scheduledAt: z.iso.datetime({ offset: true }).nullable(),
  });
export const parseWorkBookingList = (value: unknown) =>
  z
    .object({
      items: z
        .array(workBookingListItem)
        .max(25)
        .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
      nextCursor: z.uuid().optional(),
    })
    .parse(value);
