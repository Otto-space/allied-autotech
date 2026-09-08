import { z } from "zod";

const text = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) =>
        [...value].every((character) => {
          const point = character.codePointAt(0) ?? 0;
          return point === 10 || point === 13 || point === 9 || point > 31;
        }),
      "Contains invalid control characters",
    );
const uuid = z.uuid();
const optionalBranch = { branchId: uuid.optional() } as const;
const subject = text(160);
const message = text(4_000);
const name = text(120);
const phone = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^\+?[0-9][0-9 ()-]*$/, "Enter a valid phone number")
  .optional();

const publicEnquiryFields = {
  ...optionalBranch,
  subject,
  message,
  name,
  email: z.email().trim().toLowerCase().max(254),
  phone,
} as const;
export const publicEnquiryCreateBodySchema = z.discriminatedUnion("type", [
  z.object({ ...publicEnquiryFields, type: z.literal("GENERAL") }).strict(),
  z
    .object({ ...publicEnquiryFields, type: z.literal("PRODUCT"), productId: uuid })
    .strict(),
  z
    .object({ ...publicEnquiryFields, type: z.literal("SERVICE"), serviceId: uuid })
    .strict(),
  z
    .object({
      ...publicEnquiryFields,
      type: z.literal("VEHICLE"),
      vehicleListingId: uuid,
    })
    .strict(),
]);

const customerEnquiryFields = { ...optionalBranch, subject, message } as const;
export const customerEnquiryCreateBodySchema = z.discriminatedUnion("type", [
  z.object({ ...customerEnquiryFields, type: z.literal("GENERAL") }).strict(),
  z
    .object({ ...customerEnquiryFields, type: z.literal("PRODUCT"), productId: uuid })
    .strict(),
  z
    .object({ ...customerEnquiryFields, type: z.literal("SERVICE"), serviceId: uuid })
    .strict(),
  z
    .object({
      ...customerEnquiryFields,
      type: z.literal("VEHICLE"),
      vehicleListingId: uuid,
    })
    .strict(),
  z
    .object({ ...customerEnquiryFields, type: z.literal("BOOKING"), bookingId: uuid })
    .strict(),
  z
    .object({ ...customerEnquiryFields, type: z.literal("QUOTATION"), quoteId: uuid })
    .strict(),
]);

export const publicComplaintCreateBodySchema = z
  .object({
    ...optionalBranch,
    subject,
    description: message,
    name,
    email: z.email().trim().toLowerCase().max(254),
    phone,
  })
  .strict();

export const customerComplaintCreateBodySchema = z
  .object({
    ...optionalBranch,
    subject,
    description: message,
    bookingId: uuid.optional(),
    orderId: uuid.optional(),
    vehicleTransactionId: uuid.optional(),
  })
  .strict()
  .refine(
    (value) =>
      [value.bookingId, value.orderId, value.vehicleTransactionId].filter(Boolean).length <= 1,
    "Choose at most one related transaction",
  );

const reviewContent = {
  rating: z.coerce.number().int().min(1).max(5),
  title: text(120).optional(),
  comment: text(2_000),
} as const;

export const reviewCreateBodySchema = z.discriminatedUnion("targetType", [
  z.object({ ...reviewContent, targetType: z.literal("BUSINESS") }).strict(),
  z
    .object({
      ...reviewContent,
      targetType: z.literal("SERVICE"),
      serviceId: uuid,
      bookingId: uuid,
    })
    .strict(),
  z.object({ ...reviewContent, targetType: z.literal("ORDER"), orderId: uuid }).strict(),
  z
    .object({
      ...reviewContent,
      targetType: z.literal("VEHICLE_TRANSACTION"),
      vehicleTransactionId: uuid,
    })
    .strict(),
]);

const page = {
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
} as const;

export const supportIdParamsSchema = z.object({ supportId: uuid }).strict();
export const reviewIdParamsSchema = z.object({ reviewId: uuid }).strict();
export const supportEmptyQuerySchema = z.object({}).strict().default({});
export const supportEmptyBodySchema = z.object({}).strict().default({});
export const customerEnquiryListQuerySchema = z
  .object({
    ...page,
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  })
  .strict();
export const customerComplaintListQuerySchema = z
  .object({
    ...page,
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]).optional(),
  })
  .strict();
export const publicReviewListQuerySchema = z
  .object({
    ...page,
    targetType: z
      .enum(["BUSINESS", "SERVICE", "ORDER", "VEHICLE_TRANSACTION"])
      .optional(),
    serviceId: uuid.optional(),
  })
  .strict()
  .refine(
    (value) => value.serviceId === undefined || value.targetType === "SERVICE",
    "serviceId requires targetType SERVICE",
  );
