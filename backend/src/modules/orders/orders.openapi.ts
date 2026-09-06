import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
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
  const paths: Path[] = [
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
      summary: "Cancel an own pending order",
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
      summary: "Get a branch-authorized order",
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
