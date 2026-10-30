import {
  bookingAlternativeBodySchema,
  bookingAlternativeResponseBodySchema,
} from "./service-operations.schemas.js";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";

import { publicApiPaths } from "../../common/contracts/public-api.js";
import { mediaImageSchema } from "../media/media.schemas.js";
import { publicServiceCategorySchema } from "./service-discovery.schemas.js";
import {
  adminServiceListQuerySchema,
  bookingAssignmentBodySchema,
  bookingCancelBodySchema,
  bookingCreateBodySchema,
  bookingDisruptionBodySchema,
  bookingDisruptionResolutionBodySchema,
  bookingParamsSchema,
  bookingRescheduleBodySchema,
  bookingTransitionBodySchema,
  bookingSlotCreateBodySchema,
  bookingSlotParamsSchema,
  bookingSlotUpdateBodySchema,
  customerBookingListQuerySchema,
  publicServiceListQuerySchema,
  publicBookingSlotListQuerySchema,
  quoteCreateBodySchema,
  quoteParamsSchema,
  quoteReplaceBodySchema,
  quoteTransitionBodySchema,
  serviceCreateBodySchema,
  serviceParamsSchema,
  serviceUpdateBodySchema,
  staffBookingListQuerySchema,
  staffBookingSlotListQuerySchema,
  workOrderCreateBodySchema,
  workOrderParamsSchema,
  workOrderTransitionBodySchema,
  workOrderUpdateBodySchema,
} from "./service-operations.schemas.js";