export const customerReviewListQuerySchema = z
  .object({
    ...page,
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  })
  .strict();
export const staffEnquiryListQuerySchema = z
  .object({
    ...page,
    branchId: uuid.optional(),
    type: z
      .enum(["GENERAL", "PRODUCT", "VEHICLE", "SERVICE", "BOOKING", "QUOTATION"])
      .optional(),
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
    assignedStaffId: uuid.optional(),
  })
  .strict();
export const staffComplaintListQuerySchema = z
  .object({
    ...page,
    branchId: uuid.optional(),
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assignedStaffId: uuid.optional(),
  })
  .strict();
export const staffReviewListQuerySchema = z
  .object({
    ...page,
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
    targetType: z
      .enum(["BUSINESS", "SERVICE", "ORDER", "VEHICLE_TRANSACTION"])
      .optional(),
  })
  .strict();

export const assignmentBodySchema = z
  .object({
    expectedVersion: z.coerce.number().int().nonnegative(),
    assignedStaffId: uuid.nullable(),
  })
  .strict();
export const enquiryTransitionBodySchema = z
  .object({
    expectedVersion: z.coerce.number().int().nonnegative(),
    status: z.enum(["IN_PROGRESS", "RESOLVED", "CLOSED"]),
    response: message.optional(),
  })
  .strict()
  .refine((value) => value.status !== "RESOLVED" || value.response !== undefined, {
    message: "A customer-visible response is required to resolve an enquiry",
    path: ["response"],
  });
export const complaintTransitionBodySchema = z
  .object({
    expectedVersion: z.coerce.number().int().nonnegative(),
    status: z.enum(["INVESTIGATING", "RESOLVED", "CLOSED"]),
    resolution: message.optional(),
  })
  .strict()
  .refine((value) => value.status !== "RESOLVED" || value.resolution !== undefined, {
    message: "A resolution is required to resolve a complaint",
    path: ["resolution"],
  });
export const complaintPriorityBodySchema = z
  .object({
    expectedVersion: z.coerce.number().int().nonnegative(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  })
  .strict();
export const supportMessageBodySchema = z.object({ message }).strict();
export const staffSupportMessageBodySchema = z
  .object({ message, visibility: z.enum(["CUSTOMER", "INTERNAL"]).default("CUSTOMER") })
  .strict();
export const reviewModerationBodySchema = z
  .object({
    expectedVersion: z.coerce.number().int().nonnegative(),
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: text(1_000).optional(),
  })
  .strict()
  .refine((value) => value.decision !== "REJECTED" || value.note !== undefined, {
    message: "A moderation reason is required when rejecting a review",
    path: ["note"],
  });

export type PublicEnquiryInput = z.infer<typeof publicEnquiryCreateBodySchema>;
export type CustomerEnquiryInput = z.infer<typeof customerEnquiryCreateBodySchema>;
export type PublicComplaintInput = z.infer<typeof publicComplaintCreateBodySchema>;
export type CustomerComplaintInput = z.infer<typeof customerComplaintCreateBodySchema>;
export type ReviewCreateInput = z.infer<typeof reviewCreateBodySchema>;
export type CustomerSupportListQuery =
  | z.infer<typeof customerEnquiryListQuerySchema>
  | z.infer<typeof customerComplaintListQuerySchema>;
export type PublicReviewListQuery = z.infer<typeof publicReviewListQuerySchema>;
export type CustomerReviewListQuery = z.infer<typeof customerReviewListQuerySchema>;
export type StaffEnquiryListQuery = z.infer<typeof staffEnquiryListQuerySchema>;
export type StaffComplaintListQuery = z.infer<typeof staffComplaintListQuerySchema>;
export type StaffReviewListQuery = z.infer<typeof staffReviewListQuerySchema>;
export type AssignmentInput = z.infer<typeof assignmentBodySchema>;
export type EnquiryTransitionInput = z.infer<typeof enquiryTransitionBodySchema>;
export type ComplaintTransitionInput = z.infer<typeof complaintTransitionBodySchema>;
export type ComplaintPriorityInput = z.infer<typeof complaintPriorityBodySchema>;
export type SupportMessageInput = z.infer<typeof supportMessageBodySchema>;
export type StaffSupportMessageInput = z.infer<typeof staffSupportMessageBodySchema>;
export type ReviewModerationInput = z.infer<typeof reviewModerationBodySchema>;
