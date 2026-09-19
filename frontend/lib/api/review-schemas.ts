import { z } from "zod";
import { orderSchema } from "./commerce-schemas";
import { bookingSchema } from "./booking-schemas";
import { vehicleTransactionSchema } from "./vehicle-schemas";
export const reviewTargets = [
  "BUSINESS",
  "PRODUCT",
  "SERVICE",
  "ORDER",
  "VEHICLE_TRANSACTION",
] as const;
export type ReviewTarget = (typeof reviewTargets)[number];
export const reviewLabels: Record<ReviewTarget, string> = {
  BUSINESS: "Overall experience",
  PRODUCT: "Purchased product",
  SERVICE: "Completed service",
  ORDER: "Completed order",
  VEHICLE_TRANSACTION: "Vehicle purchase",
};
const timestamp = z.iso.datetime({ offset: true });
const named = z.object({ id: z.uuid(), name: z.string(), slug: z.string() }).nullable();
export const publicReviewSchema = z.object({
  id: z.uuid(),
  targetType: z.enum(reviewTargets),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  comment: z.string(),
  createdAt: timestamp,
  product: named,
  service: named,
});
export const reviewSchema = publicReviewSchema.extend({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  version: z.number().int().nonnegative(),
  productId: z.uuid().nullable(),
  orderItemId: z.uuid().nullable(),
  serviceId: z.uuid().nullable(),
  bookingId: z.uuid().nullable(),
  orderId: z.uuid().nullable(),
  vehicleTransactionId: z.uuid().nullable(),
  moderationNote: z.string().nullable(),
  moderatedAt: timestamp.nullable(),
  updatedAt: timestamp,
});
export type ReviewRecord = z.infer<typeof reviewSchema>;
export type PublicReview = z.infer<typeof publicReviewSchema>;
const page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.uuid().optional() });
export const parseReviews = (value: unknown) => page(reviewSchema).parse(value);
export const parsePublicReviews = (value: unknown) =>
  page(publicReviewSchema).parse(value);
export const parseStaffReviews = (value: unknown) =>
  page(
    reviewSchema.extend({
      customer: z.object({ firstName: z.string(), lastName: z.string() }),
    }),
  ).parse(value);
const content = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1, "Enter your feedback.")
    .max(maximum)
    .refine(
      (value) =>
        [...value].every(
          (c) =>
            [9, 10, 13].includes(c.codePointAt(0) ?? 0) || (c.codePointAt(0) ?? 0) > 31,
        ),
      "Remove unsupported control characters.",
    );
export const reviewFormSchema = z.object({
  rating: z
    .enum(["", "1", "2", "3", "4", "5"])
    .refine((value): boolean => value !== "", "Choose a rating."),
  title: z.union([z.literal(""), content(120)]),
  comment: content(2000),
});
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;
export const moderationFormSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().trim().max(1000),
  })
  .refine((value) => value.decision !== "REJECTED" || value.note.length > 0, {
    path: ["note"],
    message: "Explain why this review is rejected.",
  });
export type ReviewSource = {
  id: string;
  label: string;
  path: string;
  fields: Record<string, string>;
};
const order = orderSchema.pick({
  id: true,
  orderNumber: true,
  status: true,
  items: true,
});
const booking = bookingSchema.pick({
  id: true,
  status: true,
  scheduledAt: true,
  service: true,
});
const sale = vehicleTransactionSchema.pick({
  id: true,
  status: true,
  transactionNumber: true,
  vehicleListing: true,
});
export const reviewSourcePaths = {
  PRODUCT: "/customers/orders",
  ORDER: "/customers/orders",
  SERVICE: "/customers/bookings",
  VEHICLE_TRANSACTION: "/customers/vehicle-transactions",
} as const;
export function reviewSources(
  target: Exclude<ReviewTarget, "BUSINESS">,
  value: unknown,
): { items: ReviewSource[]; nextCursor?: string } {
  if (target === "SERVICE") {
    const result = page(booking).parse(value);
    return {
      ...result,
      items: result.items
        .filter((row) => row.status === "COMPLETED")
        .map((row) => ({
          id: row.id,
          label: `${row.service.name} · ${row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos" }) : row.id}`,
          path: `${reviewSourcePaths.SERVICE}/${row.id}`,
          fields: { serviceId: row.service.id, bookingId: row.id },
        })),
    };
  }
  if (target === "VEHICLE_TRANSACTION") {
    const result = page(sale).parse(value);
    return {
      ...result,
      items: result.items
        .filter((row) => row.status === "COMPLETED")
        .map((row) => ({
          id: row.id,
          label: `${row.transactionNumber} · ${row.vehicleListing.title}`,
          path: `${reviewSourcePaths.VEHICLE_TRANSACTION}/${row.id}`,
          fields: { vehicleTransactionId: row.id },
        })),
    };
  }
  const result = page(order).parse(value);
  return {
    ...result,
    items: result.items
      .filter((row) => row.status === "COMPLETED")
      .flatMap<ReviewSource>((row) =>
        target === "ORDER"
          ? [
              {
                id: row.id,
                label: row.orderNumber,
                path: `${reviewSourcePaths.ORDER}/${row.id}`,
                fields: { orderId: row.id },
              },
            ]
          : row.items.map((item) => ({
              id: item.id,
              label: `${item.productName} · ${row.orderNumber}`,
              path: `${reviewSourcePaths.PRODUCT}/${row.id}`,
              fields: { productId: item.productId, orderItemId: item.id },
            })),
      ),
  };
}
