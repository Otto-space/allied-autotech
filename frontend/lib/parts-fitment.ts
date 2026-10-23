import { z } from "zod";

export const fitmentQualifierKeys = [
  "trim",
  "engineCode",
  "market",
  "position",
  "brakeSystem",
  "brakeDiameterMm",
  "bodyType",
  "transmission",
  "generation",
  "chassisCode",
] as const;
export const fitmentLabels: Record<(typeof fitmentQualifierKeys)[number], string> = {
  trim: "Trim",
  engineCode: "Engine code",
  market: "Vehicle market",
  position: "Axle / position",
  brakeSystem: "Brake system / hardware",
  brakeDiameterMm: "Brake disc diameter (mm)",
  bodyType: "Body style",
  transmission: "Transmission",
  generation: "Generation",
  chassisCode: "Chassis / model code",
};
export const vehicleSelectionKeys = [
  "vehicleMakeId",
  "vehicleModelId",
  "year",
  "fitment",
  ...fitmentQualifierKeys,
] as const;
export function clearVehicleSelection(params: URLSearchParams) {
  for (const key of [...vehicleSelectionKeys, "make", "model"]) params.delete(key);
}
export const fitmentDecisionSchema = z.object({
  status: z.enum(["VERIFIED_FIT", "NEEDS_VERIFICATION", "NOT_COMPATIBLE", "UNKNOWN"]),
  scope: z.enum(["MODEL", "UNIVERSAL"]).optional(),
  message: z.string(),
  missingQualifiers: z.array(z.enum(fitmentQualifierKeys)),
  matchedRuleIds: z.array(z.uuid()),
});
export type FitmentDecision = z.infer<typeof fitmentDecisionSchema>;
export const fitmentModelSchema = z
  .object({
    id: z.uuid(),
    makeId: z.uuid(),
    name: z.string().min(1).max(100),
    yearFrom: z.number().int().min(1886).max(2200),
    yearTo: z.number().int().min(1886).max(2200),
    make: z.object({ id: z.uuid(), name: z.string().min(1).max(100) }),
  })
  .refine(
    (model) => model.makeId === model.make.id && model.yearFrom <= model.yearTo,
    "Invalid model identity",
  );
export const parseFitmentModel = (value: unknown) => fitmentModelSchema.parse(value);
export const fitmentOptionsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().min(1).max(100),
        makeId: z.uuid().optional(),
        yearFrom: z.number().int().optional(),
        yearTo: z.number().int().optional(),
      }),
    )
    .max(100),
  nextCursor: z.uuid().optional(),
});
export type FitmentOption = z.infer<typeof fitmentOptionsSchema>["items"][number];

export function productFitmentHref(productId: string, params: URLSearchParams) {
  const query = new URLSearchParams();
  for (const key of vehicleSelectionKeys)
    if (params.has(key)) query.set(key, params.get(key)!);
  return `/parts/${productId}${query.size ? `?${query}` : ""}`;
}
export function partsEnquiryHref(params: URLSearchParams, productId?: string) {
  const query = new URLSearchParams({ parts: "1" });
  for (const key of [
    ...vehicleSelectionKeys,
    "categoryId",
    "search",
    "brand",
    "productType",
    "condition",
    "classification",
  ]) {
    const value = params.get(key);
    if (value && key !== "fitment") query.set(`part_${key}`, value);
  }
  if (productId && z.uuid().safeParse(productId).success)
    query.set("part_productId", productId);
  return `/contact?${query}#enquiry`;
}
