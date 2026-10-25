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
const vehicleEnquiryFields = {
  vehicleEnquiryIntent: z.enum(["LISTING", "REQUIREMENTS"]).optional(),
  vehicleListingId: uuid.optional(),
};
function validateVehicleTarget(
  value: {
    vehicleEnquiryIntent?: "LISTING" | "REQUIREMENTS" | undefined;
    vehicleListingId?: string | undefined;
  },
  context: z.RefinementCtx,
) {
  const requirements = value.vehicleEnquiryIntent === "REQUIREMENTS";
  if (requirements ? value.vehicleListingId !== undefined : !value.vehicleListingId)
    context.addIssue({
      code: "custom",
      path: ["vehicleListingId"],
      message: requirements
        ? "A requirements enquiry must not reference a listing"
        : "Select a published listing or choose requirements intent",
    });
}
export const publicEnquiryCreateBodySchema = z.discriminatedUnion("type", [
  z.object({ ...publicEnquiryFields, type: z.literal("GENERAL") }).strict(),
  z
    .object({
      ...publicEnquiryFields,
      type: z.literal("PRODUCT"),
      productId: uuid.optional(),
    })
    .strict(),
  z
    .object({ ...publicEnquiryFields, type: z.literal("SERVICE"), serviceId: uuid })
    .strict(),
  z
    .object({
      ...publicEnquiryFields,
      type: z.literal("VEHICLE"),
      ...vehicleEnquiryFields,
    })
    .strict()
    .superRefine(validateVehicleTarget),
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
      ...vehicleEnquiryFields,
    })
    .strict()
    .superRefine(validateVehicleTarget),
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
      [value.bookingId, value.orderId, value.vehicleTransactionId].filter(Boolean)
        .length <= 1,
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
      targetType: z.literal("PRODUCT"),
      productId: uuid,
      orderItemId: uuid,
    })
    .strict(),
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

export const reviewRequestKeySchema = z
  .string()
  .regex(
    /^review-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
export const reviewRequestHeadersSchema = z.object({
  "idempotency-key": reviewRequestKeySchema,
});

const page = {
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
} as const;

export const reviewSourceListQuerySchema = z
  .object({
    ...page,
    targetType: z.enum(["PRODUCT", "SERVICE", "ORDER", "VEHICLE_TRANSACTION"]),
    sourceId: uuid.optional(),
  })
  .strict()
  .refine((value) => !value.sourceId || !value.cursor, {
    message: "sourceId and cursor cannot be combined",
  });
const sourceFields = { id: uuid, label: z.string() };
export const reviewSourceSchema = z.discriminatedUnion("targetType", [
  z.object({
    ...sourceFields,
    targetType: z.literal("PRODUCT"),
    productId: uuid,
    orderItemId: uuid,
  }),
  z.object({
    ...sourceFields,
    targetType: z.literal("SERVICE"),
    serviceId: uuid,
    bookingId: uuid,
  }),
  z.object({ ...sourceFields, targetType: z.literal("ORDER"), orderId: uuid }),
  z.object({
    ...sourceFields,
    targetType: z.literal("VEHICLE_TRANSACTION"),
    vehicleTransactionId: uuid,
  }),
]);
export const reviewSourcePageSchema = z.object({
  items: z.array(reviewSourceSchema),
  nextCursor: uuid.optional(),
});
export type ReviewSourceListQuery = z.infer<typeof reviewSourceListQuerySchema>;
export type ReviewSource = z.infer<typeof reviewSourceSchema>;

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
      .enum(["BUSINESS", "PRODUCT", "SERVICE", "ORDER", "VEHICLE_TRANSACTION"])
      .optional(),
    productId: uuid.optional(),
    serviceId: uuid.optional(),
  })
  .strict()
  .refine(
    (value) => value.productId === undefined || value.targetType === "PRODUCT",
    "productId requires targetType PRODUCT",
  )
  .refine(
    (value) => value.serviceId === undefined || value.targetType === "SERVICE",
    "serviceId requires targetType SERVICE",
  );
export const customerReviewListQuerySchema = z
  .object({
    ...page,
    reviewId: uuid.optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  })
  .strict();
export const staffEnquiryListQuerySchema = z
  .object({
    ...page,
    q: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .refine(
        (value) =>
          [...value].every((c) => {
            const code = c.codePointAt(0) ?? 0;
            return code >= 32 && code !== 127;
          }),
        "Use plain search text without control characters",
      )
      .optional(),
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
    q: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .refine(
        (value) =>
          [...value].every((c) => {
            const code = c.codePointAt(0) ?? 0;
            return code >= 32 && code !== 127;
          }),
        "Use plain search text without control characters",
      )
      .optional(),
    branchId: uuid.optional(),
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    assignedStaffId: uuid.optional(),
  })
  .strict();
export const staffReviewListQuerySchema = z
  .object({
    ...page,
    reviewId: uuid.optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
    targetType: z
      .enum(["BUSINESS", "PRODUCT", "SERVICE", "ORDER", "VEHICLE_TRANSACTION"])
      .optional(),
  })
  .strict();

export const supportMessageListQuerySchema = z
  .object({
    messageId: uuid.optional(),
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
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
export type SupportMessageListQuery = z.infer<typeof supportMessageListQuerySchema>;

export const supportCreationKeySchema = z
  .string()
  .regex(
    /^support-create-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
export const supportCreationHeadersSchema = z.object({
  "idempotency-key": supportCreationKeySchema,
});

export const supportReplyKeySchema = z
  .string()
  .regex(
    /^support-reply-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
export const supportReplyHeadersSchema = z.object({
  "idempotency-key": supportReplyKeySchema,
});
