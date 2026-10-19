import { mediaErrorResponses } from "../media/media.openapi.js";
import { savedVehiclePageSchema } from "./saved-vehicle.schemas.js";
import {
  vehicleDiscoveryQuerySchema,
  vehicleDiscoveryPageSchema,
  vehicleFacetQuerySchema,
  vehicleFacetPageSchema,
} from "./vehicle-discovery.schemas.js";
import { mediaVersionSchema, mediaPreparationSchema } from "../media/media.schemas.js";
import {
  stockImageParams,
  stockImageUpdateSchema,
  stockImageResultSchema,
  stockImageSchema,
} from "./stock-media.schemas.js";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  assetUploadBodySchema,
  conditionReportBodySchema,
  documentCreateBodySchema,
  documentParamsSchema,
  documentReviewBodySchema,
  imageCreateBodySchema,
  imageParamsSchema,
  listingCreateBodySchema,
  listingParamsSchema,
  listingPriceBodySchema,
  listingStatusBodySchema,
  listingUpdateBodySchema,
  publicVehicleListQuerySchema,
  savedVehiclePageQuerySchema,
  staffVehicleListQuerySchema,
  vehicleCreateBodySchema,
  vehicleParamsSchema,
  vehicleUpdateBodySchema,
} from "./vehicles.schemas.js";
const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrf = z.object({ "x-csrf-token": z.string().min(32) });
type Path = {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  summary: string;
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
  secured?: boolean;
  mutation?: boolean;
  created?: boolean;
  binary?: boolean;
  output?: ZodType;
  description?: string;
};
const stockDescription =
  "STAFF requires an active assigned branch matching the vehicle; ADMIN/SUPER_ADMIN retain existing cross-branch authority. All require verified MFA. Writes require CSRF. IMAGE preparation and confirmation retain their original paths and response fields; image confirmations may omit expectedVersion for old clients, but new clients send Vehicle.version. Every image mutation serializes on the vehicle row and increments that same version. PATCH/DELETE require expectedVersion. IMAGE uploads use shared actor/owner/vehicle/purpose/branch-bound tickets, 10 MiB, 20-image limit, JPEG/PNG/WebP, full checksum/signature/decoding, 32-8192px sides and 40MP, sanitized WebP output within 2048px. Still-valid old encrypted IMAGE tickets undergo the same verification; non-image asset contracts are unchanged. Exact confirmation token/body replay lasts 24h; changed replay conflicts. Failed attachments preserve old images. Optional replaceImageId on IMAGE preparation/confirmation supports replacement at the gallery limit; confirmation also requires expectedVersion. It attaches verified new bytes before detaching the old image in the same transaction, preserves its primary selection and queues owned cleanup. The old image remains intact on any failure. sortOrder is an integer 0-10000; ties use image ID, deletion leaves remaining positions unchanged. isPrimary:true replaces the previous primary; false may clear it. Deleting the primary selects the first remaining image. Deleting the last image while any AVAILABLE or RESERVED listing exists fails MEDIA_LAST_PUBLISHED_IMAGE (409), including inactive branches. Existing publication transitions and prices are unchanged. Deletion queues managed or recognized legacy owned keys in the same transaction; external files are never deleted. Preview is authenticated and branch scoped; public bytes require an AVAILABLE listing at an active branch. All byte responses are no-store; subsequent reads revoke immediately on detach. Read projections contain safe URLs, source and nullable dimensions, no keys/tickets. See managed-media.md.";