const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
export const publicServiceSchema = z.object({
  categoryId: z.uuid().nullable(),
  category: publicServiceCategorySchema.nullable(),
  image: mediaImageSchema.nullable(),
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  pricingType: z.enum(["FIXED", "QUOTE_REQUIRED"]),
  priceKobo: z
    .string()
    .regex(/^(?:0|[1-9][0-9]*)$/u)
    .nullable(),
  currency: z.literal("NGN"),
  durationMinutes: z.number().int().nullable(),
  isActive: z.boolean(),
  version: z.number().int(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
const publicServiceListResponseSchema = responseSchema.extend({
  data: z.object({
    items: z.array(publicServiceSchema),
    nextCursor: z.uuid().optional(),
  }),
});
const publicServiceResponseSchema = responseSchema.extend({ data: publicServiceSchema });
// The administrator projection has the same fields, with inactive records and
// categories retained and image URLs routed through authorized private reads.
export const adminServiceSchema = publicServiceSchema;
export const adminServicePageSchema = z.object({
  items: z.array(adminServiceSchema).max(100),
  nextCursor: z.uuid().optional(),
});
const csrfHeaders = z.object({ "x-csrf-token": z.string().min(32) });
const idempotentHeaders = csrfHeaders.extend({
  "idempotency-key": z.string().min(16).max(120),
});
type RegisterPathInput = Parameters<OpenAPIRegistry["registerPath"]>[0];
type RouteParameter = NonNullable<NonNullable<RegisterPathInput["request"]>["params"]>;
interface Path {
  method: "get" | "post" | "put" | "patch";
  path: string;
  summary: string;
  description?: string;
  body?: ZodType;
  params?: RouteParameter;
  query?: RouteParameter;
  secured?: boolean;
  csrf?: boolean;
  created?: boolean;
  response?: ZodType;
  idempotent?: boolean;
}

export function registerServiceOperationsOpenApi(registry: OpenAPIRegistry): void {
  const paths: readonly Path[] = [
    {
      method: "get",
      path: publicApiPaths.services,
      summary: "List active services",
      query: publicServiceListQuerySchema,
      response: publicServiceListResponseSchema,
    },
    {
      method: "get",
      path: publicApiPaths.service,
      summary: "Get an active service",
      params: serviceParamsSchema,
      response: publicServiceResponseSchema,
    },
    {
      method: "get",
      path: publicApiPaths.bookingPolicy,
      summary: "Get the current deposit and scheduling policy",
    },
    {
      method: "get",
      path: publicApiPaths.serviceSlots,
      summary: "List available published slots for a fixed-price service",
      params: serviceParamsSchema,
      query: publicBookingSlotListQuerySchema,
    },
    {
      method: "get",
      path: "/admin/services",
      summary: "List all services",
      description:
        "Admin and Super Admin only. Search is a trimmed, case-insensitive literal substring (2-100 characters) across name, shortDescription and description. Category, pricing and visibility filters combine with search; inactive categories remain usable. Results use ascending UUID order. A UUID cursor is an exclusive position and remains usable after its record is removed or no longer matches. Reset the cursor when filters change; refresh page one to see earlier changes. Existing cursor, limit, pricingType and isActive clients remain supported.",
      query: adminServiceListQuerySchema,
      response: responseSchema.extend({ data: adminServicePageSchema }),
      secured: true,
    },
    {
      method: "get",
      path: "/admin/services/{serviceId}",
      summary: "Get a service for administrator management",
      description:
        "Admin and Super Admin only. Includes inactive services and assigned categories, the current revision, and authorized image metadata. Returns 404 for a missing service and 422 for invalid parameters. STAFF and customers are denied. Reads do not replace the expectedVersion requirement for PATCH.",
      params: serviceParamsSchema,
      query: z.object({}).strict(),
      response: responseSchema.extend({ data: adminServiceSchema }),
      secured: true,
    },
    {
      method: "post",
      path: "/admin/services",
      summary: "Create a service",
      body: serviceCreateBodySchema,
      secured: true,
      csrf: true,
      idempotent: true,
      created: true,
    },
    {
      method: "patch",
      path: "/admin/services/{serviceId}",
      summary: "Update a service using optimistic concurrency",
      params: serviceParamsSchema,
      body: serviceUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/customers/bookings/{bookingId}/disruption-resolution",
      summary: "Transfer a business-disrupted booking or request its deposit refund",
      params: bookingParamsSchema,
      body: bookingDisruptionResolutionBodySchema,
      secured: true,
      csrf: true,
      idempotent: true,
    },
    {
      method: "get",
      path: "/customers/bookings",
      summary: "List own bookings with previously issued quotations only",
      query: customerBookingListQuerySchema,
      secured: true,
    },
    {
      method: "post",
      path: "/customers/bookings",
      summary: "Request a booking",
      description:
        "Accept an offered slot, or a preferred branch/time with either a published service or a customerConcern of 10–2000 characters. Concern requests retain null service and price until staff classification. All requests require staff confirmation.",
      body: bookingCreateBodySchema,
      secured: true,
      csrf: true,
      idempotent: true,
      created: true,
    },
    {
      method: "get",
      path: "/customers/bookings/{bookingId}",
      summary: "Get an owned booking with previously issued quotations only",
      params: bookingParamsSchema,
      secured: true,
    },
    {
      method: "patch",
      path: "/customers/bookings/{bookingId}/schedule",
      summary: "Request one permitted reschedule of a confirmed booking",
      params: bookingParamsSchema,
      body: bookingRescheduleBodySchema,
      secured: true,
      csrf: true,
      idempotent: true,
    },
    {
      method: "post",
      path: "/customers/bookings/{bookingId}/cancel",
      summary: "Cancel an owned booking",
      params: bookingParamsSchema,
      body: bookingCancelBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/customers/bookings/{bookingId}/quotes/{quoteId}/accept",
      summary: "Accept an issued quote",
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/customers/bookings/{bookingId}/quotes/{quoteId}/reject",
      summary: "Reject an issued quote",
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "get",
      path: "/staff/bookings",
      summary: "List branch-authorized bookings",
      query: staffBookingListQuerySchema,
      secured: true,
    },
    {
      method: "get",
      path: "/staff/booking-slots",
      summary: "List authorized published booking slots",
      query: staffBookingSlotListQuerySchema,
      secured: true,
    },
    {
      method: "post",
      path: "/staff/booking-slots",
      summary: "Publish a staff-bound fixed-price booking slot",
      body: bookingSlotCreateBodySchema,
      secured: true,
      csrf: true,
      created: true,
    },
    {
      method: "patch",
      path: "/staff/booking-slots/{slotId}",
      summary: "Open or close a booking slot using optimistic concurrency",
      params: bookingSlotParamsSchema,
      body: bookingSlotUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "get",
      path: "/staff/bookings/{bookingId}",
      summary: "Get a branch-authorized booking",
      params: bookingParamsSchema,
      secured: true,
    },
    {
      method: "post",
      path: "/staff/bookings/{bookingId}/alternative",
      summary:
        "Propose a different time without changing the appointment; requires booking confirmation authority",
      params: bookingParamsSchema,
      body: bookingAlternativeBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/customers/bookings/{bookingId}/alternative-response",
      summary:
        "Accept or decline the current version-bound alternative; acceptance requests staff confirmation without consuming customer reschedule allowance",
      params: bookingParamsSchema,
      body: bookingAlternativeResponseBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "patch",
      path: "/staff/bookings/{bookingId}/assignment",
      summary: "Assign available branch staff and classify an unassigned concern",
      params: bookingParamsSchema,
      body: bookingAssignmentBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/staff/bookings/{bookingId}/disruption",
      summary: "Report a business-caused booking disruption",
      params: bookingParamsSchema,
      body: bookingDisruptionBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/staff/bookings/{bookingId}/status",
      summary: "Transition a booking",
      params: bookingParamsSchema,
      body: bookingTransitionBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/staff/bookings/{bookingId}/quotes",
      summary: "Create a quote draft",
      params: bookingParamsSchema,
      body: quoteCreateBodySchema,
      secured: true,
      csrf: true,
      created: true,
    },
    {
      method: "put",
      path: "/staff/bookings/{bookingId}/quotes/{quoteId}",
      summary: "Create a replacement quote version",
      params: quoteParamsSchema,
      body: quoteReplaceBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/staff/bookings/{bookingId}/quotes/{quoteId}/issue",
      summary: "Issue a quote",
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/staff/bookings/{bookingId}/quotes/{quoteId}/void",
      summary: "Void a quote",
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/staff/bookings/{bookingId}/quotes/{quoteId}/expire",
      summary: "Expire an overdue quote",
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/staff/bookings/{bookingId}/work-orders",
      summary: "Create a work order",
      params: bookingParamsSchema,
      body: workOrderCreateBodySchema,
      secured: true,
      csrf: true,
      created: true,
    },
    {
      method: "put",
      path: "/staff/bookings/{bookingId}/work-orders/{workOrderId}",
      summary: "Update work details and append items",
      params: workOrderParamsSchema,
      body: workOrderUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/staff/bookings/{bookingId}/work-orders/{workOrderId}/status",
      summary: "Transition a work order",
      params: workOrderParamsSchema,
      body: workOrderTransitionBodySchema,
      secured: true,
      csrf: true,
    },
  ];

  for (const route of paths) {
    registry.registerPath({
      method: route.method,
      path: route.path,
      summary: route.summary,
      ...(route.description ? { description: route.description } : {}),
      ...(route.path.startsWith("/staff/bookings")
        ? {
            description:
              "Branch-authorized workshop operations. Deposit payment records are omitted entirely for STAFF, including operational mutation responses. Booking policy snapshots and scheduling/payment clearance states remain available. Inactive staff branches are denied.",
          }
        : {}),
      tags: ["Service operations"],
      ...(route.secured ? { security: [{ sessionCookie: [] }] } : {}),
      request: {
        ...(route.params === undefined ? {} : { params: route.params }),
        ...(route.query === undefined ? {} : { query: route.query }),
        ...(route.body === undefined
          ? {}
          : { body: { content: { "application/json": { schema: route.body } } } }),
        ...(route.idempotent
          ? { headers: idempotentHeaders }
          : route.csrf
            ? { headers: csrfHeaders }
            : {}),
      },
      responses: {
        [route.created ? "201" : "200"]: {
          description: "Success",
          content: { "application/json": { schema: route.response ?? responseSchema } },
        },
      },
    });
  }
}
