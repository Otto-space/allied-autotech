import { supportEmailDeliveryPageSchema } from "./customer-email.js";
import {
  extendZodWithOpenApi,
  type OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  assignmentBodySchema,
  complaintPriorityBodySchema,
  complaintTransitionBodySchema,
  customerComplaintCreateBodySchema,
  supportCreationHeadersSchema,
  supportReplyHeadersSchema,
  customerComplaintListQuerySchema,
  customerEnquiryCreateBodySchema,
  customerEnquiryListQuerySchema,
  customerReviewListQuerySchema,
  enquiryTransitionBodySchema,
  publicComplaintCreateBodySchema,
  publicEnquiryCreateBodySchema,
  publicReviewListQuerySchema,
  reviewCreateBodySchema,
  reviewRequestHeadersSchema,
  reviewSourceListQuerySchema,
  reviewSourcePageSchema,
  reviewIdParamsSchema,
  reviewModerationBodySchema,
  staffComplaintListQuerySchema,
  staffEnquiryListQuerySchema,
  staffReviewListQuerySchema,
  staffSupportMessageBodySchema,
  supportIdParamsSchema,
  supportMessageBodySchema,
  supportMessageListQuerySchema,
} from "./support.schemas.js";

extendZodWithOpenApi(z);

const response = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrf = z.object({ "x-csrf-token": z.string().min(32) });
const namedReviewTarget = z
  .object({ id: z.uuid(), name: z.string(), slug: z.string() })
  .nullable();
