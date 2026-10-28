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

export const publishedCompatibilitySchema = z.object({
  id: z.uuid(),
  make: z.string(),
  model: z.string().nullable(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  notes: z.string().nullable(),
  scope: z.enum(["MODEL", "UNIVERSAL"]),
  requiredQualifiers: z.array(z.enum(qualifierKeys)),
  ...(Object.fromEntries(qualifierKeys.map((key) => [key, z.string().nullable()])) as {
    [K in QualifierKey]: z.ZodNullable<z.ZodString>;
  }),
});

const timestamp = z.iso.datetime({ offset: true });
const nullableQualifierResponses = Object.fromEntries(
  qualifierKeys.map((key) => [key, z.string().nullable()]),
) as { [K in QualifierKey]: z.ZodNullable<z.ZodString> };
const accountResponse = z.object({
  id: z.uuid(),
  email: z.email(),
  staffProfile: z.object({ firstName: z.string(), lastName: z.string() }).nullable(),
});
const optionResponse = z.object({ id: z.uuid(), name: z.string() });
export const modelResponseSchema = optionResponse.extend({
  makeId: z.uuid(),
  yearFrom: z.number().int(),
  yearTo: z.number().int(),
});
export const modelDetailResponseSchema = modelResponseSchema.extend({
  make: optionResponse,
});
export const fitmentProductResponseSchema = optionResponse.extend({
  sku: z.string(),
  isActive: z.boolean(),
  productType: z.string().nullable(),
});
export const fitmentAccessResponseSchema = z.object({
  canAuthor: z.boolean(),
  canReview: z.boolean(),
  globalAuthor: z.boolean(),
  globalReviewer: z.boolean(),
  authorBranches: z.array(z.uuid()),
  reviewBranches: z.array(z.uuid()),
  branches: z.array(optionResponse),
});
export const ruleRecordResponseSchema = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  vehicleModelId: z.uuid().nullable(),
  branchId: z.uuid().nullable(),
  scope: z.enum(["MODEL", "UNIVERSAL"]),
  effect: z.enum(["INCLUDE", "EXCLUDE"]),
  reviewStatus: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED", "RETIRED"]),
  safetyCritical: z.boolean(),
  allVariantsConfirmed: z.boolean(),
  requiredQualifiers: z.array(z.string()),
  ...nullableQualifierResponses,
  make: z.string(),
  model: z.string().nullable(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  sourceReference: z.string().nullable(),
  evidenceNotes: z.string().nullable(),
  reviewNote: z.string().nullable(),
  notes: z.string().nullable(),
  createdByUserId: z.uuid().nullable(),
  updatedByUserId: z.uuid().nullable(),
  reviewedByUserId: z.uuid().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  submittedAt: timestamp.nullable(),
  reviewedAt: timestamp.nullable(),
  version: z.number().int().nonnegative(),
});
export const staffRuleResponseSchema = ruleRecordResponseSchema.extend({
  product: fitmentProductResponseSchema.pick({ id: true, name: true, sku: true }),
  vehicleModel: modelDetailResponseSchema.nullable(),
  createdBy: accountResponse.nullable(),
  updatedBy: accountResponse.nullable(),
  reviewedBy: accountResponse.nullable(),
});
const pageResponse = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.uuid().optional() });
export const fitmentResponseSchemas = {
  makes: pageResponse(optionResponse),
  models: pageResponse(modelResponseSchema),
  model: modelDetailResponseSchema,
  years: z.object({ years: z.array(z.number().int()) }),
  productFitment: fitmentDecisionSchema,
  access: fitmentAccessResponseSchema,
  products: pageResponse(fitmentProductResponseSchema),
  product: fitmentProductResponseSchema,
  rules: pageResponse(staffRuleResponseSchema),
  rule: staffRuleResponseSchema,
  history: pageResponse(
    z.object({
      id: z.uuid(),
      compatibilityId: z.uuid(),
      actorUserId: z.uuid(),
      actor: accountResponse,
      action: z.string(),
      version: z.number().int(),
      snapshot: z.record(z.string(), z.unknown()),
      createdAt: timestamp,
    }),
  ),
  createMake: optionResponse,
  createModel: modelResponseSchema,
  createRule: ruleRecordResponseSchema,
  updateRule: ruleRecordResponseSchema,
  transition: ruleRecordResponseSchema,
};
