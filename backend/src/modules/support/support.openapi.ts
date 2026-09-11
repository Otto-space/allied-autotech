import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  assignmentBodySchema,
  complaintPriorityBodySchema,
  complaintTransitionBodySchema,
  customerComplaintCreateBodySchema,
  customerComplaintListQuerySchema,
  customerEnquiryCreateBodySchema,
  customerEnquiryListQuerySchema,
  customerReviewListQuerySchema,
  enquiryTransitionBodySchema,
  publicComplaintCreateBodySchema,
  publicEnquiryCreateBodySchema,
  publicReviewListQuerySchema,
  reviewCreateBodySchema,
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

const response = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrf = z.object({ "x-csrf-token": z.string().min(32) });
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
};

export function registerSupportOpenApi(registry: OpenAPIRegistry): void {
  const routes: Route[] = [
    {
      method: "get",
      path: "/public/support/reviews",
      summary: "List approved reviews without customer identity",
      query: publicReviewListQuerySchema,
    },
    {
      method: "get",
      path: "/customers/support/enquiries/{supportId}/messages",
      summary: "Poll new customer-visible enquiry chat messages",
      params: supportIdParamsSchema,
      query: supportMessageListQuerySchema,
      security: true,
    },
    {
      method: "post",
      path: "/public/support/enquiries",
      summary: "Submit a public enquiry",
      body: publicEnquiryCreateBodySchema,
      accepted: true,
    },
    {
      method: "get",
      path: "/customers/support/complaints/{supportId}/messages",
      summary: "Poll new customer-visible complaint chat messages",
      params: supportIdParamsSchema,
      query: supportMessageListQuerySchema,
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
      security: true,
    },
    {
      method: "post",
      path: "/customers/support/enquiries",
      summary: "Create an owned enquiry",
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
      security: true,
    },
    {
      method: "post",
      path: "/customers/support/enquiries/{supportId}/messages",
      summary: "Add a customer message to an owned enquiry",
      params: supportIdParamsSchema,
      body: supportMessageBodySchema,
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
      ...(route.security ? { security: [{ sessionCookie: [] }] } : { security: [] }),
      request: {
        ...(route.params ? { params: route.params as never } : {}),
        ...(route.query ? { query: route.query as never } : {}),
        ...(route.mutate ? { headers: csrf as never } : {}),
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
          content: { "application/json": { schema: response } },
        },
      },
    });
  }
}
