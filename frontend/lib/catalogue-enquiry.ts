import { z } from "zod";
import {
  normalizeVehicleQuery,
  vehicleFilterKeys,
  vehicleLabel,
} from "./vehicle-discovery";
import { normalizeProductQuery } from "./product-discovery";
import { fitmentLabels, fitmentQualifierKeys, partsEnquiryHref } from "./parts-fitment";
import { familyLabels, packVolumeLabel } from "./product-family";
import { formatKobo } from "./format/money";

export function vehicleEnquiryHref(input: URLSearchParams, listingId?: string) {
  const params = normalizeVehicleQuery(input).params;
  const transfer = new URLSearchParams({ vehicle: "1" });
  for (const key of vehicleFilterKeys)
    if (params.has(key)) transfer.set(`vehicle_${key}`, params.get(key)!);
  if (listingId && z.uuid().safeParse(listingId).success)
    transfer.set("vehicle_listingId", listingId);
  transfer.sort();
  return `/contact?${transfer}#enquiry`;
}
export function vehicleEnquiryPreferences(params: URLSearchParams) {
  const input = new URLSearchParams();
  for (const key of vehicleFilterKeys)
    if (params.has(`vehicle_${key}`)) input.set(key, params.get(`vehicle_${key}`)!);
  return normalizeVehicleQuery(input);
}
export function productEnquiryPreferences(params: URLSearchParams) {
  const input = new URLSearchParams();
  for (const [key, value] of params)
    if (key.startsWith("part_")) input.set(key.slice(5), value);
  return normalizeProductQuery(input);
}
export function vehicleEnquiryDraft(params: URLSearchParams, listingTitle?: string) {
  const { params: applied, invalid } = vehicleEnquiryPreferences(params);
  const lines = [...applied].map(([key, value]) => {
    if (key.endsWith("PriceKobo"))
      return `${key === "minPriceKobo" ? "Minimum" : "Maximum"} budget: ${formatKobo(value)}.`;
    const label =
      key === "search"
        ? "Vehicle search"
        : key === "make"
          ? "Make"
          : key === "model"
            ? "Model"
            : key === "minYear"
              ? "Earliest model year"
              : key === "maxYear"
                ? "Latest model year"
                : key === "conditions" || key === "condition"
                  ? "Condition"
                  : vehicleLabel(key);
    const display =
      key === "condition" || key === "conditions"
        ? value.split(",").map(vehicleLabel).join(", ")
        : key === "inspected"
          ? value === "true"
            ? "Requested"
            : "Not listed"
          : value;
    return `${label}: ${display}.`;
  });
  const requested =
    applied.get("search") ||
    [applied.get("make"), applied.get("model")].filter(Boolean).join(" ") ||
    "vehicle requirements";
  return {
    invalid,
    subject: `Vehicle enquiry: ${listingTitle || requested}`.slice(0, 160),
    message: [
      listingTitle
        ? `Please tell me more about the listed vehicle: ${listingTitle}.`
        : "Please discuss the following vehicle requirements with me.",
      ...(lines.length ? ["Search preferences (to be discussed):", ...lines] : []),
      "This is an enquiry, not a reservation or a promise that a vehicle can be sourced.",
      "",
      "Additional details:",
    ]
      .join("\n")
      .slice(0, 3500),
  };
}
export function productEnquiryDraft(
  params: URLSearchParams,
  context?: {
    productName?: string;
    sku?: string;
    categoryName?: string;
    vehicleName?: string;
  },
) {
  const { params: applied, invalid } = productEnquiryPreferences(params);
  const compatibility = !!context?.vehicleName && applied.get("family") !== "ENGINE_OIL";
  const search =
    applied.get("search") ||
    context?.productName ||
    context?.categoryName ||
    "automotive product";
  const lines = [
    compatibility
      ? "Please help me check the right replacement part."
      : "Please help me choose the automotive product described below.",
  ];
  if (context?.vehicleName) lines.push(`Vehicle: ${context.vehicleName}.`);
  if (context?.categoryName) lines.push(`Requested category: ${context.categoryName}.`);
  if (context?.productName)
    lines.push(
      `Requested product: ${context.productName}${context.sku ? ` (SKU ${context.sku})` : ""}.`,
    );
  for (const key of [
    "search",
    "brand",
    "productType",
    "family",
    "condition",
    "classification",
    "oilViscosityGrade",
    "packVolumeMl",
    "minPriceKobo",
    "maxPriceKobo",
    ...fitmentQualifierKeys,
  ]) {
    const value = applied.get(key);
    if (!value) continue;
    const label =
      key === "search"
        ? "Product search"
        : key === "minPriceKobo"
          ? "Minimum budget"
          : key === "maxPriceKobo"
            ? "Maximum budget"
            : key === "oilViscosityGrade"
              ? "Recorded viscosity grade"
              : key === "packVolumeMl"
                ? "Pack volume"
                : key === "family"
                  ? "Product family"
                  : fitmentLabels[key as keyof typeof fitmentLabels] || vehicleLabel(key);
    const display = key.endsWith("PriceKobo")
      ? formatKobo(value)
      : key === "packVolumeMl"
        ? packVolumeLabel(Number(value))
        : key === "family"
          ? familyLabels[value as keyof typeof familyLabels]
          : value;
    lines.push(`${label}: ${display}.`);
  }
  lines.push(
    compatibility
      ? "Please verify the necessary technical specifications before collection."
      : "Please advise which additional product specifications are needed. A recorded grade alone does not confirm suitability.",
    "Workshop collection only. This request does not confirm stock, reserve an item, place an order or take payment.",
    "",
    "Additional details:",
  );
  return {
    invalid,
    subject:
      `${compatibility ? "Part compatibility enquiry" : "Product enquiry"}: ${search}`.slice(
        0,
        160,
      ),
    message: lines.join("\n").slice(0, 3500),
  };
}

