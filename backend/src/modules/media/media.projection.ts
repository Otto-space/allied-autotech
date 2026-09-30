import type { Prisma } from "../../generated/prisma/client.js";

export const resourceImageSelect = {
  id: true,
  altText: true,
  sortOrder: true,
  isPrimary: true,
  asset: { select: { width: true, height: true } },
} satisfies Prisma.ResourceImageSelect;
export function projectResourceImage(
  image: Prisma.ResourceImageGetPayload<{ select: typeof resourceImageSelect }>,
  privateMedia = true,
) {
  return {
    id: image.id,
    altText: image.altText,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    width: image.asset.width,
    height: image.asset.height,
    url: `/api/v1/${privateMedia ? "customers" : "public"}/media/images/${image.id}`,
  };
}