export function registerVehiclesOpenApi(registry: OpenAPIRegistry): void {
  const paths: Path[] = [
    {
      method: "get",
      path: "/public/vehicles/discovery",
      summary: "Search public vehicles with exact totals and stable paging",
      query: vehicleDiscoveryQuerySchema,
      output: vehicleDiscoveryPageSchema,
      description:
        "Anonymous. Same public filters and AVAILABLE/active-branch visibility as /public/vehicles. Maximum 50, default 20. totalMatches is the exact filtered count before pagination, read in the same repeatable-read transaction as the page; no cross-request snapshot or cache is promised. nextCursor is authenticated and bound to the filters and sort (page size may change). Deleted or unpublished anchors remain usable. Invalid, tampered or mismatched cursors return 422 VALIDATION_FAILED; restart at the first page. Mutable price/year/visibility changes can move records between pages; refresh to see current inventory. UUID cursors from old links are accepted only while their anchor is currently public and matches the query. Existing /public/vehicles behavior and UUID cursor responses remain supported. No private stock, VIN, acquisition or customer fields are exposed.",
    },
    {
      method: "get",
      path: "/public/vehicles/facets",
      summary: "Search published vehicle make or model options",
      query: vehicleFacetQuerySchema,
      output: vehicleFacetPageSchema,
      description:
        "Anonymous, maximum 50 options per page, default 20. field=make omits make; field=model requires an exact case-insensitive make. Optional search is a literal case-insensitive prefix, with percent and underscore treated literally. Values are lowercase database names, labels are deterministic stored display names; casing duplicates collapse. Sort is value ascending under C collation. Only names backed by an AVAILABLE listing at an active branch are returned. An absent nextCursor means this filtered option search is complete at that read; do not treat one page as exhaustive. Cursors are authenticated, bound to field/make/search and remain valid if the prior option disappears. Changed filters, tampering or signing-key rotation require restarting (422 VALIDATION_FAILED). No exact total or persistent cache is implied; inventory can change between reads.",
    },
    {
      method: "get",
      path: "/public/vehicles",
      summary: "Search published vehicle listings",
      query: publicVehicleListQuerySchema,
    },
    {
      method: "get",
      path: "/public/vehicles/{listingId}",
      summary: "Get a published vehicle listing",
      params: listingParamsSchema,
    },
    {
      method: "get",
      path: "/public/vehicles/images/{imageId}",
      summary: "Read a verified image from an available listing at an active branch",
      description:
        "Returns sanitized WebP bytes with private, no-store and nosniff. No signed read redirects. Removed or unpublished images return 404. Previously issued legacy signed URLs expire at their original TTL; already downloaded bytes cannot be revoked.",
      params: imageParamsSchema,
      binary: true,
    },
    {
      method: "get",
      path: "/customers/saved-vehicles",
      summary: "List saved vehicles",
      secured: true,
    },
    {
      method: "get",
      path: "/customers/saved-vehicles/page",
      summary: "Page the customer's available saved vehicles",
      description:
        "CUSTOMER only. Returns at most limit items (default 12, maximum 50), ordered by saved-record UUID ascending, with an opaque nextCursor only when more records exist. Cursors are authenticated and bound to the customer; malformed, tampered or cross-customer cursors return 422 VALIDATION_FAILED. A removed or unavailable anchor remains a valid boundary. Each request applies current AVAILABLE listing and active-branch visibility. Concurrent inserts or newly visible records before the boundary require a refresh from page one; this is not a snapshot. Token-hash key rotation invalidates cursors. No total count is implied. The original /customers/saved-vehicles array endpoint remains unchanged.",
      query: savedVehiclePageQuerySchema,
      output: savedVehiclePageSchema,
      secured: true,
    },
    {
      method: "put",
      path: "/customers/saved-vehicles/{listingId}",
      summary: "Save a vehicle",
      params: listingParamsSchema,
      secured: true,
      mutation: true,
    },
    {
      method: "delete",
      path: "/customers/saved-vehicles/{listingId}",
      summary: "Remove a saved vehicle",
      params: listingParamsSchema,
      secured: true,
      mutation: true,
    },
    {
      method: "get",
      path: "/staff/vehicles",
      summary: "List branch vehicle inventory; acquisition costs are administrator-only",
      description:
        "Private, no-store staff stock discovery. Existing active assigned-branch Staff and cross-branch Admin/Super Admin/MFA policy is unchanged. Search is a literal case-insensitive substring across stock number, make, model and VIN; exact make/model matching also treats percent, underscore and backslash literally. Optional listed=true selects records with any listing; listed=false selects records with none and cannot be combined with status. Listing status matches any stored listing on a record, including history. Existing createdAt/ID descending cursor paging is retained. The stock UI uses search, exact make/model, year, branch and listing filters only; inherited public-discovery price/specification/sort parameters require a separate stock-query contract audit.",
      query: staffVehicleListQuerySchema,
      secured: true,
    },
    {
      method: "post",
      path: "/staff/vehicles",
      summary:
        "Create a physical vehicle; acquisition cost requires ADMIN or SUPER_ADMIN",
      body: vehicleCreateBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "get",
      path: "/staff/vehicles/{vehicleId}",
      summary: "Get vehicle inventory details; acquisition costs are administrator-only",
      params: vehicleParamsSchema,
      secured: true,
    },
    {
      method: "patch",
      path: "/staff/vehicles/{vehicleId}",
      summary: "Update vehicle inventory; acquisition cost requires ADMIN or SUPER_ADMIN",
      params: vehicleParamsSchema,
      body: vehicleUpdateBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/listings",
      summary: "Create a vehicle listing",
      body: listingCreateBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "patch",
      path: "/staff/vehicles/listings/{listingId}",
      summary: "Update a vehicle listing",
      params: listingParamsSchema,
      body: listingUpdateBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/listings/{listingId}/status",
      summary: "Transition a vehicle listing",
      params: listingParamsSchema,
      body: listingStatusBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/listings/{listingId}/price",
      summary: "Change listing price with history",
      params: listingParamsSchema,
      body: listingPriceBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/assets/upload",
      summary: "Authorize a bounded object upload",
      output: mediaPreparationSchema
        .omit({ limits: true })
        .extend({ limits: mediaPreparationSchema.shape.limits.optional() }),
      description: stockDescription,
      params: vehicleParamsSchema,
      body: assetUploadBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/images",
      summary: "Verify and attach a stock vehicle image",
      output: stockImageSchema.extend({
        version: z.number().int(),
        createdAt: z.iso.datetime(),
      }),
      description: stockDescription,
      params: vehicleParamsSchema,
      body: imageCreateBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "patch",
      path: "/staff/vehicles/{vehicleId}/images/{imageId}",
      summary: "Edit stock image metadata, ordering and primary selection",
      description: stockDescription,
      params: stockImageParams,
      body: stockImageUpdateSchema,
      output: stockImageResultSchema,
      secured: true,
      mutation: true,
    },
    {
      method: "delete",
      path: "/staff/vehicles/{vehicleId}/images/{imageId}",
      summary: "Remove a stock image and queue owned object cleanup",
      description: stockDescription,
      params: stockImageParams,
      body: mediaVersionSchema,
      output: stockImageResultSchema,
      secured: true,
      mutation: true,
    },
    {
      method: "get",
      path: "/staff/vehicles/{vehicleId}/images/{imageId}/content",
      summary: "Read branch-scoped stock image preview",
      description: stockDescription,
      params: stockImageParams,
      binary: true,
      secured: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/documents",
      summary: "Confirm uploaded private document",
      params: vehicleParamsSchema,
      body: documentCreateBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/condition-reports",
      summary: "Create a condition report",
      params: vehicleParamsSchema,
      body: conditionReportBodySchema,
      secured: true,
      mutation: true,
      created: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/documents/{documentId}/review",
      summary: "Review a vehicle document",
      params: documentParamsSchema,
      body: documentReviewBodySchema,
      secured: true,
      mutation: true,
    },
    {
      method: "post",
      path: "/staff/vehicles/{vehicleId}/documents/{documentId}/access",
      summary: "Authorize private document download",
      params: documentParamsSchema,
      secured: true,
      mutation: true,
    },
  ];
  for (const route of paths)
    registry.registerPath({
      method: route.method,
      path: route.path,
      tags: ["Vehicles"],
      summary: route.summary,
      ...(route.description ? { description: route.description } : {}),
      ...(route.secured ? { security: [{ sessionCookie: [] }] } : {}),
      request: {
        ...(route.params ? { params: route.params as never } : {}),
        ...(route.query ? { query: route.query as never } : {}),
        ...(route.mutation ? { headers: csrf } : {}),
        ...(route.body
          ? {
              body: {
                required: true,
                content: { "application/json": { schema: route.body } },
              },
            }
          : {}),
      },
      responses: route.binary
        ? {
            ...mediaErrorResponses,
            "200": {
              description: "Sanitized WebP bytes; private, no-store and nosniff",
              content: { "image/webp": { schema: { type: "string", format: "binary" } } },
            },
          }
        : {
            ...(route.mutation && route.description ? mediaErrorResponses : {}),
            [route.created ? "201" : "200"]: {
              description: "Request completed",
              content: {
                "application/json": {
                  schema: route.output
                    ? responseSchema.extend({ data: route.output })
                    : responseSchema,
                },
              },
            },
          },
    });
}
