import { z } from "zod";

export const qualifierKeys = [
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
export type QualifierKey = (typeof qualifierKeys)[number];
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        [...value].every((character) => {
          const code = character.codePointAt(0) ?? 0;
          return code > 31 && code !== 127;
        }),
      "Use printable text",
    );
const qualifier = text(100).transform((value) => value.normalize("NFKC").trim());
export const qualifiersShape = {
  trim: qualifier.optional(),
  engineCode: qualifier.optional(),
  market: qualifier.optional(),
  position: qualifier.optional(),
  brakeSystem: qualifier.optional(),
  brakeDiameterMm: qualifier.optional(),
  bodyType: qualifier.optional(),
  transmission: qualifier.optional(),
  generation: qualifier.optional(),
  chassisCode: qualifier.optional(),
};
export const selectionSchema = z
  .object({
    vehicleMakeId: z.uuid().optional(),
    vehicleModelId: z.uuid(),
    year: z.number().int().min(1886).max(2200),
    ...qualifiersShape,
  })
  .strict();
export type FitmentSelection = z.infer<typeof selectionSchema>;
export const selectionQuerySchema = selectionSchema.extend({
  year: z
    .string()
    .regex(/^\d{4}$/)
    .transform(Number)
    .pipe(z.number().int().min(1886).max(2200)),
});
export const fitmentParamsSchema = z
  .object({ productId: z.uuid(), ruleId: z.uuid() })
  .strict();
export const fitmentProductParamsSchema = fitmentParamsSchema.omit({ ruleId: true });
export const registryListQuerySchema = z
  .object({
    makeId: z.uuid().optional(),
    search: text(100).optional(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();
export const makeWriteSchema = z.object({ name: text(100) }).strict();
export const modelWriteSchema = z
  .object({
    makeId: z.uuid(),
    name: text(100),
    yearFrom: z.number().int().min(1886).max(2200),
    yearTo: z.number().int().min(1886).max(2200),
    sourceReference: text(500),
  })
  .strict()
  .refine((value) => value.yearFrom <= value.yearTo, {
    path: ["yearTo"],
    message: "End year must not precede start year",
  });
export const ruleWriteSchema = z
  .object({
    scope: z.enum(["MODEL", "UNIVERSAL"]).default("MODEL"),
    vehicleModelId: z.uuid().nullable().optional(),
    branchId: z.uuid().nullable().optional(),
    yearFrom: z.number().int().min(1886).max(2200).nullable().optional(),
    yearTo: z.number().int().min(1886).max(2200).nullable().optional(),
    effect: z.enum(["INCLUDE", "EXCLUDE"]).default("INCLUDE"),
    safetyCritical: z.boolean().default(true),
    allVariantsConfirmed: z.boolean().default(false),
    requiredQualifiers: z
      .array(z.enum(qualifierKeys))
      .max(qualifierKeys.length)
      .default([]),
    ...(Object.fromEntries(
      qualifierKeys.map((key) => [key, qualifier.nullable().optional()]),
    ) as { [K in QualifierKey]: z.ZodOptional<z.ZodNullable<typeof qualifier>> }),
    sourceReference: text(500).nullable().optional(),
    evidenceNotes: z.string().trim().min(1).max(2000).nullable().optional(),
    notes: z.string().trim().min(1).max(1000).nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.yearFrom != null && value.yearTo != null && value.yearFrom > value.yearTo)
      ctx.addIssue({
        code: "custom",
        path: ["yearTo"],
        message: "End year must not precede start year",
      });
    if (new Set(value.requiredQualifiers).size !== value.requiredQualifiers.length)
      ctx.addIssue({
        code: "custom",
        path: ["requiredQualifiers"],
        message: "Choose each qualifier once",
      });
    if (value.scope === "MODEL" && !value.vehicleModelId)
      ctx.addIssue({
        code: "custom",
        path: ["vehicleModelId"],
        message: "Choose a catalogue vehicle model",
      });
    if (
      value.scope === "UNIVERSAL" &&
      (value.vehicleModelId ||
        value.yearFrom ||
        value.yearTo ||
        value.safetyCritical ||
        value.effect === "EXCLUDE" ||
        value.requiredQualifiers.length ||
        qualifierKeys.some((key) => value[key]))
    )
      ctx.addIssue({
        code: "custom",
        path: ["scope"],
        message:
          "Universal accessories cannot have vehicle restrictions, safety-critical scope or exclusions",
      });
  });
export type RuleWrite = z.infer<typeof ruleWriteSchema>;
export const ruleUpdateSchema = ruleWriteSchema.safeExtend({
  expectedVersion: z.number().int().nonnegative(),
});
export const ruleTransitionSchema = z
  .object({
    action: z.enum(["SUBMIT", "APPROVE", "REJECT", "RETIRE"]),
    expectedVersion: z.number().int().nonnegative(),
    note: text(1000),
  })
  .strict();
export const fitmentDecisionSchema = z.object({
  status: z.enum(["VERIFIED_FIT", "NEEDS_VERIFICATION", "NOT_COMPATIBLE", "UNKNOWN"]),
  scope: z.enum(["MODEL", "UNIVERSAL"]).optional(),
  message: z.string(),
  missingQualifiers: z.array(z.enum(qualifierKeys)),
  matchedRuleIds: z.array(z.uuid()),
});
