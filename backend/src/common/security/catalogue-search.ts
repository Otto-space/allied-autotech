import type { Prisma } from "../../generated/prisma/client.js";

export const normalizeSearch = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");
export const literalSearch = (value: string) => /[%\\'"]/u.test(value);
export const validSearch = (value: string) =>
  literalSearch(value) ||
  (searchTokens(value).length > 0 && searchTokens(value).length <= 20);
export function searchTokens(value: string) {
  const source = normalizeSearch(value).replace(/\bmotor\s+oil\b/gu, "engine oil");
  const words = source.match(/[\p{L}\p{N}]+(?:[._/-][\p{L}\p{N}]+)*/gu) ?? [];
  return words.map((raw, index) => ({
    raw,
    text: /^(0|5|10|15|20|25)w-?(8|12|16|20|30|40|50|60)$/u.test(raw)
      ? raw.replace("-", "")
      : raw,
    prefix: index === words.length - 1 && /^[\p{L}]{3,}$/u.test(raw),
  }));
}
const pattern = (token: ReturnType<typeof searchTokens>[number]) =>
  ` ${token.text.replace(/[\\%_]/g, "\\$&")}${token.prefix ? "" : " "}`;

export function productSearchWhere(
  value: string,
  core = false,
): Prisma.ProductWhereInput {
  if (literalSearch(value)) {
    const text = {
      contains: value.trim().replace(/[\\%_]/g, "\\$&"),
      mode: "insensitive" as const,
    };
    return {
      OR: [
        { name: text },
        { brand: text },
        { sku: text },
        { manufacturerPartNumber: text },
        ...(!core ? [{ description: text }] : []),
      ],
    };
  }
  const tokens = searchTokens(value);
  if (!tokens.length || tokens.length > 20) return { OR: [] };
  return {
    OR: [
      { searchIdentifiers: { has: normalizeSearch(value) } },
      {
        AND: tokens.map((token) => ({
          OR: [
            { [core ? "searchCore" : "searchDocument"]: { contains: pattern(token) } },
            { searchIdentifiers: { has: token.raw } },
          ],
        })),
      },
    ],
  };
}
export function productSearchTiers(value: string): Prisma.ProductWhereInput[] {
  return [
    { searchIdentifiers: { has: normalizeSearch(value) } },
    { searchNames: { has: normalizeSearch(value) } },
    productSearchWhere(value, true),
    productSearchWhere(value),
  ];
}
export function vehicleSearchWhere(
  value: string,
  core = false,
): Prisma.VehicleListingWhereInput {
  if (literalSearch(value)) {
    const text = {
      contains: value.trim().replace(/[\\%_]/g, "\\$&"),
      mode: "insensitive" as const,
    };
    return {
      OR: [
        { title: text },
        { vehicle: { make: text } },
        { vehicle: { model: text } },
        ...(!core ? [{ description: text }] : []),
      ],
    };
  }
  const tokens = searchTokens(value);
  if (!tokens.length || tokens.length > 20) return { OR: [] };
  return {
    AND: tokens.map((token) => ({
      [core ? "searchCore" : "searchDocument"]: { contains: pattern(token) },
    })),
  };
}
export function vehicleSearchTiers(value: string): Prisma.VehicleListingWhereInput[] {
  return [
    { OR: [] }, // Public vehicle catalogue does not search private stock/VIN identifiers.
    { searchNames: { has: normalizeSearch(value) } },
    vehicleSearchWhere(value, true),
    vehicleSearchWhere(value),
  ];
}
