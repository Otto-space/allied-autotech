/** Keep aligned with the public service discovery contract. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validCursor = (value: string) =>
  uuid.test(value) || /^[A-Za-z0-9_-]{80,1024}$/.test(value);
export const serviceSorts = [
  ["name", "Name A–Z"],
  ["newest", "Newest first"],
  ["duration_asc", "Shortest duration"],
] as const;
export const servicePricing = [
  ["", "All services"],
  ["FIXED", "Fixed price"],
  ["QUOTE_REQUIRED", "Quotation required"],
] as const;

export function normalizeServiceQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  const search = input.get("search")?.trim();
  if (search) {
    if (
      search.length >= 2 &&
      search.length <= 100 &&
      [...search].every((c) => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127)
    )
      params.set("search", search);
    else invalid = true;
  }
  const category = input.get("categoryId")?.trim();
  if (category) {
    if (uuid.test(category)) params.set("categoryId", category);
    else invalid = true;
  }
  const sort = input.get("sort")?.trim();
  if (sort) {
    if (serviceSorts.some(([value]) => value === sort)) {
      if (sort !== "name") params.set("sort", sort);
    } else invalid = true;
  }
  const pricing = input.get("pricingType")?.trim();
  if (pricing) {
    if (pricing === "FIXED" || pricing === "QUOTE_REQUIRED")
      params.set("pricingType", pricing);
    else invalid = true;
  }
  const cursor = input.get("cursor")?.trim();
  if (cursor) {
    if (validCursor(cursor) && !invalid) params.set("cursor", cursor);
    else invalid = true;
  }
  // UI-only previous-page history: excluded from the strict API query.
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length <= 50 &&
    trail.join(",").length <= 3500 &&
    trail[0] === "start" &&
    trail.slice(1).every(validCursor)
  )
    params.set("_trail", trail.join(","));
  return { params, invalid };
}

export function serviceApiPath(input: URLSearchParams) {
  const params = normalizeServiceQuery(input).params;
  params.delete("_trail");
  params.set("limit", "12");
  return `/public/services/discovery?${params}`;
}
