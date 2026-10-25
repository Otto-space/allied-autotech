import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  productDiscoveryQuerySchema,
  productDiscoveryPageSchema,
  productFacetQuerySchema,
  productFacetPageSchema,
} from "./product-discovery.schemas.js";
import {
  adminProductResponseSchema,
  productResponseSchema,
  productImageResponseSchema,
} from "./product-media.schemas.js";
import {
  adminCategoryListQuerySchema,
  catalogEmptyQuerySchema,
  adminProductListQuerySchema,
  cartItemBodySchema,
  categoryCreateBodySchema,
  categoryListQuerySchema,
  categoryParamsSchema,
  categoryUpdateBodySchema,
  compatibilityCreateBodySchema,
  compatibilityDeleteBodySchema,
  compatibilityParamsSchema,
  compatibilityUpdateBodySchema,
  favouriteListQuerySchema,
  imageCreateBodySchema,
  imageDeleteBodySchema,
  imageParamsSchema,
  imageUpdateBodySchema,
  productCreateBodySchema,
  productListQuerySchema,
  productParamsSchema,
  productUpdateBodySchema,
} from "./catalog.schemas.js";

const responseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ requestId: z.string() }),
});
const csrfHeaders = z.object({ "x-csrf-token": z.string().min(32) });
type RegisterPathInput = Parameters<OpenAPIRegistry["registerPath"]>[0];
type RouteParameter = NonNullable<NonNullable<RegisterPathInput["request"]>["params"]>;
interface Path {
  response?: ZodType;
  description?: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  summary: string;
  status?: "200" | "201";
  body?: ZodType;
  params?: RouteParameter;
  query?: RouteParameter;
  secured?: boolean;
  csrf?: boolean;
}