export type CatalogueEnquiryContext = {
  id: string;
  href: string;
  label: string;
  contextKey?: string;
};
export function catalogueEnquiryContext(
  params: URLSearchParams,
): CatalogueEnquiryContext {
  if (
    params.has("serviceGroup") &&
    params.get("vehicle") !== "1" &&
    params.get("parts") !== "1"
  ) {
    const id =
      params.getAll("serviceGroup").length === 1 &&
      z.uuid().safeParse(params.get("serviceGroup")).success
        ? params.get("serviceGroup")!
        : "invalid";
    const query = new URLSearchParams({ serviceGroup: id }).toString();
    return {
      id: query,
      href: "/contact?" + query + "#enquiry",
      label: "Service group enquiry",
      contextKey: query,
    };
  }
  const vehicle = params.get("vehicle") === "1";
  const product = params.get("parts") === "1";
  if (!vehicle && !product)
    return { id: "general", href: "/contact#enquiry", label: "General enquiry" };
  let href: string;
  if (vehicle) {
    href = vehicleEnquiryHref(
      vehicleEnquiryPreferences(params).params,
      params.get("vehicle_listingId") ?? undefined,
    );
  } else {
    const applied = productEnquiryPreferences(params).params;
    // Reuse the established public product transfer format and draft key foundation.
    href = partsEnquiryHref(applied, params.get("part_productId") ?? undefined);
  }
  const clean = new URL(href, "https://catalogue.invalid").searchParams;
  // Preserve an invalid supplied listing marker for unavailable handling; never downgrade.
  if (vehicle && params.has("vehicle_listingId") && !clean.has("vehicle_listingId"))
    clean.set("vehicle_listingId", "invalid");
  clean.sort();
  const query = clean.toString();
  const label = vehicle
    ? vehicleEnquiryDraft(clean).subject
    : productEnquiryDraft(clean).subject;
  return {
    id: query,
    href: `/contact?${query}#enquiry`,
    label,
    contextKey: params.toString(),
  };
}
