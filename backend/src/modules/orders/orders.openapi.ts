import { registerPickupOpenApi } from "./order-pickup.openapi.js";
import { orderTimingBodySchema } from "./order-timing.schemas.js";
import {
  issuePartsQuoteSchema,
  partsQuoteDecisionSchema,
} from "./parts-quotes.service.js";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  purchaseReviewRequestSchema,
  purchaseReviewDecisionSchema,
} from "./purchase-review.schemas.js";
import {
  checkoutBodySchema,
  customerOrderCancelBodySchema,
  customerOrderListQuerySchema,
  expireOrdersBodySchema,
  orderParamsSchema,
  orderTransitionBodySchema,
  staffOrderListQuerySchema,
} from "./orders.schemas.js";
const response = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrf = z.object({ "x-csrf-token": z.string().min(32) });
const idempotency = csrf.extend({ "idempotency-key": z.string().min(8).max(120) });
type Params = NonNullable<
  NonNullable<Parameters<OpenAPIRegistry["registerPath"]>[0]["request"]>["params"]
>;
interface Path {
  method: "get" | "post";
  path: string;
  summary: string;
  body?: ZodType;
  params?: Params;
  query?: Params;
  headers?: Params;
  created?: boolean;
}
export function registerOrdersOpenApi(registry: OpenAPIRegistry): void {
  registerPickupOpenApi(registry);
  const paths: Path[] = [
    {
      method: "post",
      path: "/admin/orders/{orderId}/timing",
      summary:
        "Record a current-access, auditable per-item sourcing estimate without authorising payment or collection",
      params: orderParamsSchema,
      body: orderTimingBodySchema,
      headers: csrf,
    },
    {
      method: "post",
      path: "/customers/orders/{orderId}/purchase-review",
      summary: "Submit an owned unpaid order's specifications for final review",
      params: orderParamsSchema,
      body: purchaseReviewRequestSchema,
      headers: csrf,
    },
    {
      method: "post",
      path: "/admin/orders/{orderId}/purchase-review/decision",
      summary:
        "Record an authorised final compatibility and availability review without charging or allocating the order",
      params: orderParamsSchema,
      body: purchaseReviewDecisionSchema,
      headers: csrf,
    },
    {
      method: "get",
      path: "/customers/parts-quotes/enquiries/{id}",
      summary: "List quotations for an owned parts request",
      params: z.object({ id: z.uuid() }),
    },
    {
      method: "get",
      path: "/admin/parts-quotes/enquiries/{id}",
      summary: "List quotations for administrator assessment",
      params: z.object({ id: z.uuid() }),
    },
    {
      method: "post",
      path: "/admin/parts-quotes/enquiries/{id}",
      summary: "Issue an immutable quotation revision for an assessed catalogue product",
      params: z.object({ id: z.uuid() }),
      body: issuePartsQuoteSchema,
      headers: idempotency,
      created: true,
    },
    {
      method: "post",
      path: "/customers/parts-quotes/{id}/accept",
      summary:
        "Accept an owned current quotation and create one guarded collection order",
      params: z.object({ id: z.uuid() }),
      body: partsQuoteDecisionSchema,
      headers: idempotency,
      created: true,
    },
    {
      method: "post",
      path: "/customers/parts-quotes/{id}/decline",
      summary: "Decline an owned current quotation",
      params: z.object({ id: z.uuid() }),
      body: partsQuoteDecisionSchema,
      headers: csrf,
    },
    {
      method: "post",
      path: "/customers/orders/checkout",
      summary: "Create an atomic server-priced checkout",
      body: checkoutBodySchema,
      headers: idempotency,
      created: true,
    },
    {
      method: "get",
      path: "/customers/orders",
      summary: "List own orders",
      query: customerOrderListQuerySchema,
    },
    {
      method: "get",
      path: "/customers/orders/{orderId}",
      summary: "Get an own order",
      params: orderParamsSchema,
    },
    {
      method: "post",
      path: "/customers/orders/{orderId}/cancel",
      summary:
        "Cancel an own pending order or record a cancellation request for staff review",
      params: orderParamsSchema,
      body: customerOrderCancelBodySchema,
      headers: csrf,
    },
    {
      method: "get",
      path: "/staff/orders",
      summary: "List branch-authorized orders",
      query: staffOrderListQuerySchema,
    },
    {
      method: "get",
      path: "/staff/orders/{orderId}",
      summary:
        "Get a branch-authorized order with currently available fulfilment transitions",
      params: orderParamsSchema,
    },
    {
      method: "post",
      path: "/staff/orders/{orderId}/status",
      summary: "Transition an order",
      params: orderParamsSchema,
      body: orderTransitionBodySchema,
      headers: csrf,
    },
    {
      method: "post",
      path: "/admin/orders/expire",
      summary: "Expire due pending orders",
      body: expireOrdersBodySchema,
      headers: csrf,
    },
  ];
  for (const path of paths)
    registry.registerPath({
      method: path.method,
      path: path.path,
      summary: path.summary,
      ...(path.path.startsWith("/staff/orders")
        ? {
            description:
              "Branch-authorized fulfilment. Invoice records are omitted entirely for STAFF; only ADMIN/SUPER_ADMIN receive embedded invoices. Commercial order totals and payment clearance dates remain available for fulfilment.",
          }
        : {}),
      security: [{ sessionCookie: [] }],
      request: {
        ...(path.params === undefined ? {} : { params: path.params }),
        ...(path.query === undefined ? {} : { query: path.query }),
        ...(path.headers === undefined ? {} : { headers: path.headers }),
        ...(path.body === undefined
          ? {}
          : { body: { content: { "application/json": { schema: path.body } } } }),
      },
      responses: {
        [path.created ? 201 : 200]: {
          description: "Success",
          content: { "application/json": { schema: response } },
        },
      },
    });
}
