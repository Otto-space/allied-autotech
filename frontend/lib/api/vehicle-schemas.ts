import { z } from "zod";
import { branchRef, money } from "./commerce-schemas";
const image = z.object({
  id: z.string().uuid(),
  url: z.string(),
  altText: z.string().nullable(),
  isPrimary: z.boolean(),
});
export const listingSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  priceKobo: money,
  currency: z.literal("NGN"),
  description: z.string().nullable(),
  branch: branchRef.extend({ city: z.string(), state: z.string() }),
  vehicle: z.object({
    id: z.string().uuid(),
    make: z.string(),
    model: z.string(),
    trim: z.string().nullable(),
    year: z.number(),
    mileageKm: z.number().nullable(),
    transmission: z.string().nullable(),
    fuelType: z.string().nullable(),
    condition: z.string(),
    bodyType: z.string().nullable(),
    color: z.string().nullable(),
    images: z.array(image),
    conditionReports: z.array(
      z.object({
        id: z.string().uuid(),
        summary: z.string(),
        inspectedAt: z.string(),
        odometerKm: z.number().nullable(),
        conditionScore: z.number().nullable(),
      }),
    ),
  }),
});
export const parseListings = (value: unknown) =>
  z
    .object({ items: z.array(listingSchema), nextCursor: z.string().optional() })
    .parse(value);
export const customerVehicleSchema = z.object({
  id: z.string().uuid(),
  make: z.string(),
  model: z.string(),
  year: z.number(),
  registrationNumber: z.string().nullable(),
  vin: z.string().nullable(),
  color: z.string().nullable(),
  mileageKm: z.number().nullable(),
});
export type CustomerVehicle = z.infer<typeof customerVehicleSchema>;
export const parseCustomerVehicles = (value: unknown) =>
  z
    .object({ items: z.array(customerVehicleSchema), nextCursor: z.string().optional() })
    .parse(value);
export const inspectionSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  preferredStartAt: z.string(),
  scheduledStartAt: z.string().nullable(),
  scheduledEndAt: z.string().nullable(),
  notes: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  conditionReport: z
    .object({
      summary: z.string(),
      inspectedAt: z.string(),
      odometerKm: z.number().int().nullable(),
    })
    .nullable(),
  vehicleListing: z.object({ id: z.string().uuid(), title: z.string() }),
});
export const parseInspections = (value: unknown) =>
  z
    .object({ items: z.array(inspectionSchema), nextCursor: z.string().optional() })
    .parse(value);
export const transactionStatuses = [
  "ENQUIRY",
  "INSPECTION_SCHEDULED",
  "INSPECTION_COMPLETED",
  "NEGOTIATING",
  "PAYMENT_PENDING",
  "RESERVED",
  "PARTIALLY_PAID",
  "PAID",
  "HANDOVER_PENDING",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;
export const vehicleTransactionSchema = z.object({
  id: z.string().uuid(),
  transactionNumber: z.string(),
  status: z.enum(transactionStatuses),
  version: z.number().int(),
  askingPriceKobo: money,
  agreedPriceKobo: money.nullable(),
  reservationRequiredKobo: money.nullable(),
  currency: z.literal("NGN"),
  reservationExpiresAt: z.string().nullable(),
  termsVersion: z.string().nullable(),
  termsAcceptedAt: z.string().nullable(),
  paidAt: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  createdAt: z.string(),
  vehicleListing: z.object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.string(),
  }),
  statusHistory: z.array(
    z.object({
      id: z.string().uuid(),
      fromStatus: z.string().nullable(),
      toStatus: z.string(),
      reason: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  handover: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      recipientName: z.string().nullable(),
      odometerKm: z.number().int().nullable(),
      keysDelivered: z.number().int(),
      readyAt: z.string().nullable(),
      completedAt: z.string().nullable(),
    })
    .nullable(),
});
export const parseVehicleTransaction = (value: unknown) =>
  vehicleTransactionSchema.parse(value);
export const parseVehicleTransactions = (value: unknown) =>
  z
    .object({
      items: z.array(vehicleTransactionSchema),
      nextCursor: z.string().optional(),
    })
    .parse(value);
