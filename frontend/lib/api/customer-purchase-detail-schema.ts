import { z } from "zod";
import { transactionStatuses, vehicleTransactionSchema } from "./vehicle-schemas";

const date = z.iso.datetime({ offset: true });
const schema = vehicleTransactionSchema.extend({
  transactionNumber: z.string().min(1),
  version: z.number().int().nonnegative(),
  createdAt: date,
  reservationExpiresAt: date.nullable(),
  termsAcceptedAt: date.nullable(),
  paidAt: date.nullable(),
  paidHoldStartsAt: date.nullable().optional(),
  paidHoldExpiresAt: date.nullable().optional(),
  vehicleListing: vehicleTransactionSchema.shape.vehicleListing.extend({
    title: z.string().min(1),
    vehicle: z
      .object({
        images: z.array(
          z.object({
            id: z.uuid(),
            url: z.string(),
            altText: z.string().nullable(),
            isPrimary: z.boolean(),
          }),
        ),
      })
      .optional(),
  }),
  statusHistory: z
    .array(
      z.object({
        id: z.uuid(),
        fromStatus: z.enum(transactionStatuses).nullable(),
        toStatus: z.enum(transactionStatuses),
        reason: z.string().nullable(),
        createdAt: date,
      }),
    )
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  handover: z
    .object({
      id: z.uuid(),
      status: z.enum(["PENDING", "READY", "COMPLETED", "CANCELLED"]),
      recipientName: z.string().nullable(),
      odometerKm: z.number().int().nonnegative().nullable(),
      keysDelivered: z.number().int().nonnegative(),
      readyAt: date.nullable(),
      completedAt: date.nullable(),
    })
    .nullable(),
});
export const parseCustomerPurchaseDetail = (value: unknown) => schema.parse(value);
