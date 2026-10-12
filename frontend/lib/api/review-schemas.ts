import { z } from "zod";

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
export const reviewSubmissionSchema = reviewSchema.extend({ replayed: z.boolean() });
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
const submittedContent = {
  rating: z.number().int().min(1).max(5),
  title: content(120).optional(),
  comment: content(2000),
};
export const reviewSubmissionBodySchema = z.discriminatedUnion("targetType", [
  z.object({ ...submittedContent, targetType: z.literal("BUSINESS") }).strict(),
  z
    .object({
      ...submittedContent,
      targetType: z.literal("PRODUCT"),
      productId: z.uuid(),
      orderItemId: z.uuid(),
    })
    .strict(),
  z
    .object({
      ...submittedContent,
      targetType: z.literal("SERVICE"),
      serviceId: z.uuid(),
      bookingId: z.uuid(),
    })
    .strict(),
  z
    .object({ ...submittedContent, targetType: z.literal("ORDER"), orderId: z.uuid() })
    .strict(),
  z
    .object({
      ...submittedContent,
      targetType: z.literal("VEHICLE_TRANSACTION"),
      vehicleTransactionId: z.uuid(),
    })
    .strict(),
]);
export type ReviewSubmissionBody = z.infer<typeof reviewSubmissionBodySchema>;
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
const sourceBase = { id: z.uuid(), label: z.string().min(1) };
export const reviewSourceSchema = z.discriminatedUnion("targetType", [
  z.object({
    ...sourceBase,
    targetType: z.literal("PRODUCT"),
    productId: z.uuid(),
    orderItemId: z.uuid(),
  }),
  z.object({
    ...sourceBase,
    targetType: z.literal("SERVICE"),
    serviceId: z.uuid(),
    bookingId: z.uuid(),
  }),
  z.object({ ...sourceBase, targetType: z.literal("ORDER"), orderId: z.uuid() }),
  z.object({
    ...sourceBase,
    targetType: z.literal("VEHICLE_TRANSACTION"),
    vehicleTransactionId: z.uuid(),
  }),
]);
export const reviewSourcePath = "/customers/support/review-sources";
export function reviewSources(
  target: Exclude<ReviewTarget, "BUSINESS">,
  value: unknown,
): { items: ReviewSource[]; nextCursor?: string } {
  const result = page(reviewSourceSchema).parse(value);
  return {
    ...result,
    items: result.items.map((row) => {
      if (row.targetType !== target) throw new Error("Unexpected review source type");
      let fields: Record<string, string>;
      switch (row.targetType) {
        case "PRODUCT":
          fields = { productId: row.productId, orderItemId: row.orderItemId };
          break;
        case "SERVICE":
          fields = { serviceId: row.serviceId, bookingId: row.bookingId };
          break;
        case "ORDER":
          fields = { orderId: row.orderId };
          break;
        case "VEHICLE_TRANSACTION":
          fields = { vehicleTransactionId: row.vehicleTransactionId };
          break;
      }
      const sourceId =
        row.targetType === "PRODUCT"
          ? row.orderItemId
          : row.targetType === "SERVICE"
            ? row.bookingId
            : row.targetType === "ORDER"
              ? row.orderId
              : row.vehicleTransactionId;
      if (row.id !== sourceId) throw new Error("Unexpected review source identity");
      return {
        id: row.id,
        label: row.label,
        path: `${reviewSourcePath}?targetType=${target}&sourceId=${row.id}`,
        fields,
      };
    }),
  };
}
