import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { catalogueCursorSchema } from "../../common/security/catalogue-cursors.js";
import { publicServiceSchema } from "./service-operations.openapi.js";
import {
  ownerStructureApplySchema,
  ownerStructurePreviewSchema,
  ownerStructureResultSchema,
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

  registry.registerPath({
    method: "get",
    path: "/admin/service-categories/owner-structure",
    summary: "Review the eight owner-approved service groups",
    description:
      "Verified administrator only. Returns existing identities and a revision for explicit review. Includes inactive categories; no writes. Ambiguous names or an existing conflicting Tyre Change association return 409.",
    security: [{ sessionCookie: [] }],
    request: { query: z.object({}).strict() },
    responses: {
      200: {
        description: "Current import review",
        content: {
          "application/json": { schema: envelope(ownerStructurePreviewSchema) },
        },
      },
      409: { description: "Review existing category or service associations" },
    },
  });
  registry.registerPath({
    method: "post",
    path: "/admin/service-categories/owner-structure",
    summary: "Apply the reviewed owner service structure",
    description:
      "Verified administrator and CSRF required. Atomic, audited, revision-checked operation creates missing groups, preserves existing category identity/content/visibility, and associates only unassigned Tyre Change without changing pricing or duration. Refetch review after an uncertain result; repeated application makes no duplicate changes. No service is created, and no booking/history record is rewritten.",
    security: [{ sessionCookie: [] }],
    request: {
      query: z.object({}).strict(),
      headers: z.object({ "x-csrf-token": z.string().min(32) }),
      body: {
        required: true,
        content: { "application/json": { schema: ownerStructureApplySchema } },
      },
    },
    responses: {
      200: {
        description: "Applied structure",
        content: { "application/json": { schema: envelope(ownerStructureResultSchema) } },
      },
      409: { description: "Stale review or conflicting existing records" },
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
        "Literal case-insensitive name-prefix search, ascending name/ID order, signed filter-bound cursor. Public options include active categories even without individual services, with their maintained descriptions (limit 1–50). Administrator list includes inactive and empty categories and supports isActive (limit 1–100).",
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
    summary: "Get an active service group, including groups awaiting individual services",
    request: { params: serviceCategoryParamsSchema, query: z.object({}).strict() },
    responses: {
      200: {
        description: "Public category",
        content: {
          "application/json": { schema: envelope(publicServiceCategorySchema) },
        },
      },
      404: { description: "Inactive or unknown category" },
    },
  });
  registry.registerPath({
    method: "get",
    path: "/admin/service-categories/{categoryId}",
    summary: "Read a service category for administration",
    description:
      "ADMIN or SUPER_ADMIN with verified MFA. Returns the current category and revision, including inactive and empty categories, independently of list filters or pagination. Private, no-store. Does not include service records or change category visibility. Updates retain expectedVersion and CSRF enforcement.",
    security: [{ sessionCookie: [] }],
    request: {
      params: serviceCategoryParamsSchema,
      query: z.object({}).strict(),
    },
    responses: {
      200: {
        description: "Current administrator category",
        content: {
          "application/json": { schema: envelope(adminServiceCategorySchema) },
        },
      },
      404: { description: "Unknown category" },
      422: { description: "Malformed category ID or unsupported query" },
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
