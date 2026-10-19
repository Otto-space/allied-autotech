import { createHash } from "node:crypto";
export const vehicleSaleFingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function vehicleSaleJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(vehicleSaleJson);
  if (value !== null && typeof value === "object")
    return Object.fromEntries([
      ...Object.entries(value)
        .filter(
          ([key]) => key !== "signedDocumentObjectKey" && key !== "signedDocumentSha256",
        )
        .map(([key, child]) => [key, vehicleSaleJson(child)]),
      ...(Object.hasOwn(value, "signedDocumentObjectKey")
        ? [
            [
              "hasSignedDocument",
              typeof (value as { signedDocumentObjectKey: unknown })
                .signedDocumentObjectKey === "string" &&
                (value as { signedDocumentObjectKey: string }).signedDocumentObjectKey
                  .length > 0,
            ],
          ]
        : []),
    ]);
  return value;
}
export function salesPage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    ...(rows.length > limit && last !== undefined ? { nextCursor: last.id } : {}),
  };
}
