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
import { serviceParamsSchema } from "./service-operations.schemas.js";
import {
  serviceImageParamsSchema,
  serviceImageUpdateSchema,
} from "./service-media.schemas.js";
export function registerServiceMediaOpenApi(registry: OpenAPIRegistry) {
  const routes = [
    {
      method: "get" as const,
      path: "/admin/services/{serviceId}/images",
      params: serviceParamsSchema,
      output: mediaResultSchema,
      summary: "Read service image management state",
    },
    {
      method: "post" as const,
      path: "/admin/services/{serviceId}/assets/upload",
      params: serviceParamsSchema,
      body: mediaUploadSchema,
      output: mediaPreparationSchema,
      summary: "Prepare a service image upload",
    },
    {
      method: "put" as const,
      path: "/admin/services/{serviceId}/image",
      params: serviceParamsSchema,
      body: mediaConfirmSchema,
      output: mediaResultSchema,
      summary: "Confirm and replace the service image",
    },
    {
      method: "patch" as const,
      path: "/admin/services/{serviceId}/images/{imageId}",
      params: serviceImageParamsSchema,
      body: serviceImageUpdateSchema,
      output: mediaResultSchema,
      summary: "Edit service image alt text",
    },
    {
      method: "delete" as const,
      path: "/admin/services/{serviceId}/images/{imageId}",
      params: serviceImageParamsSchema,
      body: mediaVersionSchema,
      output: mediaResultSchema,
      summary: "Remove a service image",
    },
  ];
  for (const route of routes)
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Services"],
      summary: route.summary,
      description:
        "ADMIN/SUPER_ADMIN with verified MFA only, matching service management. One primary image, optional; no gallery. JPEG/PNG/WebP up to 10 MiB, 32–8192px per side, 40 million pixels, non-animated, full byte/checksum validation, metadata-free WebP within 2048px. Prepare does not attach or publish. Confirmation binds actor, service, purpose, object, checksum and expiry. expectedVersion is Service.version, shared with service metadata mutations. Exact token/body confirmation retries replay for 24h; changed replay fails. Replacement preserves the previous image on failure. Removal/replacement queue transactional retryable cleanup. Public projections expose image or null and safe image-ID URLs only; public bytes require an active service at read time. Inactive image preview uses authenticated admin content route. All image reads use no-store. See managed-media.md for retention and storage configuration.",
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
  for (const secured of [false, true])
    registry.registerPath({
      method: "get",
      path: secured
        ? "/admin/services/{serviceId}/images/{imageId}/content"
        : "/public/media/images/{imageId}",
      tags: ["Services"],
      summary: secured
        ? "Preview a service image as an administrator"
        : "Read an active service image",
      description:
        "Returns validated WebP bytes with Cache-Control: private, no-store and nosniff. Removed/replaced image IDs and inactive public service images return NOT_FOUND. This route never grants access to customer profile or garage media.",
      ...(secured ? { security: [{ sessionCookie: [] }] } : {}),
      request: {
        params: secured ? serviceImageParamsSchema : z.object({ imageId: z.uuid() }),
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
