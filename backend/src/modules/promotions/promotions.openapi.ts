import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  promotionCreateBodySchema,
  promotionListQuerySchema,
  promotionParamsSchema,
  promotionPreviewBodySchema,
  promotionUpdateBodySchema,
} from "./promotions.schemas.js";
const response = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const headers = z.object({ "x-csrf-token": z.string().min(32) });
export function registerPromotionsOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "post",
    path: "/customers/promotions/preview",
    summary: "Preview promotion eligibility",
    security: [{ sessionCookie: [] }],
    request: {
      headers,
      body: { content: { "application/json": { schema: promotionPreviewBodySchema } } },
    },
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: response } },
      },
    },
  });
  registry.registerPath({
    method: "get",
    path: "/admin/promotions",
    summary: "List promotions",
    security: [{ sessionCookie: [] }],
    request: { query: promotionListQuerySchema },
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: response } },
      },
    },
  });
  registry.registerPath({
    method: "get",
    path: "/admin/promotions/{promotionId}",
    summary: "Get a promotion",
    security: [{ sessionCookie: [] }],
    request: { params: promotionParamsSchema },
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: response } },
      },
    },
  });
  registry.registerPath({
    method: "post",
    path: "/admin/promotions",
    summary: "Create a promotion",
    security: [{ sessionCookie: [] }],
    request: {
      headers,
      body: { content: { "application/json": { schema: promotionCreateBodySchema } } },
    },
    responses: {
      201: {
        description: "Created",
        content: { "application/json": { schema: response } },
      },
    },
  });
  registry.registerPath({
    method: "patch",
    path: "/admin/promotions/{promotionId}",
    summary: "Update a promotion",
    security: [{ sessionCookie: [] }],
    request: {
      params: promotionParamsSchema,
      headers,
      body: { content: { "application/json": { schema: promotionUpdateBodySchema } } },
    },
    responses: {
      200: {
        description: "Success",
        content: { "application/json": { schema: response } },
      },
    },
  });
}
