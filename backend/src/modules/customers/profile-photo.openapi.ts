import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { mediaErrorResponses } from "../media/media.openapi.js";
import {
  mediaConfirmSchema,
  mediaPreparationSchema,
  mediaResultSchema,
  mediaUploadSchema,
  mediaVersionSchema,
} from "../media/media.schemas.js";

export function registerProfilePhotoOpenApi(registry: OpenAPIRegistry) {
  const routes = [
    {
      method: "post" as const,
      path: "/customers/profile/photo/upload",
      body: mediaUploadSchema,
      output: mediaPreparationSchema,
      summary: "Prepare an owner-bound profile photo upload",
    },
    {
      method: "put" as const,
      path: "/customers/profile/photo",
      body: mediaConfirmSchema,
      output: mediaResultSchema,
      summary: "Confirm and atomically replace the profile photo",
    },
    {
      method: "delete" as const,
      path: "/customers/profile/photo",
      body: mediaVersionSchema,
      output: mediaResultSchema,
      summary: "Remove the profile photo",
    },
  ];
  for (const route of routes)
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Customers"],
      summary: route.summary,
      description:
        "Customer owner only. Admin/Staff/Super Admin are denied personal-media access. CSRF required. Profile uploads allow JPEG/PNG/WebP up to 5 MiB, 32–8192 pixels per dimension and at most 40 million pixels, one non-animated image. Backend checks bytes, checksum, signature and complete decoding, rotates and re-encodes to WebP (maximum 1024px), stripping metadata. Upload does not publish media. Confirmation binds the token to actor/owner/profile/purpose/object/checksum/expiry. expectedVersion is profile.mediaVersion, independent of profile text editing. Exact confirmation retries with the same token and body replay the safe result for 24 hours; different replay is MEDIA_TICKET_CONSUMED. Expired unconfirmed tickets fail even if transfer finished. On uncertain confirmation, reread the profile before another mutation. Replacement failure preserves the previous image. Removed/replaced objects use transactional retryable cleanup; unattached uploads are cleaned after upload expiry plus one hour, cascaded resource deletions after one hour. Signed PUT credentials are present only in this preparation response, never resource reads or audits. Private bytes are served via authenticated no-store media routes; no signed read URL is returned. No separate Idempotency-Key is required: the confirmation token is the idempotency identity.",
      security: [{ sessionCookie: [] }],
      request: {
        headers: z.object({ "x-csrf-token": z.string().min(32) }),
        body: { required: true, content: { "application/json": { schema: route.body } } },
      },
      responses: {
        ...mediaErrorResponses,
        200: {
          description: "Photo request completed",
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
    path: "/customers/media/images/{imageId}",
    tags: ["Customers"],
    summary: "Read an owned private image",
    description:
      "Owner-authenticated bytes. Cross-customer IDs return NOT_FOUND. No public access or administrative original-image access. Cache-Control: private, no-store. URLs contain a stable image ID only; removed images return NOT_FOUND immediately after commit.",
    security: [{ sessionCookie: [] }],
    request: { params: z.object({ imageId: z.uuid() }) },
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
