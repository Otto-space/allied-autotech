import { z } from "zod";
export const productFamily = z.enum(["REPLACEMENT_PART", "ENGINE_OIL"]);
export const familyLabels = {
  REPLACEMENT_PART: "Replacement parts",
  ENGINE_OIL: "Engine oils",
} as const;
export const recordedProductFields = {
  family: productFamily.nullable().optional(),
  oilViscosityGrade: z.string().max(12).nullable().optional(),
  packVolumeMl: z.number().int().min(1).max(1000000).nullable().optional(),
};
export function normalizeOilGrade(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/^(\d{1,2})W-?(\d{1,2})$/, "$1W-$2");
}
export function validOilGrade(value: string) {
  return /^(0|5|10|15|20|25)W-(8|12|16|20|30|40|50|60)$/.test(normalizeOilGrade(value));
}
export function packVolumeLabel(value: number) {
  return value % 1000 === 0 ? `${value / 1000} L` : `${value} ml`;
}
