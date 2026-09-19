import { z } from "zod";
import { vehicleTransactionSchema } from "./vehicle-schemas";
export const staffVehicleSaleSchema = vehicleTransactionSchema.extend({
  customerId: z.string().uuid().nullable(),
  customerName: z.string(),
  handover: vehicleTransactionSchema.shape.handover
    .unwrap()
    .extend({
      status: z.enum(["PENDING", "READY", "COMPLETED", "CANCELLED"]),
      version: z.number().int().nonnegative(),
      recipientPhone: z.string().nullable(),
      cancelledAt: z.string().nullable(),
    })
    .nullable(),
  vehicleListing: vehicleTransactionSchema.shape.vehicleListing.extend({
    branchId: z.string().uuid(),
    vehicle: z.object({
      id: z.string().uuid(),
      stockNumber: z.string(),
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
    }),
  }),
});
export type StaffVehicleSale = z.infer<typeof staffVehicleSaleSchema>;
export const parseStaffVehicleSale = (value: unknown) =>
  staffVehicleSaleSchema.parse(value);
export const parseStaffVehicleSales = (value: unknown) =>
  z
    .object({ items: z.array(staffVehicleSaleSchema), nextCursor: z.string().optional() })
    .parse(value);
