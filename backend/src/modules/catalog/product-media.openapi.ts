import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { mediaErrorResponses } from "../media/media.openapi.js";
import {
  mediaUploadSchema,
  mediaPreparationSchema,
  mediaResultSchema,
} from "../media/media.schemas.js";
import { productParamsSchema, imageParamsSchema } from "./catalog.schemas.js";
import {
  productImageConfirmSchema,
  productImageOrderSchema,
  productImageOrderResultSchema,
} from "./product-media.schemas.js";
export function registerProductMediaOpenApi(registry: OpenAPIRegistry) {
  for (const route of [
    {
      path: "/admin/catalog/products/{productId}/images/reorder",
      body: productImageOrderSchema,
      output: productImageOrderResultSchema,
      summary:
        "Atomically reorder the complete product image gallery without changing main selection",
    },
    {
      path: "/admin/catalog/products/{productId}/assets/upload",
      body: mediaUploadSchema,
      output: mediaPreparationSchema,
      summary: "Prepare a product-bound binary image upload",
    },
    {
      path: "/admin/catalog/products/{productId}/images/confirm",
      body: productImageConfirmSchema,
      output: mediaResultSchema,
      summary: "Verify and attach an uploaded product image",
    },
  ])
    registry.registerPath({
      method: "post",
      path: route.path,
      tags: ["Catalogue"],
      summary: route.summary,
      description: route.path.endsWith("/reorder")
        ? "ADMIN/SUPER_ADMIN with verified MFA and CSRF. Requires expectedVersion and a unique complete permutation of the product image IDs. Validates product membership and gallery revision under the shared product lock; updates all zero-based positions and increments mediaVersion once. Does not change main selection or uploaded assets. Concurrent, partial or cross-product orders fail 409 without changes; audit retains the ordered image references."
        : "ADMIN/SUPER_ADMIN with verified MFA. Preserves the separate hosted-URL POST /admin/catalog/products/{productId}/images contract. JPEG/PNG/WebP up to 10 MiB, non-animated, 32–8192px per side, 40 million pixels, re-encoded metadata-free WebP within 2048px. Full bytes/signature/checksum/decoding verified. Tickets bind actor/product/purpose/expiry. Confirmation uses Product.mediaVersion and returns the new image only plus the new version; reread the product for the complete gallery. Exact token/body retries replay for 24h, changed replay fails. All image mutations share a product lock and increment mediaVersion; legacy hosted CRUD may omit expectedVersion, new clients should send it. At most 12 total hosted/uploaded images can be attached; older larger galleries remain readable/editable/removable. Ordering is sortOrder then image ID. isPrimary:true clears the prior primary; false is allowed and first attachment is not automatically primary. Deleting/clearing a primary does not select another, preserving existing behavior. Managed URLs are server-owned and cannot be edited through hosted metadata PATCH. Removal queues only owned storage for cleanup; external files are never deleted. Public bytes require active product and category. Read projections expose source UPLOADED/EXTERNAL, nullable dimensions and safe display URLs; never storage keys or tokens. See managed-media.md.",
      security: [{ sessionCookie: [] }],
      request: {
        params: productParamsSchema,
        headers: z.object({ "x-csrf-token": z.string().min(32) }),
        body: { required: true, content: { "application/json": { schema: route.body } } },
      },
      responses: {
        ...mediaErrorResponses,
        200: {
          description: "Product media result",
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
  for (const admin of [false, true])
    registry.registerPath({
      method: "get",
      path: admin
        ? "/admin/catalog/products/{productId}/images/{imageId}/content"
        : "/public/catalog/products/images/{imageId}",
      tags: ["Catalogue"],
      summary: admin
        ? "Preview an uploaded product image as administrator"
        : "Read an uploaded image from an active product and category",
      description:
        "Validated WebP bytes. private, no-store and nosniff. Deleted images return 404; external URLs are not proxied. Public reads deny inactive products/categories. Administrator previews retain MFA and product/image binding. No access to customer personal media.",
      ...(admin ? { security: [{ sessionCookie: [] }] } : {}),
      request: { params: admin ? imageParamsSchema : z.object({ imageId: z.uuid() }) },
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
