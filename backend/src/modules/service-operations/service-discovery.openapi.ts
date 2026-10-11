import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { catalogueCursorSchema } from "../../common/security/catalogue-cursors.js";
import { publicServiceSchema } from "./service-operations.openapi.js";
import {
  adminServiceCategoryQuerySchema,
  serviceCategoryQuerySchema,
  serviceDiscoveryQuerySchema,
  serviceCategoryCreateSchema,
  serviceCategoryUpdateSchema,
  serviceCategoryParamsSchema,
  publicServiceCategorySchema,
  adminServiceCategorySchema,
} from "./service-discovery.schemas.js";

export const serviceDiscoveryPageSchema = z.object({
  items: z.array(publicServiceSchema).max(50),
  totalMatches: z.number().int().nonnegative(),
  nextCursor: catalogueCursorSchema.optional(),
});
const envelope = (data: z.ZodType) =>
  z.object({
    success: z.literal(true),
    message: z.string(),
    data,
    meta: z.object({ requestId: z.string() }),
  });
export function registerServiceDiscoveryOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: "get",
    path: "/public/services/discovery",
    summary: "Search active services with exact totals",
    description:
      "Anonymous. Literal case-insensitive substring search (2–100 characters) over name, short description and description. Optional active category and pricing filters. Sort: name ascending (default), newest first, or duration ascending with unknown durations last; IDs break ties. Limit 1–50, default 20. Signed cursors bind filters/sort and survive deleted anchors. Legacy UUID anchors must still match. Page and count share a repeatable-read snapshot; concurrent edits may move records between requests. Inactive categories are omitted from metadata but do not unpublish services.",
    request: { query: serviceDiscoveryQuerySchema },
    responses: {
      200: {
        description: "Matching public services",
        content: { "application/json": { schema: envelope(serviceDiscoveryPageSchema) } },
      },
    },
  });
  for (const admin of [false, true]) {
    const schema = admin ? adminServiceCategorySchema : publicServiceCategorySchema;
    registry.registerPath({
      method: "get",
      path: admin ? "/admin/service-categories" : "/public/services/categories",
      summary: admin
        ? "List service categories for administration"
        : "List active service category options",
      description:
        "Literal case-insensitive name-prefix search, ascending name/ID order, signed filter-bound cursor. Public options include only active categories with an active service (limit 1–50). Administrator list includes inactive and empty categories and supports isActive (limit 1–100).",
      ...(admin ? { security: [{ sessionCookie: [] }] } : {}),
      request: {
        query: admin ? adminServiceCategoryQuerySchema : serviceCategoryQuerySchema,
      },
      responses: {
        200: {
          description: "Bounded category page",
          content: {
            "application/json": {
              schema: envelope(
                z.object({
                  items: z.array(schema).max(admin ? 100 : 50),
                  nextCursor: catalogueCursorSchema.optional(),
                }),
              ),
            },
          },
        },
      },
    });
  }
  registry.registerPath({
    method: "get",
    path: "/public/services/categories/{categoryId}",
    summary: "Get an active category backed by an active service",
    request: { params: serviceCategoryParamsSchema, query: z.object({}).strict() },
    responses: {
      200: {
        description: "Public category",
        content: {
          "application/json": { schema: envelope(publicServiceCategorySchema) },
        },
      },
      404: { description: "Inactive, empty or unknown category" },
    },
  });
  for (const update of [false, true])
    registry.registerPath({
      method: update ? "patch" : "post",
      path: update
        ? "/admin/service-categories/{categoryId}"
        : "/admin/service-categories",
      summary: update
        ? "Update or archive a service category"
        : "Create a service category",
      description:
        "ADMIN or SUPER_ADMIN with verified MFA and CSRF. Category assignments require an active category. Archive removes public grouping without unpublishing services or changing bookings; reactivation restores grouping. Updates require expectedVersion. Mutations are audited. Unique slug prevents duplicate creation; after uncertain creation, read the list before retrying.",
      security: [{ sessionCookie: [] }],
      request: {
        ...(update ? { params: serviceCategoryParamsSchema } : {}),
        query: z.object({}).strict(),
        headers: z.object({ "x-csrf-token": z.string().min(32) }),
        body: {
          required: true,
          content: {
            "application/json": {
              schema: update ? serviceCategoryUpdateSchema : serviceCategoryCreateSchema,
            },
          },
        },
      },
      responses: {
        [update ? 200 : 201]: {
          description: "Saved service category",
          content: {
            "application/json": { schema: envelope(adminServiceCategorySchema) },
          },
        },
        409: { description: "Duplicate slug or stale version" },
        ...(update ? { 404: { description: "Unknown category" } } : {}),
      },
    });
}
