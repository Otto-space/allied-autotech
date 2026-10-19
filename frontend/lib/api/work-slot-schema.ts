import { z } from "zod";
import { staffSlotSchema } from "./staff-booking-schemas";
const record = staffSlotSchema
  .extend({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    version: z.number().int().nonnegative(),
  })
  .refine(
    (slot) =>
      Date.parse(slot.endsAt) > Date.parse(slot.startsAt) &&
      slot.branch.id === slot.branchId &&
      slot.service.id === slot.serviceId,
  );
export const parseWorkSlots = (value: unknown) =>
  z
    .object({
      items: z
        .array(record)
        .max(25)
        .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
      nextCursor: z.uuid().optional(),
    })
    .parse(value);
