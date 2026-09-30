import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { mediaErrorResponses } from "../media/media.openapi.js";
import {
  mediaUploadSchema,
  mediaPreparationSchema,
  mediaResultSchema,
  mediaVersionSchema,
} from "../media/media.schemas.js";
import { customerVehicleParamsSchema } from "./customers.schemas.js";
import {
  garageImageConfirmSchema,
  garageImageParamsSchema,
  garageImageUpdateSchema,
} from "./garage-media.schemas.js";
export function registerGarageMediaOpenApi(registry: OpenAPIRegistry) {
  const routes = [
    {
      method: "post" as const,
      path: "/customers/vehicles/{vehicleId}/assets/upload",
      params: customerVehicleParamsSchema,
      body: mediaUploadSchema,
      output: mediaPreparationSchema,
      summary: "Prepare an owned garage image upload",
    },
    {
      method: "post" as const,
      path: "/customers/vehicles/{vehicleId}/images",
      params: customerVehicleParamsSchema,
      body: garageImageConfirmSchema,
      output: mediaResultSchema,
      summary: "Confirm an owned garage image",
    },
    {
      method: "patch" as const,
      path: "/customers/vehicles/{vehicleId}/images/{imageId}",
      params: garageImageParamsSchema,
      body: garageImageUpdateSchema,
      output: mediaResultSchema,
      summary: "Edit garage image alt text, order or cover",
    },
    {
      method: "delete" as const,
      path: "/customers/vehicles/{vehicleId}/images/{imageId}",
      params: garageImageParamsSchema,
      body: mediaVersionSchema,
      output: mediaResultSchema,
      summary: "Remove an owned garage image",
    },
  ];
  for (const route of routes)
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Customers"],
      summary: route.summary,
      description:
        "Customer owner only; all other roles denied. Private garage photos never publish to the marketplace. JPEG/PNG/WebP, non-animated, max 10 MiB each, 32–8192px per side, 40 million input pixels, re-encoded metadata-free WebP within 2048px; extreme aspect ratios below 32 output pixels rejected. At most 12 images. Prepare does not attach bytes. Confirmation verifies full bytes/checksum and ticket actor/owner/vehicle/purpose/expiry. expectedVersion is vehicle.mediaVersion; all gallery mutations serialize on the vehicle and reject stale versions. Exact confirmation token/body retries replay for 24 hours; changed-body replay fails. Images sort by sortOrder ascending then stable image ID; duplicate order numbers are allowed. First attachment becomes cover; select another using isPrimary:true. Cover cannot be unset without replacement. Removing the cover chooses the first remaining image by the same ordering; removing the final image is allowed. Removal or vehicle deletion revokes reads and queues owned-object cleanup transactionally; foreign-key restrictions on vehicle deletion remain intact. GET vehicle includes bounded images and mediaVersion. Display uses authenticated GET /customers/media/images/{imageId}, private/no-store. No public URLs, object keys or upload tokens appear in vehicle projections. See managed-media.md for retention and storage requirements.",
      security: [{ sessionCookie: [] }],
      request: {
        params: route.params,
        headers: z.object({ "x-csrf-token": z.string().min(32) }),
        body: { required: true, content: { "application/json": { schema: route.body } } },
      },
      responses: {
        ...mediaErrorResponses,
        200: {
          description: "Garage image request completed",
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
}
