import {
  clearVehicleSelection,
  fitmentQualifierKeys,
  vehicleSelectionKeys,
} from "./parts-fitment";
import { normalizeOilGrade, validOilGrade } from "./product-family";
/** Keep aligned with the strict public catalogue query schema. */
export const advancedProductKeys = [
  "family",
  "oilViscosityGrade",
  "packVolumeMl",
  "brand",
  "make",
  "model",
  "year",
  "featured",
  "minPriceKobo",
  "maxPriceKobo",
  "availability",
  "condition",
  "classification",
  "productType",
] as const;
export const productFilterKeys = [
  "search",
  "categoryId",
  "parentCategoryId",
  ...vehicleSelectionKeys,
  ...advancedProductKeys,
] as const;
export const productSorts = [
  "best_match",
  "newest",
  "name",
  "price_asc",
  "price_desc",
] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validCursor = (value: string) =>
  uuid.test(value) || /^[A-Za-z0-9_-]{80,1024}$/.test(value);
export function validProductText(value: string) {
  return (
    value.length <= 100 &&
    [...value].every((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127)
  );
}
export function normalizeProductQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const key of [...new Set([...productFilterKeys, "sort", "cursor"])]) {
    let value = input.get(key)?.trim();
    if (!value) continue;
    if (input.getAll(key).length > 1) invalid = true;
    const valid =
      key === "family"
        ? ["REPLACEMENT_PART", "ENGINE_OIL"].includes(value)
        : key === "oilViscosityGrade"
          ? validOilGrade(value)
          : key === "packVolumeMl"
            ? /^[1-9][0-9]{0,6}$/.test(value) && +value <= 1000000
            : key === "year"
              ? /^\d{4}$/.test(value) && +value >= 1886 && +value <= 2200
              : key === "cursor"
                ? validCursor(value)
                : key === "minPriceKobo" || key === "maxPriceKobo"
                  ? /^(?:0|[1-9][0-9]{0,15})$/.test(value)
                  : key === "availability"
                    ? ["in_stock", "out_of_stock"].includes(value)
                    : [
                          "categoryId",
                          "parentCategoryId",
                          "vehicleMakeId",
                          "vehicleModelId",
                        ].includes(key)
                      ? uuid.test(value)
                      : key === "condition"
                        ? ["NEW", "USED", "REFURBISHED"].includes(value)
                        : key === "classification"
                          ? ["GENUINE_OEM", "AFTERMARKET"].includes(value)
                          : key === "fitment"
                            ? ["candidates", "verified"].includes(value)
                            : key === "productType"
                              ? validProductText(value) && value.length <= 80
                              : key === "featured"
                                ? ["true", "false"].includes(value)
                                : key === "sort"
                                  ? (productSorts as readonly string[]).includes(value)
                                  : validProductText(value);
    if (!valid) invalid = true;
    else {
      if (key === "oilViscosityGrade") value = normalizeOilGrade(value);
      params.set(key, value);
    }
  }
  if (!params.has("search") && params.get("sort") === "best_match") params.delete("sort");
  if (params.get("family") === "ENGINE_OIL") {
    for (const key of ["condition", "classification"])
      if (params.has(key)) {
        params.delete(key);
        invalid = true;
      }
  } else
    for (const key of ["oilViscosityGrade", "packVolumeMl"])
      if (params.has(key)) {
        params.delete(key);
        invalid = true;
      }
  const hasVehicle = params.has("vehicleModelId");
  if (hasVehicle && params.has("year")) {
    if (params.has("make") || params.has("model")) {
      params.delete("make");
      params.delete("model");
      invalid = true;
    }
    for (const key of fitmentQualifierKeys)
      if (params.has(key)) params.set(key, params.get(key)!.normalize("NFKC"));
  } else if (
    input.has("vehicleModelId") ||
    params.has("vehicleMakeId") ||
    params.has("fitment") ||
    fitmentQualifierKeys.some((key) => params.has(key))
  ) {
    clearVehicleSelection(params);
    invalid = true;
  }
  // UI-only history. Never forward this to the API's strict query validator.
  if (
    params.has("minPriceKobo") &&
    params.has("maxPriceKobo") &&
    BigInt(params.get("minPriceKobo")!) > BigInt(params.get("maxPriceKobo")!)
  ) {
    invalid = true;
    params.delete("minPriceKobo");
    params.delete("maxPriceKobo");
    params.delete("cursor");
  }
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
export function productApiPath(input: URLSearchParams) {
  const params = normalizeProductQuery(input).params;
  params.delete("_trail");
  params.set("limit", "12");
  return `/public/catalog/products/discovery?${params}`;
}
export function clearProductFamilyFilters(params: URLSearchParams) {
  for (const key of [
    "family",
    "condition",
    "classification",
    "productType",
    "oilViscosityGrade",
    "packVolumeMl",
  ])
    params.delete(key);
}
