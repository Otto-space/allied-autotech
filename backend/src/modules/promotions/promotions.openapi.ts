import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  promotionCreateBodySchema,
  promotionCreationHeadersSchema,
  promotionReceiptParamsSchema,
  promotionEmptyQuerySchema,
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
    method: "get",
    path: "/admin/promotions/creation-receipts/{requestKey}",
    summary: "Check an administrator's promotion creation receipt",
    description:
      "Admin/Super Admin with verified MFA. Private, no-store, read only. Actor-scoped non-bearer reference valid for 24 hours from its issued timestamp. Returns key and promotionId (null if no committed receipt is currently visible). A null result does not prove an earlier request cannot still commit. Never unlock a new creation on that basis; retry the identical original key/payload only within its recovery window. Expired references fail closed even after receipt cleanup.",
    security: [{ sessionCookie: [] }],
    request: { params: promotionReceiptParamsSchema, query: promotionEmptyQuerySchema },
    responses: {
      200: {
        description: "Creation receipt",
        content: {
          "application/json": {
            schema: response.extend({
              data: z
                .object({ key: z.string(), promotionId: z.uuid().nullable() })
                .strict(),
            }),
          },
        },
      },
    },
  });
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
    description:
      "Admin/Super Admin with verified MFA. Private, no-store. Optional trimmed literal case-insensitive name/code substring search (1–160 printable characters), configuration isActive and discountType filters compose with existing createdAt/ID descending cursor pagination. Reset the cursor when filters change. Percent, underscore and backslash are literal search characters. Enabled is configuration, not checkout eligibility; redemption counts and remaining uses are not returned.",
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
    description:
      "Optional Idempotency-Key promotion-v1.<13-digit issued milliseconds>.<UUIDv4> enables actor-scoped, atomic 24-hour creation replay. The normalized payload must match; different input conflicts. Replays return the current promotion plus replayed=true without another creation or audit. First keyed save returns replayed=false. Expired/future keys fail closed, including after cleanup. Unkeyed legacy requests retain their existing behavior. Configuration defaults are unchanged; clients should explicitly send isActive=false for a disabled draft.",
    security: [{ sessionCookie: [] }],
    request: {
      headers: headers.extend(promotionCreationHeadersSchema.shape),
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
