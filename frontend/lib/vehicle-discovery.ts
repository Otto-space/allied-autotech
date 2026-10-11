/** Public listing filters only. Keep aligned with publicVehicleListQuerySchema. */
export const vehicleChoices = {
  bodyType: [
    "SEDAN",
    "SUV",
    "COUPE",
    "HATCHBACK",
    "WAGON",
    "PICKUP",
    "VAN",
    "TRUCK",
    "BUS",
    "OTHER",
  ],
  transmission: ["AUTOMATIC", "MANUAL", "CVT", "OTHER"],
  fuelType: ["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "OTHER"],
  featured: ["true", "false"],
  sort: ["newest", "price_asc", "price_desc", "year_desc"],
} as const;
export const advancedVehicleKeys = [
  "make",
  "model",
  "year",
  "minPriceKobo",
  "maxPriceKobo",
  "bodyType",
  "transmission",
  "fuelType",
  "featured",
] as const;
export const vehicleFilterKeys = ["search", ...advancedVehicleKeys] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validCursor = (value: string) =>
  uuid.test(value) || /^[A-Za-z0-9_-]{80,1024}$/.test(value);

export function normalizeVehicleQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const key of [...vehicleFilterKeys, "sort", "cursor"] as const) {
    const raw = input.get(key);
    if (!raw) continue;
    const value = raw.trim();
    if (!value) continue;
    let valid = true;
    if (key === "search" || key === "make" || key === "model")
      valid = value.length <= (key === "search" ? 100 : 80);
    else if (key === "year")
      valid = /^\d{4}$/.test(value) && +value >= 1886 && +value <= 2200;
    else if (key === "minPriceKobo" || key === "maxPriceKobo")
      valid = /^[1-9]\d{0,15}$/.test(value);
    else if (key === "cursor") valid = validCursor(value);
    else valid = (vehicleChoices[key] as readonly string[]).includes(value);
    if (valid) {
      if (key !== "sort" || value !== "newest") params.set(key, value);
    } else invalid = true;
  }
  const min = params.get("minPriceKobo"),
    max = params.get("maxPriceKobo");
  if (min && max && BigInt(min) > BigInt(max)) {
    params.delete("minPriceKobo");
    params.delete("maxPriceKobo");
    invalid = true;
  }
  // Presentation-only cursor trail makes Previous work after reload and sharing.
  // Never send this to the strict API. A raw cursor link can always return to page 1.
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

export function vehicleApiPath(params: URLSearchParams) {
  const query = normalizeVehicleQuery(params).params;
  query.delete("_trail");
  query.set("limit", "12");
  return `/public/vehicles/discovery?${query}`;
}

export function nairaToKobo(value: string): string | undefined {
  const clean = value.trim();
  if (!clean) return "";
  if (!/^\d{1,14}(\.\d{1,2})?$/.test(clean)) return undefined;
  const [whole, fraction = ""] = clean.split(".");
  const amount = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (amount <= BigInt(0) || amount > BigInt("9999999999999999")) return undefined;
  return amount.toString();
}

export function koboToInput(value: string | null) {
  if (!value) return "";
  const amount = BigInt(value);
  const fraction = amount % BigInt(100);
  return `${amount / BigInt(100)}${fraction ? `.${fraction.toString().padStart(2, "0")}` : ""}`;
}

export function vehicleLabel(value: string) {
  if (["SUV", "CVT"].includes(value)) return value;
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
}