const publicReview = z.object({
  id: z.uuid(),
  targetType: z.enum(["BUSINESS", "PRODUCT", "SERVICE", "ORDER", "VEHICLE_TRANSACTION"]),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  comment: z.string(),
  createdAt: z.iso.datetime(),
  product: namedReviewTarget,
  service: namedReviewTarget,
  reviewer: z.object({ displayName: z.string(), photoUrl: z.string().nullable() }),
});
const reviewSubmission = z.object({
  id: z.uuid(),
  targetType: z.enum(["BUSINESS", "PRODUCT", "SERVICE", "ORDER", "VEHICLE_TRANSACTION"]),
  productId: z.uuid().nullable(),
  orderItemId: z.uuid().nullable(),
  serviceId: z.uuid().nullable(),
  bookingId: z.uuid().nullable(),
  orderId: z.uuid().nullable(),
  vehicleTransactionId: z.uuid().nullable(),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  comment: z.string(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  moderationNote: z.string().nullable(),
  moderatedAt: z.iso.datetime().nullable(),
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  product: namedReviewTarget,
  service: namedReviewTarget,
  replayed: z.boolean(),
});
const supportSubmissionBase = z.object({
  id: z.uuid(),
  branchId: z.uuid().nullable(),
  assignedStaffId: z.uuid().nullable(),
  subject: z.string(),
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  closedAt: z.iso.datetime().nullable(),
  branch: z.object({ id: z.uuid(), code: z.string(), name: z.string() }).nullable(),
  assignedStaff: z
    .object({ id: z.uuid(), firstName: z.string(), lastName: z.string() })
    .nullable(),
  replayed: z.boolean(),
});
const enquirySubmission = supportSubmissionBase.extend({
  type: z.enum(["GENERAL", "PRODUCT", "SERVICE", "VEHICLE", "BOOKING", "QUOTATION"]),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  message: z.string(),
  productId: z.uuid().nullable(),
  serviceId: z.uuid().nullable(),
  bookingId: z.uuid().nullable(),
  quoteId: z.uuid().nullable(),
  vehicleListingId: z.uuid().nullable(),
  vehicleEnquiryIntent: z.enum(["LISTING", "REQUIREMENTS"]).nullable(),
});
const complaintSubmission = supportSubmissionBase.extend({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  description: z.string(),
  resolution: z.string().nullable(),
  bookingId: z.uuid().nullable(),
  orderId: z.uuid().nullable(),
  vehicleTransactionId: z.uuid().nullable(),
  acknowledgedAt: z.iso.datetime().nullable(),
  acknowledgementDueAt: z.iso.datetime().nullable(),
  escalatedAt: z.iso.datetime().nullable(),
});
const creationDescription =
  "Requires Idempotency-Key support-create-v1.<13-digit Unix milliseconds>.<lowercase UUID v4>. Scope is authenticated customer plus enquiry/complaint creation. The normalized body is bound to the key; changed content returns 409 IDEMPOTENCY_CONFLICT. Original-key/body replay within 24 hours returns 201 with the same owned record ID, current state and replayed true, without another creation audit or repeating branch/source checks or complaint deadline assignment. New requests retain branch, source, ownership and policy validation. Keys over 24 hours old or more than one minute in the future return 409 IDEMPOTENCY_EXPIRED, including after receipt cleanup. Missing/malformed keys return 422. Receipts hold hashes and the record ID, not message/contact text. Private projections exclude contact fields and internal messages. Same-key concurrency serializes; role, CSRF and rate limits apply on every attempt. Public anonymous creation is unchanged. Deploy matching frontend/API; older customer clients must reload.";

const timelineMessage = z.object({
  id: z.uuid(),
  authorType: z.enum(["CUSTOMER", "STAFF", "SYSTEM"]),
  visibility: z.enum(["CUSTOMER", "INTERNAL"]),
  body: z.string(),
  createdAt: z.iso.datetime(),
  kind: z.enum(["LEGACY", "REPLY", "INTERNAL_NOTE", "STATUS_CHANGE"]),
  fromStatus: z.string().nullable(),
  toStatus: z.string().nullable(),
});
const timelinePage = z.object({
  items: z.array(timelineMessage),
  cursor: z.uuid().nullable(),
  hasMore: z.boolean(),
  pollAfterMs: z.number().int(),
});
const replySubmission = z.object({
  kind: z.enum(["LEGACY", "REPLY", "INTERNAL_NOTE", "STATUS_CHANGE"]),
  fromStatus: z.string().nullable(),
  toStatus: z.string().nullable(),

  id: z.uuid(),
  authorType: z.literal("CUSTOMER"),
  visibility: z.literal("CUSTOMER"),
  body: z.string(),
  createdAt: z.iso.datetime(),
  replayed: z.boolean(),
});
const replyDescription =
  "Requires Idempotency-Key support-reply-v1.<13-digit Unix milliseconds>.<lowercase UUID v4>. The normalized reply is bound to the authenticated customer, conversation kind and ID. Atomic message, audit, notification intent and receipt; original-key recovery returns 201 with the original customer-visible message and replayed true without duplicate effects. Ownership is rechecked on every attempt. Recovery is permitted after closure only for an already committed reply; new replies to closed conversations conflict. Missing or foreign/internal message receipts fail closed. Changed bodies return 409 IDEMPOTENCY_CONFLICT. Keys expire after 24 hours even after cleanup, and timestamps more than one minute ahead fail with 409 IDEMPOTENCY_EXPIRED. Missing/malformed keys return 422. Strict customer-only bodies, CSRF and rate limits remain. Matching API/frontend rollout is required; staff replies are unchanged. Provider delivery is separate from notification enqueue.";

type Route = {
  method: "get" | "post";
  path: string;
  summary: string;
  security?: boolean;
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
  mutate?: boolean;
  accepted?: boolean;
  description?: string;
  data?: ZodType;
  headers?: ZodType;
};

export function registerSupportOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/public/support/reviews/{reviewId}/photo",
    tags: ["Support"],
    summary: "Read the profile portrait for a currently approved review",
    description:
      "Returns only the current reviewer profile image for an APPROVED review. Missing, pending or rejected reviews and profiles without an attached portrait return 404. Customer contact details, profile IDs, object keys and private garage images are never exposed. Responses are private/no-store so removal, replacement and moderation are rechecked on the next request.",
    security: [],
    request: {
      params: reviewIdParamsSchema,
      query: z
        .object({
          v: z
            .number()
            .int()
            .min(0)
            .max(2147483647)
            .optional()
            .openapi({
              param: { name: "v", in: "query" },
              description:
                "Current profile media version, used to reload a replaced portrait.",
            }),
        })
        .strict(),
    },
    responses: {
      200: {
        description: "Reviewer portrait, private/no-store",
        content: { "image/webp": { schema: { type: "string", format: "binary" } } },
      },
      404: { description: "No published review portrait is available" },
      503: { description: "Image storage is temporarily unavailable" },
    },
  });
  const routes: Route[] = [
    {
      method: "get",
      path: "/staff/support/complaints/{supportId}/email-deliveries",
      summary: "Read the latest customer email delivery attempts for this conversation",
      description:
        "Staff/admin only, branch scoped, private/no-store. Latest 20 updates, newest first. SENT means provider acceptance, not recipient-server or inbox delivery. Attempt count and next scheduled retry are shown. RETRYING will retry automatically; FAILED needs provider review and coordinated manual follow-up. NOT_SENT explains disabled delivery, opt-out or missing destination. No recipient, message content, provider payload or internal error is exposed. Historical updates before this feature are not backfilled.",
      security: true,
      params: supportIdParamsSchema,
      data: supportEmailDeliveryPageSchema,
    },
    {
      method: "get",
      path: "/staff/support/enquiries/{supportId}/email-deliveries",
      summary: "Read the latest customer email delivery attempts for this conversation",
      description:
        "Staff/admin only, branch scoped, private/no-store. Latest 20 updates, newest first. SENT means provider acceptance, not recipient-server or inbox delivery. Attempt count and next scheduled retry are shown. RETRYING will retry automatically; FAILED needs provider review and coordinated manual follow-up. NOT_SENT explains disabled delivery, opt-out or missing destination. No recipient, message content, provider payload or internal error is exposed. Historical updates before this feature are not backfilled.",
      security: true,
      params: supportIdParamsSchema,
      data: supportEmailDeliveryPageSchema,
    },
    {
      method: "get",
      path: "/customers/support/review-sources",
      summary: "List owned completed sources still available for review",
      description:
        "Customer-only, private no-store collection. Requires PRODUCT, SERVICE, ORDER or VEHICLE_TRANSACTION targetType; BUSINESS reviews require no source. Excludes sources with any pending, approved or rejected review. Product reviews also exclude every purchase of a product this customer has already reviewed, matching the existing customer/product unique constraint. Product items and whole orders are independent targets. Orders by source UUID ascending, with exclusive UUID cursor and limit 1–50 (default 20). Cursor need not remain eligible or exist; it is only a keyset boundary and grants no record access. Optional sourceId checks one source and cannot be combined with cursor; missing, foreign, incomplete and reviewed sources all return an empty collection. Availability is a current read, not a reservation: POST /customers/support/reviews still validates ownership, completed state and unique source constraints atomically. Responses include only display labels and IDs required for submission, never contacts, financial amounts or internal notes.",
      query: reviewSourceListQuerySchema,
      data: reviewSourcePageSchema,
      security: true,
    },
    {
      method: "get",
      path: "/public/support/reviews",
      summary: "List approved reviews with reviewer display names and profile portraits",
      description:
        "Only approved reviews are published. Reviewer metadata contains a display name and a review-scoped photo URL or null. Contact information, customer/user IDs, moderation records and storage keys are excluded.",
      query: publicReviewListQuerySchema,
      data: z.object({ items: z.array(publicReview), nextCursor: z.uuid().optional() }),
    },
    {
      method: "get",
      path: "/customers/support/enquiries/{supportId}/messages",
      summary: "Poll new customer-visible enquiry chat messages",
      params: supportIdParamsSchema,
      query: supportMessageListQuerySchema,
      data: timelinePage,
      description:
        "Chronological replies, status updates and authorized internal notes. messageId starts inclusively at an entry within this authorized conversation; cursor continues after an entry. Customer reads reject private and foreign anchors. Legacy messages retain their original content without inferred status metadata.",
      security: true,
    },
    {
      method: "post",
      path: "/public/support/enquiries",
      summary: "Submit a public enquiry",
      description:
        "Public PRODUCT enquiries may omit productId. VEHICLE accepts vehicleEnquiryIntent LISTING with a current public vehicleListingId, or explicit REQUIREMENTS without a listing. Legacy vehicle requests with a listing normalize to LISTING. Invalid/private references never downgrade to REQUIREMENTS. Listing branch is authoritative; requirements use an explicit active public branch or the sole active branch, otherwise 409 requests a choice. Existing branch/assignment/workforce queue scope applies. Deploy compatible forward migrations and API before enabling handoffs. Other source, validation, rate-limit and submission safeguards remain unchanged.",
      body: publicEnquiryCreateBodySchema,
      accepted: true,
    },
    {
      method: "get",
      path: "/customers/support/complaints/{supportId}/messages",
      summary: "Poll new customer-visible complaint chat messages",
      params: supportIdParamsSchema,
      query: supportMessageListQuerySchema,
      data: timelinePage,
      description:
        "Chronological replies, status updates and authorized internal notes. messageId starts inclusively at an entry within this authorized conversation; cursor continues after an entry. Customer reads reject private and foreign anchors. Legacy messages retain their original content without inferred status metadata.",
      security: true,
    },
    {
      method: "post",
      path: "/public/support/complaints",
      summary: "Submit a public complaint",
      body: publicComplaintCreateBodySchema,
      accepted: true,
    },
    {
      method: "get",
      path: "/customers/support/enquiries",
      summary: "List owned enquiries",
      query: customerEnquiryListQuerySchema,
      security: true,
    },
    {
      method: "get",
      path: "/staff/support/enquiries/{supportId}/messages",
      summary: "Poll new branch-authorized enquiry chat messages",
      params: supportIdParamsSchema,
      query: supportMessageListQuerySchema,
      data: timelinePage,
      description:
        "Chronological replies, status updates and authorized internal notes. messageId starts inclusively at an entry within this authorized conversation; cursor continues after an entry. Customer reads reject private and foreign anchors. Legacy messages retain their original content without inferred status metadata.",
      security: true,
    },
    {
      method: "post",
      path: "/customers/support/enquiries",
      summary: "Create an owned enquiry",
      description: creationDescription,
      headers: csrf.extend(supportCreationHeadersSchema.shape),
      data: enquirySubmission,
      body: customerEnquiryCreateBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "get",
      path: "/customers/support/enquiries/{supportId}",
      summary: "Get an owned enquiry and customer-visible history",
      params: supportIdParamsSchema,
      security: true,
    },
    {
      method: "get",
      path: "/staff/support/complaints/{supportId}/messages",
      summary: "Poll new branch-authorized complaint chat messages",
      params: supportIdParamsSchema,
      query: supportMessageListQuerySchema,
      data: timelinePage,
      description:
        "Chronological replies, status updates and authorized internal notes. messageId starts inclusively at an entry within this authorized conversation; cursor continues after an entry. Customer reads reject private and foreign anchors. Legacy messages retain their original content without inferred status metadata.",
      security: true,
    },
    {
      method: "post",
      path: "/customers/support/enquiries/{supportId}/messages",
      summary: "Add a customer message to an owned enquiry",
      params: supportIdParamsSchema,
      body: supportMessageBodySchema,
      headers: csrf.extend(supportReplyHeadersSchema.shape),
      description: replyDescription,
      data: replySubmission,
      security: true,
      mutate: true,
    },
    {
      method: "get",
      path: "/customers/support/complaints",
      summary: "List owned complaints",
      query: customerComplaintListQuerySchema,
      security: true,
    },
    {
      method: "post",
      path: "/customers/support/complaints",
      summary: "Create an owned complaint",
      description: creationDescription,
      headers: csrf.extend(supportCreationHeadersSchema.shape),
      data: complaintSubmission,
      body: customerComplaintCreateBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "get",
      path: "/customers/support/complaints/{supportId}",
      summary: "Get an owned complaint and customer-visible history",
      params: supportIdParamsSchema,
      security: true,
    },
    {
      method: "post",
      path: "/customers/support/complaints/{supportId}/messages",
      summary: "Add a customer message to an owned complaint",
      params: supportIdParamsSchema,
      body: supportMessageBodySchema,
      headers: csrf.extend(supportReplyHeadersSchema.shape),
      description: replyDescription,
      data: replySubmission,
      security: true,
      mutate: true,
    },
    {
      method: "get",
      path: "/customers/support/reviews",
      summary: "List own review submissions",
      query: customerReviewListQuerySchema,
      security: true,
    },
    {
      method: "post",
      path: "/customers/support/reviews",
      summary: "Submit an eligible review for moderation",
      description:
        "Requires Idempotency-Key review-v1.<13-digit Unix milliseconds>.<lowercase UUID v4>. Keys are scoped to the authenticated customer and this operation and bind the strictly normalized request body. Both initial success and replay return 201, with replayed false/true respectively. Within 24 hours of key time, original-key/body replay returns the same review ID with its current moderation state and one creation audit; source eligibility is rechecked only for new creation. Changed content conflicts with 409 IDEMPOTENCY_CONFLICT. Keys more than 24 hours old or over one minute in the future return 409 IDEMPOTENCY_EXPIRED, including after receipt cleanup, and never create a replacement. Receipts store hashes and the resource ID, not review text or credentials. Concurrent same-key requests serialize; database-aborted transactions alone may be retried. Authorization, CSRF, rate limits and source uniqueness still apply to every attempt. Missing or malformed keys return 422. Deploy matching clients; older clients must reload before creating reviews.",
      data: reviewSubmission,
      headers: csrf.extend(reviewRequestHeadersSchema.shape),
      body: reviewCreateBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "get",
      path: "/staff/support/enquiries",
      summary: "List branch-authorized enquiries",
      query: staffEnquiryListQuerySchema,
      security: true,
    },
    {
      method: "get",
      path: "/staff/support/enquiries/{supportId}",
      summary: "Get a branch-authorized enquiry",
      params: supportIdParamsSchema,
      security: true,
    },
    {
      method: "post",
      path: "/staff/support/enquiries/{supportId}/assignment",
      summary: "Assign a branch-authorized enquiry",
      params: supportIdParamsSchema,
      body: assignmentBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "post",
      path: "/staff/support/enquiries/{supportId}/status",
      summary: "Transition an enquiry",
      params: supportIdParamsSchema,
      body: enquiryTransitionBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "post",
      path: "/staff/support/enquiries/{supportId}/messages",
      summary: "Add a customer-visible or internal enquiry message",
      params: supportIdParamsSchema,
      body: staffSupportMessageBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "get",
      path: "/staff/support/complaints",
      summary: "List branch-authorized complaints",
      query: staffComplaintListQuerySchema,
      security: true,
    },
    {
      method: "get",
      path: "/staff/support/complaints/{supportId}",
      summary: "Get a branch-authorized complaint",
      params: supportIdParamsSchema,
      security: true,
    },
    {
      method: "post",
      path: "/staff/support/complaints/{supportId}/assignment",
      summary: "Assign a branch-authorized complaint",
      params: supportIdParamsSchema,
      body: assignmentBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "post",
      path: "/staff/support/complaints/{supportId}/status",
      summary: "Transition a complaint",
      params: supportIdParamsSchema,
      body: complaintTransitionBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "post",
      path: "/staff/support/complaints/{supportId}/priority",
      summary: "Set complaint priority",
      params: supportIdParamsSchema,
      body: complaintPriorityBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "post",
      path: "/staff/support/complaints/{supportId}/messages",
      summary: "Add a customer-visible or internal complaint message",
      params: supportIdParamsSchema,
      body: staffSupportMessageBodySchema,
      security: true,
      mutate: true,
    },
    {
      method: "get",
      path: "/staff/support/reviews",
      summary: "List reviews awaiting administrative moderation",
      query: staffReviewListQuerySchema,
      security: true,
    },
    {
      method: "get",
      path: "/staff/support/reviews/{reviewId}",
      summary:
        "Read one review for administrative moderation or current-state reconciliation",
      params: reviewIdParamsSchema,
      security: true,
    },
    {
      method: "post",
      path: "/staff/support/reviews/{reviewId}/moderation",
      summary: "Approve or reject a review",
      params: reviewIdParamsSchema,
      body: reviewModerationBodySchema,
      security: true,
      mutate: true,
    },
  ];

  for (const route of routes) {
    const status = route.accepted
      ? "202"
      : route.mutate
        ? route.path.startsWith("/staff/") && !route.path.endsWith("/messages")
          ? "200"
          : "201"
        : "200";
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Support"],
      summary: route.summary,
      ...(route.description ? { description: route.description } : {}),
      ...(route.security ? { security: [{ sessionCookie: [] }] } : { security: [] }),
      request: {
        ...(route.params ? { params: route.params as never } : {}),
        ...(route.query ? { query: route.query as never } : {}),
        ...(route.headers
          ? { headers: route.headers as never }
          : route.mutate
            ? { headers: csrf as never }
            : {}),
        ...(route.body
          ? {
              body: {
                required: true,
                content: { "application/json": { schema: route.body } },
              },
            }
          : {}),
      },
      responses: {
        [status]: {
          description: "Request completed",
          content: {
            "application/json": {
              schema: route.data ? response.extend({ data: route.data }) : response,
            },
          },
        },
      },
    });
  }
}
