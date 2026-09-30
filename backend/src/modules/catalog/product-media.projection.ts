import type { Prisma } from "../../generated/prisma/client.js";
export const productImageSelect = {
  id: true,
  url: true,
  altText: true,
  sortOrder: true,
  isPrimary: true,
  createdAt: true,
  mediaAsset: { select: { width: true, height: true } },
} satisfies Prisma.ProductImageSelect;
export type ProductImageRecord = Prisma.ProductImageGetPayload<{
  select: typeof productImageSelect;
}>;
export function projectProductImage(
  image: ProductImageRecord,
  productId: string,
  admin = false,
) {
  const { mediaAsset, ...safe } = image;
  return {
    ...safe,
    source: mediaAsset ? ("UPLOADED" as const) : ("EXTERNAL" as const),
    width: mediaAsset?.width ?? null,
    height: mediaAsset?.height ?? null,
    ...(mediaAsset
      ? {
          url: admin
            ? `/api/v1/admin/catalog/products/${productId}/images/${image.id}/content`
            : `/api/v1/public/catalog/products/images/${image.id}`,
        }
      : {}),
  };
}
