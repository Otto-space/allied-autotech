/** Keep aligned with the strict public catalogue query schema. */
export const advancedProductKeys = [
  "brand",
  "make",
  "model",
  "year",
  "featured",
] as const;
export const productFilterKeys = [
  "search",
  "categoryId",
  ...advancedProductKeys,
] as const;
export const productSorts = ["newest", "name", "price_asc", "price_desc"] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validProductText(value: string) {
  return (
    value.length <= 100 &&
    [...value].every((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127)
  );
}
export function normalizeProductQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const key of [...productFilterKeys, "sort", "cursor"] as const) {
    const value = input.get(key)?.trim();
    if (!value) continue;
    const valid =
      key === "year"
        ? /^\d{4}$/.test(value) && +value >= 1886 && +value <= 2100
        : key === "categoryId" || key === "cursor"
          ? uuid.test(value)
          : key === "featured"
            ? ["true", "false"].includes(value)
            : key === "sort"
              ? (productSorts as readonly string[]).includes(value)
              : validProductText(value);
    if (!valid) invalid = true;
    else if (key !== "sort" || value !== "newest") params.set(key, value);
  }
  // UI-only history. Never forward this to the API's strict query validator.
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length <= 50 &&
    trail[0] === "start" &&
    trail.slice(1).every((item) => uuid.test(item))
  )
    params.set("_trail", trail.join(","));
  return { params, invalid };
}
export function productApiPath(input: URLSearchParams) {
  const params = normalizeProductQuery(input).params;
  params.delete("_trail");
  params.set("limit", "12");
  return `/public/catalog/products?${params}`;
}
