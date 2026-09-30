import type { Prisma } from "../../generated/prisma/client.js";
export const stockImageSelect = {
  id: true,
  url: true,
  altText: true,
  sortOrder: true,
  isPrimary: true,
  publicId: true,
  mediaAsset: { select: { width: true, height: true } },
} satisfies Prisma.VehicleImageSelect;
type Image = Prisma.VehicleImageGetPayload<{ select: typeof stockImageSelect }>;
export function projectStockImage(image: Image, vehicleId?: string) {
  const { publicId, mediaAsset, ...safe } = image;
  return {
    ...safe,
    url:
      vehicleId && (mediaAsset || publicId)
        ? `/api/v1/staff/vehicles/${vehicleId}/images/${image.id}/content`
        : safe.url,
    source: mediaAsset
      ? ("UPLOADED" as const)
      : publicId
        ? ("LEGACY" as const)
        : ("EXTERNAL" as const),
    width: mediaAsset?.width ?? null,
    height: mediaAsset?.height ?? null,
  };
}
