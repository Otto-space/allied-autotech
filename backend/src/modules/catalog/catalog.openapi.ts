import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z, type ZodType } from "zod";
import {
  adminCategoryListQuerySchema,
  adminProductListQuerySchema,
  cartItemBodySchema,
  categoryCreateBodySchema,
  categoryListQuerySchema,
  categoryParamsSchema,
  categoryUpdateBodySchema,
  compatibilityCreateBodySchema,
  compatibilityParamsSchema,
  compatibilityUpdateBodySchema,
  favouriteListQuerySchema,
  imageCreateBodySchema,
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
      query: productListQuerySchema,
    },
    {
      method: "get",
      path: "/public/catalog/products/{productId}",
      summary: "Get an active product",
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
      params: categoryParamsSchema,
      body: categoryUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "get",
      path: "/admin/catalog/products",
      summary: "List all products",
      query: adminProductListQuerySchema,
      secured: true,
    },
    {
      method: "post",
      path: "/admin/catalog/products",
      summary: "Create a product",
      status: "201",
      body: productCreateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "patch",
      path: "/admin/catalog/products/{productId}",
      summary: "Update a product",
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
      params: compatibilityParamsSchema,
      body: compatibilityUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "delete",
      path: "/admin/catalog/products/{productId}/compatibilities/{compatibilityId}",
      summary: "Delete compatibility",
      params: compatibilityParamsSchema,
      secured: true,
      csrf: true,
    },
    {
      method: "post",
      path: "/admin/catalog/products/{productId}/images",
      summary: "Add product image",
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
      params: imageParamsSchema,
      body: imageUpdateBodySchema,
      secured: true,
      csrf: true,
    },
    {
      method: "delete",
      path: "/admin/catalog/products/{productId}/images/{imageId}",
      summary: "Delete product image",
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
          content: { "application/json": { schema: responseSchema } },
        },
      },
    });
}
