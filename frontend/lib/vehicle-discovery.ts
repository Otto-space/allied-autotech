import { countryCodes, europeanCountryCodes, countryName } from "./reference/countries";

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
  condition: ["NEW", "USED", "FOREIGN_USED", "LOCALLY_USED"],
  powertrain: ["BEV", "HEV", "PHEV", "ICE"],
  driveType: ["FWD", "RWD", "AWD", "FOUR_WD", "OTHER"],
  manufactureRegion: ["EUROPE"],
  inspected: ["true", "false"],
  featured: ["true", "false"],
  sort: [
    "newest",
    "price_asc",
    "price_desc",
    "year_desc",
    "year_asc",
    "mileage_asc",
    "mileage_desc",
  ],
} as const;
export const advancedVehicleKeys = [
  "make",
  "model",
  "year",
  "trim",
  "condition",
  "conditions",
  "powertrains",
  "manufactureCountryCode",
  "manufactureRegion",
  "powertrain",
  "driveType",
  "minYear",
  "maxYear",
  "minMileageKm",
  "maxMileageKm",
  "minEngineCapacityCc",
  "maxEngineCapacityCc",
  "seats",
  "color",
  "feature",
  "inspected",
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
    let value = raw.trim();
    if (input.getAll(key).length > 1) invalid = true;
    if (!value) continue;
    let valid = true;
    if (key === "conditions" || key === "powertrains") {
      const choices: readonly string[] =
        vehicleChoices[key === "conditions" ? "condition" : "powertrain"];
      const selected = value.split(",");
      valid =
        selected.length <= choices.length &&
        new Set(selected).size === selected.length &&
        selected.every((option) => choices.includes(option));
      value = choices.filter((option) => selected.includes(option)).join(",");
    } else if (["search", "make", "model", "trim", "color", "feature"].includes(key))
      valid =
        value.length <= (key === "search" ? 100 : key === "color" ? 40 : 80) &&
        !/[\x00-\x1f\x7f]/.test(value);
    else if (key === "manufactureCountryCode") valid = countryCodes.has(value);
    else if (
      key === "minMileageKm" ||
      key === "maxMileageKm" ||
      key === "minEngineCapacityCc" ||
      key === "maxEngineCapacityCc" ||
      key === "seats"
    )
      valid =
        /^\d{1,8}$/.test(value) &&
        +value >= (key.endsWith("MileageKm") ? 0 : 1) &&
        +value <= (key === "seats" ? 100 : key.endsWith("MileageKm") ? 10000000 : 30000);
    else if (key === "year" || key === "minYear" || key === "maxYear")
      valid = /^\d{4}$/.test(value) && +value >= 1886 && +value <= 2200;
    else if (key === "minPriceKobo" || key === "maxPriceKobo")
      valid = /^[1-9]\d{0,15}$/.test(value);
    else if (key === "cursor") valid = validCursor(value);
    else
      valid = (
        vehicleChoices[key as keyof typeof vehicleChoices] as readonly string[]
      ).includes(value);
    if (valid) {
      if (key !== "sort" || value !== "newest") params.set(key, value);
    } else invalid = true;
  }
  for (const [single, multiple] of [
    ["condition", "conditions"],
    ["powertrain", "powertrains"],
  ]) {
    if (params.has(single) && params.has(multiple)) {
      params.delete(single);
      invalid = true;
    }
  }
  const min = params.get("minPriceKobo"),
    max = params.get("maxPriceKobo");
  if (min && max && BigInt(min) > BigInt(max)) {
    params.delete("minPriceKobo");
    params.delete("maxPriceKobo");
    invalid = true;
  }
  for (const [minKey, maxKey] of [
    ["minYear", "maxYear"],
    ["minMileageKm", "maxMileageKm"],
    ["minEngineCapacityCc", "maxEngineCapacityCc"],
  ]) {
    const min = params.get(minKey),
      max = params.get(maxKey);
    if (min && max && +min > +max) {
      params.delete(minKey);
      params.delete(maxKey);
      invalid = true;
    }
  }
  if (params.has("model") && !params.has("make")) {
    params.delete("model");
    invalid = true;
  }
  const country = params.get("manufactureCountryCode");
  if (
    country &&
    params.has("manufactureRegion") &&
    !(europeanCountryCodes as readonly string[]).includes(country)
  ) {
    params.delete("manufactureCountryCode");
    invalid = true;
  }
  const exactYear = params.get("year");
  if (
    exactYear &&
    ((params.has("minYear") && +exactYear < +params.get("minYear")!) ||
      (params.has("maxYear") && +exactYear > +params.get("maxYear")!))
  ) {
    params.delete("year");
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
  const labels: Record<string, string> = {
    NEW: "Brand new",
    USED: "Used (origin unspecified)",
    FOREIGN_USED: "Foreign used",
    LOCALLY_USED: "Nigerian (locally) used",
    BEV: "Battery electric (BEV)",
    HEV: "Hybrid (HEV)",
    PHEV: "Plug-in hybrid (PHEV)",
    ICE: "Internal combustion (ICE)",
    FOUR_WD: "4WD",
    EUROPE: "Europe",
    manufactureCountryCode: "Final assembly country",
    manufactureRegion: "Assembly region",
    minYear: "Year from",
    maxYear: "Year to",
    minMileageKm: "Mileage from (km)",
    maxMileageKm: "Mileage to (km)",
    minEngineCapacityCc: "Engine from (cc)",
    maxEngineCapacityCc: "Engine to (cc)",
  };
  if (labels[value]) return labels[value];
  if (countryCodes.has(value)) return countryName(value);
  if (["SUV", "CVT", "AWD", "FWD", "RWD"].includes(value)) return value;
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
}
