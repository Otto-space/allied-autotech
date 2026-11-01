import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { mediaErrorResponses } from "../media/media.openapi.js";
import {
  mediaConfirmSchema,
  mediaUploadSchema,
  mediaPreparationSchema,
  mediaResultSchema,
  mediaVersionSchema,
} from "../media/media.schemas.js";
import {
  categoryParamsSchema,
  categoryImageParamsSchema,
  categoryImageUpdateSchema,
} from "./category-media.schemas.js";
export function registerCategoryMediaOpenApi(registry: OpenAPIRegistry) {
  const routes = [
    {
      method: "get" as const,
      path: "/admin/service-categories/{categoryId}/images",
      params: categoryParamsSchema,
      output: mediaResultSchema,
      summary: "Read service group image management state",
    },
    {
      method: "post" as const,
      path: "/admin/service-categories/{categoryId}/assets/upload",
      params: categoryParamsSchema,
      body: mediaUploadSchema,
      output: mediaPreparationSchema,
      summary: "Prepare a service group image upload",
    },
    {
      method: "put" as const,
      path: "/admin/service-categories/{categoryId}/image",
      params: categoryParamsSchema,
      body: mediaConfirmSchema,
      output: mediaResultSchema,
      summary: "Confirm and replace the service group image",
    },
    {
      method: "patch" as const,
      path: "/admin/service-categories/{categoryId}/images/{imageId}",
      params: categoryImageParamsSchema,
      body: categoryImageUpdateSchema,
      output: mediaResultSchema,
      summary: "Edit service group image alt text",
    },
    {
      method: "delete" as const,
      path: "/admin/service-categories/{categoryId}/images/{imageId}",
      params: categoryImageParamsSchema,
      body: mediaVersionSchema,
      output: mediaResultSchema,
      summary: "Remove a service group image",
    },
  ];
  for (const route of routes)
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Services"],
      summary: route.summary,
      description:
        "ADMIN/SUPER_ADMIN with verified MFA only, matching service management. One primary image, optional; no gallery. JPEG/PNG/WebP up to 10 MiB, 32–8192px per side, 40 million pixels, non-animated, full byte/checksum validation, metadata-free WebP within 2048px. Prepare does not attach or publish. Confirmation binds actor, category, purpose, object, checksum and expiry. expectedVersion is ServiceCategory.version, shared with service metadata mutations. Exact token/body confirmation retries replay for 24h; changed replay fails. Replacement preserves the previous image on failure. Removal/replacement queue transactional retryable cleanup. Public projections expose image or null and safe image-ID URLs only; public bytes require an active service group at read time. Inactive image preview uses authenticated admin content route. All image reads use no-store. See managed-media.md for retention and storage configuration.",
      security: [{ sessionCookie: [] }],
      request: {
        params: route.params,
        ...("body" in route
          ? {
              headers: z.object({ "x-csrf-token": z.string().min(32) }),
              body: {
                required: true,
                content: { "application/json": { schema: route.body } },
              },
            }
          : {}),
      },
      responses: {
        ...mediaErrorResponses,
        200: {
          description: "Service image result",
          content: {
            "application/json": {
              schema: z.object({
                success: z.literal(true),
                message: z.string(),
                data: route.output,
                meta: z.object({ requestId: z.string(), serverTime: z.iso.datetime() }),
              }),
            },
          },
        },
      },
    });
  registry.registerPath({
    method: "get",
    path: "/admin/service-categories/{categoryId}/images/{imageId}/content",
    tags: ["Services"],
    summary: "Preview a service group image as an administrator",
    description:
      "Returns validated WebP bytes with Cache-Control: private, no-store and nosniff. Removed/replaced image IDs and inactive public service group images return NOT_FOUND. This route never grants access to customer profile or garage media.",
    security: [{ sessionCookie: [] }],
    request: {
      params: categoryImageParamsSchema,
    },
    responses: {
      404: mediaErrorResponses[404],
      503: mediaErrorResponses[503],
      200: {
        description: "Validated image bytes",
        content: { "image/webp": { schema: { type: "string", format: "binary" } } },
      },
    },
  });
}
