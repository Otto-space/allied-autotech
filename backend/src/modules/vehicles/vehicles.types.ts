export function vehicleJsonSafe(value: unknown, staffVehicleId?: string): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value))
    return value.map((child) => vehicleJsonSafe(child, staffVehicleId));
  if (value !== null && typeof value === "object") {
    if ("mediaAsset" in value && "url" in value && "isPrimary" in value) {
      const image = value as {
        id: string;
        url: string;
        altText: string | null;
        sortOrder: number;
        isPrimary: boolean;
        mediaAsset: { width: number; height: number } | null;
      };
      const { mediaAsset, ...safe } = image;
      const managed = /^\/api\/v1\/public\/vehicles\/images\/[0-9a-f-]{36}$/.test(
        image.url,
      );
      return {
        ...safe,
        width: mediaAsset?.width ?? null,
        height: mediaAsset?.height ?? null,
        source: mediaAsset ? "UPLOADED" : managed ? "LEGACY" : "EXTERNAL",
        url:
          staffVehicleId && managed
            ? `/api/v1/staff/vehicles/${staffVehicleId}/images/${image.id}/content`
            : image.url,
      };
    }
    const scopedId =
      "branchId" in value &&
      "images" in value &&
      "id" in value &&
      typeof value.id === "string"
        ? value.id
        : staffVehicleId;
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        vehicleJsonSafe(child, scopedId),
      ]),
    );
  }
  return value;
}
export function vehiclePage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    ...(rows.length > limit && last !== undefined ? { nextCursor: last.id } : {}),
  };
}
