import { apiRequest, ApiError } from "./client";
import type { RequestBody } from "./contracts";
import {
  parseProductExtrasSource,
  productExtrasRevision,
  parseCompatibilityChange,
  parseImageChange,
  type ProductExtras,
} from "./product-extras-schemas";
import {
  compatibilityBody,
  imageBody,
  type CompatibilityValues,
  type ProductImageValues,
} from "@/lib/forms/product-extras";
export async function checkProductExtras(sourcePath: string, expected: ProductExtras) {
  let current: ProductExtras | undefined;
  try {
    current = parseProductExtrasSource(
      (await apiRequest<unknown>(sourcePath)).data,
    ).items.find((product) => product.id === expected.id);
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500)
      throw error;
    throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
  }
  if (!current || productExtrasRevision(current) !== productExtrasRevision(expected))
    throw new ApiError(409, { error: { code: "STALE_VERSION" } });
}
export async function saveProductCompatibility(
  productId: string,
  itemId: string | undefined,
  values: CompatibilityValues,
) {
  const body: RequestBody<"/admin/catalog/products/{productId}/compatibilities", "post"> =
    compatibilityBody(values);
  const result = parseCompatibilityChange(
    (
      await apiRequest<unknown>(
        `/admin/catalog/products/${productId}/compatibilities${itemId ? `/${itemId}` : ""}`,
        { method: itemId ? "PATCH" : "POST", csrf: true, body },
      )
    ).data,
  );
  if (
    result.productId !== productId ||
    (itemId && result.id !== itemId) ||
    Object.entries(body).some(
      ([key, value]) => result[key as keyof typeof body] !== value,
    )
  )
    throw new Error("Unexpected compatibility response");
}
export async function saveProductImage(
  productId: string,
  itemId: string | undefined,
  values: ProductImageValues,
  expectedVersion?: number,
  uploaded = false,
) {
  const fields = imageBody(values) satisfies RequestBody<
    "/admin/catalog/products/{productId}/images",
    "post"
  >;
  const body = uploaded
    ? {
        altText: fields.altText,
        sortOrder: fields.sortOrder,
        isPrimary: fields.isPrimary,
      }
    : fields;
  const result = parseImageChange(
    (
      await apiRequest<unknown>(
        `/admin/catalog/products/${productId}/images${itemId ? `/${itemId}` : ""}`,
        {
          method: itemId ? "PATCH" : "POST",
          csrf: true,
          body: {
            ...body,
            ...(expectedVersion === undefined ? {} : { expectedVersion }),
          },
        },
      )
    ).data,
  );
  if (
    (itemId && result.id !== itemId) ||
    Object.entries(body).some(
      ([key, value]) => result[key as keyof typeof body] !== value,
    )
  )
    throw new Error("Unexpected image response");
}
export function removeProductExtra(
  productId: string,
  kind: "compatibilities" | "images",
  itemId: string,
  expectedVersion?: number,
) {
  return apiRequest(`/admin/catalog/products/${productId}/${kind}/${itemId}`, {
    method: "DELETE",
    csrf: true,
    body: kind === "images" && expectedVersion !== undefined ? { expectedVersion } : {},
  });
}
