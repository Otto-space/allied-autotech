import { bookingTimingSnapshotSchema } from "./booking-timing-schemas";
import { z } from "zod";
import { bookingSchema, quoteSchema, slotSchema } from "./booking-schemas";
import { branchRef, money } from "./commerce-schemas";
import { serviceSchema } from "./public-schemas";
export const staffRef = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
});
export const serviceLineSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["PART", "LABOUR", "FEE"]),
  productId: z.string().uuid().nullable(),
  description: z.string(),
  quantity: z.number().int(),
  unitPriceKobo: money,
  subtotalKobo: money,
});
export const staffQuoteSchema = quoteSchema.safeExtend({
  items: z.array(serviceLineSchema),
});
export const workOrderSchema = z.object({
  id: z.string().uuid(),
  workOrderNumber: z.string(),
  status: z.enum([
    "DRAFT",
    "APPROVED",
    "IN_PROGRESS",
    "AWAITING_PARTS",
    "QUALITY_CHECK",
    "COMPLETED",
    "CANCELLED",
  ]),
  version: z.number().int(),
  diagnosis: z.string().nullable(),
  internalNotes: z.string().nullable(),
  items: z.array(serviceLineSchema),
});
export const staffBookingSchema = bookingSchema.omit({ depositPayment: true }).extend({
  timingSnapshots: z.array(bookingTimingSnapshotSchema).max(10).optional(),
  customerId: z.string().uuid(),
  bookingSlotId: z.string().uuid().nullable(),
  customerNotes: z.string().nullable(),
  staffNotes: z.string().nullable(),
  assignedStaff: staffRef.nullable(),
  vehicle: z
    .object({
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
      registrationNumber: z.string().nullable(),
    })
    .nullable(),
  quotes: z.array(staffQuoteSchema),
  workOrder: workOrderSchema.nullable(),
});
export type StaffBooking = z.infer<typeof staffBookingSchema>;
export const parseStaffBooking = (value: unknown) => staffBookingSchema.parse(value);
export const parseStaffBookings = (value: unknown) =>
  z
    .object({ items: z.array(staffBookingSchema), nextCursor: z.string().optional() })
    .parse(value);
export const staffSlotSchema = slotSchema.extend({
  timingReviewRequired: z.boolean().optional(),
  status: z.enum(["OPEN", "CLOSED"]),
  staff: staffRef,
  branch: branchRef,
  service: serviceSchema.extend({
    preparationMinutes: z.number().int().min(0).max(1440).nullable().optional(),
    cleanupMinutes: z.number().int().min(0).max(1440).nullable().optional(),
  }),
});
export const parseStaffSlots = (value: unknown) =>
  z
    .object({ items: z.array(staffSlotSchema), nextCursor: z.string().optional() })
    .parse(value);
export const staffProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: z.string(),
  status: z.string(),
  staffProfile: staffRef.extend({ branchId: z.string().uuid().nullable() }).nullable(),
});
export const parseStaffProfile = (value: unknown) => staffProfileSchema.parse(value);
export const parseStaffProfiles = (value: unknown) =>
  z
    .object({ items: z.array(staffProfileSchema), nextCursor: z.string().optional() })
    .parse(value);
