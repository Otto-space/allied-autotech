import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  customerInvoiceListQuerySchema,
  invoiceCreateBodySchema,
  invoiceParamsSchema,
  invoiceTransitionBodySchema,
  staffInvoiceListQuerySchema,
} from "./billing.schemas.js";
const response = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const headers = z.object({ "x-csrf-token": z.string().min(32) });
export function registerBillingOpenApi(registry: OpenAPIRegistry): void {
  for (const [path, query] of [
    ["/customers/invoices", customerInvoiceListQuerySchema],
    ["/staff/invoices", staffInvoiceListQuerySchema],
  ] as const)
    registry.registerPath({
      method: "get",
      path,
      summary: "List authorized invoices",
      security: [{ sessionCookie: [] }],
      request: { query },
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: response } },
        },
      },
    });
  for (const path of ["/customers/invoices/{invoiceId}", "/staff/invoices/{invoiceId}"])
    registry.registerPath({
      method: "get",
      path,
      summary: "Get an authorized invoice",
      security: [{ sessionCookie: [] }],
      request: { params: invoiceParamsSchema },
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: response } },
        },
      },
    });
  registry.registerPath({
    method: "post",
    path: "/staff/invoices",
    summary: "Create an invoice from a server-owned source",
    security: [{ sessionCookie: [] }],
    request: {
      headers,
      body: { content: { "application/json": { schema: invoiceCreateBodySchema } } },
    },
    responses: {
      201: {
        description: "Created",
        content: { "application/json": { schema: response } },
      },
    },
  });
  for (const action of ["issue", "void"])
    registry.registerPath({
      method: "post",
      path: `/staff/invoices/{invoiceId}/${action}`,
      summary: `${action} an invoice`,
      security: [{ sessionCookie: [] }],
      request: {
        params: invoiceParamsSchema,
        headers,
        body: {
          content: { "application/json": { schema: invoiceTransitionBodySchema } },
        },
      },
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: response } },
        },
      },
    });
}
