/** Public service discovery accepts pricing type and UUID cursor only. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const servicePricing = [
  ["", "All services"],
  ["FIXED", "Fixed price"],
  ["QUOTE_REQUIRED", "Quotation required"],
] as const;

export function normalizeServiceQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  const pricing = input.get("pricingType")?.trim();
  if (pricing) {
    if (pricing === "FIXED" || pricing === "QUOTE_REQUIRED")
      params.set("pricingType", pricing);
    else invalid = true;
  }
  const cursor = input.get("cursor")?.trim();
  if (cursor) {
    if (uuid.test(cursor)) params.set("cursor", cursor);
    else invalid = true;
  }
  // UI-only previous-page history: excluded from the strict API query.
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

export function serviceApiPath(input: URLSearchParams) {
  const params = normalizeServiceQuery(input).params;
  params.delete("_trail");
  params.set("limit", "12");
  return `/public/services?${params}`;
}
