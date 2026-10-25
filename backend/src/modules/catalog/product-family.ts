import { z } from "zod";

export const productFamilySchema = z.enum(["REPLACEMENT_PART", "ENGINE_OIL"]);
// Recorded multigrade SAE label, not an approval or vehicle-suitability rule.
export const oilGradeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value.replace(/^(\d{1,2})W-?(\d{1,2})$/, "$1W-$2"))
  .pipe(
    z
      .string()
      .regex(
        /^(0|5|10|15|20|25)W-(8|12|16|20|30|40|50|60)$/,
        "Enter the recorded multigrade label, for example 5W-30",
      ),
  );
export const recordedProductFields = {
  family: productFamilySchema.nullable().optional(),
  oilViscosityGrade: oilGradeSchema.nullable().optional(),
  packVolumeMl: z.number().int().min(1).max(1000000).nullable().optional(),
};
export function validRecordedProduct(value: {
  family?: "REPLACEMENT_PART" | "ENGINE_OIL" | null | undefined;
  oilViscosityGrade?: string | null | undefined;
  packVolumeMl?: number | null | undefined;
  condition?: string | null | undefined;
  classification?: string | null | undefined;
}) {
  return value.family === "ENGINE_OIL"
    ? value.condition == null && value.classification == null
    : value.oilViscosityGrade == null && value.packVolumeMl == null;
}