export function registerCatalogOpenApi(registry: OpenAPIRegistry): void {
  const paths: readonly Path[] = [
    {
      method: "get",
      path: "/public/catalog/products/discovery",
      summary: "Search public products with exact totals and stable paging",
      query: productDiscoveryQuerySchema,
      response: responseSchema.extend({ data: productDiscoveryPageSchema }),
      description:
        "Anonymous. Active products in active categories with active parents only. Normalized vehicleModelId plus year (1886-2200), optional matching vehicleMakeId and technical qualifiers use approved inclusion evidence before counts and paging. fitment=verified requires a full technical match and no possible approved exclusion; make/model/year alone are candidates. verifiedMatches counts genuine verified results in the same repeatable-read snapshot. Legacy literal make/model filters remain available but expose only approved inclusion rules. Filters include condition (NEW/USED/REFURBISHED), classification (GENUINE_OEM/AFTERMARKET), stored productType, categoryId and parentCategoryId (direct subcategories), plus literal substring search across name, SKU, brand and manufacturer part number. minPriceKobo/maxPriceKobo are inclusive integer kobo (0-9999999999999999); availability=in_stock means at least one active branch has quantity greater than reserved, out_of_stock is its complement, including products with no inventory. No raw stock quantities are exposed. Maximum 50/default 20. totalMatches counts the filtered dataset before the cursor in the same repeatable-read transaction as the page. Sort and all filters are bound into authenticated cursors; page size may change. Deleted/unpublished anchors remain usable. Legacy UUID anchors require a currently visible matching product. Invalid/tampered/mismatched cursors return 422 VALIDATION_FAILED; restart from page one. Sort ties use ID; no cross-request snapshot/cache is promised. Price, name, stock or visibility edits can move products between reads. Existing /public/catalog/products remains supported.",
    },
    {
      method: "get",
      path: "/public/catalog/facets",
      summary: "Search catalogue category, brand and compatibility options",
      query: productFacetQuerySchema,
      response: responseSchema.extend({ data: productFacetPageSchema }),
      description:
        "Anonymous. Bounded options backed by active products in active categories, including out-of-stock products. field=category returns category UUID values and stored names; empty categories are omitted. Other fields collapse case variants into lowercase values with deterministic stored labels. Models require an exact case-insensitive make; make is forbidden for other fields. Optional categoryId scopes non-category options. search is a literal case-insensitive prefix (1-120 characters; percent/underscore escaped). Null models for make-wide compatibility do not become named model options; existing product compatibility filtering semantics are preserved. Options sort by lowercase label then value under C collation. Maximum 50/default 20. Authenticated cursors bind field/categoryId/make/search, survive deleted anchors, and reject tampering/filter changes with 422 VALIDATION_FAILED. No nextCursor means the current option search is complete. No global total or cross-request snapshot/cache is promised.",
    },
    {
      method: "get",
      path: "/public/catalog/categories",
      summary: "List active categories",
      query: categoryListQuerySchema,
    },
    {
      method: "get",
      path: "/public/catalog/categories/{categoryId}",
      summary: "Get an active category",
      params: categoryParamsSchema,
    },
    {
      method: "get",
      path: "/public/catalog/products",
      summary: "Search active products",
      response: responseSchema.extend({
        data: z.object({
          items: z.array(productResponseSchema),
          nextCursor: z.uuid().optional(),
        }),
      }),
      query: productListQuerySchema,
    },
    {
      method: "get",
      path: "/public/catalog/products/{productId}",
      summary: "Get an active product",
      response: responseSchema.extend({ data: productResponseSchema }),
      params: productParamsSchema,
    },
    {
      method: "get",
      path: "/customers/favourites",
      summary: "List own favourites",
      query: favouriteListQuerySchema,
      secured: true,
    },
    {
      method: "put",
      path: "/customers/favourites/{productId}",
      summary: "Save a favourite",
      params: productParamsSchema,
      secured: true,
      csrf: true,
    },
    {
      method: "delete",
      path: "/customers/favourites/{productId}",
      summary: "Remove a favourite",
      params: productParamsSchema,
      secured: true,
      csrf: true,
    },
    { method: "get", path: "/customers/cart", summary: "Get own cart", secured: true },
    {
      method: "put",
      path: "/customers/cart/items/{productId}",
      summary: "Set a cart item quantity",
      params: productParamsSchema,
      body: cartItemBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "delete",
      path: "/customers/cart/items/{productId}",
      summary: "Remove a cart item",
      params: productParamsSchema,
      secured: true,
      csrf: true,
    },
    {
      method: "delete",
      path: "/customers/cart",
      summary: "Clear own cart",
      secured: true,
      csrf: true,
    },
    {
      method: "get",
      path: "/admin/catalog/categories",
      summary: "List all categories",
      query: adminCategoryListQuerySchema,
      description:
        "Admin/Super Admin with verified MFA. Private, no-store. Optional literal case-insensitive name-prefix search (1–120 characters) and isActive filter. Name/ID ascending; UUID cursor and limit 1–100 (default 25) remain supported. Reset cursor when filters change. Live pagination can move records after renames and does not promise a total or snapshot.",
      secured: true,
    },
    {
      method: "get",
      path: "/admin/catalog/categories/{categoryId}",
      summary: "Read a product category for administrator management",
      description:
        "Admin/Super Admin with verified MFA. Private, no-store. Includes inactive and empty categories independently of catalogue filters/pagination. No products, stock or customer data. Missing category returns 404; invalid UUID or nonempty query returns 422. Does not create an audit or change visibility.",
      params: categoryParamsSchema,
      query: catalogEmptyQuerySchema.removeDefault(),
      response: responseSchema.extend({
        data: z.object({
          id: z.uuid(),
          name: z.string(),
          slug: z.string(),
          description: z.string().nullable(),
          isActive: z.boolean(),
          createdAt: z.iso.datetime({ offset: true }),
          updatedAt: z.iso.datetime({ offset: true }),
        }),
      }),
      secured: true,
    },
    {
      method: "post",
      path: "/admin/catalog/categories",
      summary: "Create a category",
      status: "201",
      body: categoryCreateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "patch",
      path: "/admin/catalog/categories/{categoryId}",
      summary: "Update a category",
      description:
        "Admin/Super Admin with verified MFA and CSRF. Optional expectedUpdatedAt is a millisecond-precision ISO timestamp, checked under a category row lock in the audited transaction; stale input returns 409 without changes. New editors should always send it. Legacy requests without it remain supported without stale-snapshot protection. Every successful category edit advances updatedAt. Active products must be deactivated before their category; concurrent product creation/activation shares the category lock. No original-request receipt is provided.",
      params: categoryParamsSchema,
      body: categoryUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "get",
      path: "/admin/catalog/products",
      summary: "List all products",
      response: responseSchema.extend({
        data: z.object({
          items: z.array(adminProductResponseSchema),
          nextCursor: z.uuid().optional(),
        }),
      }),
      query: adminProductListQuerySchema,
      secured: true,
    },
    {
      method: "get",
      path: "/admin/catalog/products/{productId}",
      summary: "Get an administrator product independently of catalogue paging",
      description:
        "Admin or Super Admin with the existing staff MFA assurance. Includes inactive products and inactive categories, safe administrator media metadata, compatibility and branch availability booleans; no raw inventory quantities or storage keys. Private no-store. Strict UUID and empty query. Missing records return 404. The returned updatedAt can be supplied as expectedUpdatedAt on product updates.",
      response: responseSchema.extend({ data: adminProductResponseSchema }),
      params: productParamsSchema,
      secured: true,
    },
    {
      method: "post",
      path: "/admin/catalog/products",
      summary: "Create a product",
      response: responseSchema.extend({ data: adminProductResponseSchema }),
      status: "201",
      body: productCreateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "patch",
      path: "/admin/catalog/products/{productId}",
      summary: "Update a product",
      description:
        "Admin or Super Admin with CSRF and existing MFA assurance. New editors supply expectedUpdatedAt from the direct administrator read. A mismatched timestamp returns 409 without changing the product or appending an audit. The comparison and update hold a product row lock; successful catalogue edits advance updatedAt by at least one millisecond. The precondition is optional for compatibility with existing clients; clients omitting it retain the existing update behavior and do not receive stale-snapshot protection. This is not an original-request receipt. Existing active-category, comparison-price and inventory-reservation rules remain authoritative.",
      response: responseSchema.extend({ data: adminProductResponseSchema }),
      params: productParamsSchema,
      body: productUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/admin/catalog/products/{productId}/compatibilities",
      summary: "Add compatibility",
      status: "201",
      params: productParamsSchema,
      body: compatibilityCreateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "patch",
      path: "/admin/catalog/products/{productId}/compatibilities/{compatibilityId}",
      summary: "Update compatibility",
      description:
        "Legacy draft compatibility only. Optional expectedVersion is checked under the product lock; a stale version returns 409 without a write or audit. New editors should send the version from the administrator product read. Reviewed fitment rules use the separate technical-review workspace.",
      params: compatibilityParamsSchema,
      body: compatibilityUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "delete",
      path: "/admin/catalog/products/{productId}/compatibilities/{compatibilityId}",
      summary: "Delete compatibility",
      description:
        "Retires an unreviewed legacy draft and preserves version history. Optional expectedVersion is checked under the product lock; a stale version returns 409 without a write or audit. New editors should send the version from the administrator product read.",
      params: compatibilityParamsSchema,
      body: compatibilityDeleteBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/admin/catalog/products/{productId}/images",
      summary: "Add product image",
      response: responseSchema.extend({ data: productImageResponseSchema }),
      description:
        "Hosted HTTPS URL metadata only. Backward compatible; optional expectedVersion checks Product.mediaVersion. New attachments are limited to 12 total images. External files are not fetched or storage-owned. isPrimary:false permits no primary image.",
      status: "201",
      params: productParamsSchema,
      body: imageCreateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "patch",
      path: "/admin/catalog/products/{productId}/images/{imageId}",
      summary: "Update product image",
      response: responseSchema.extend({ data: productImageResponseSchema }),
      description:
        "Edits alt text/order/primary for uploaded and external images. Only external image URLs can be changed. Optional expectedVersion checks Product.mediaVersion; new clients should supply it. Clearing primary does not select another image.",
      params: imageParamsSchema,
      body: imageUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "delete",
      path: "/admin/catalog/products/{productId}/images/{imageId}",
      summary: "Delete product image",
      body: imageDeleteBodySchema,
      description:
        "Backward compatible empty body; optional expectedVersion checks Product.mediaVersion. Managed storage cleanup is queued transactionally, external files are never deleted. Removing a primary selects no replacement; empty galleries are valid.",
      params: imageParamsSchema,
      secured: true,
      csrf: true,
    },
  ];
  for (const path of paths)
    registry.registerPath({
      method: path.method,
      path: path.path,
      tags: ["Catalogue"],
      summary: path.summary,
      ...(path.description ? { description: path.description } : {}),
      ...(path.secured === true ? { security: [{ sessionCookie: [] }] } : {}),
      request: {
        ...(path.params === undefined ? {} : { params: path.params }),
        ...(path.query === undefined ? {} : { query: path.query }),
        ...(path.csrf === true ? { headers: csrfHeaders } : {}),
        ...(path.body === undefined
          ? {}
          : {
              body: {
                required: true,
                content: { "application/json": { schema: path.body } },
              },
            }),
      },
      responses: {
        [path.status ?? "200"]: {
          description: "Request completed",
          content: { "application/json": { schema: path.response ?? responseSchema } },
        },
      },
    });
}
