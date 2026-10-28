import { z } from "zod";
import { countryCodes, europeanCountryCodes } from "../../common/reference/countries.js";
import { savedVehicleCursorSchema } from "./saved-vehicle-cursor.js";

const countryCode = z
  .string()
  .refine((v) => countryCodes.has(v), "Choose a valid ISO country code");
const queryInteger = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d{1,8}$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .optional();
const uuid = z.uuid();
const clean = (max: number) => z.string().trim().min(1).max(max);
const nullableClean = (max: number) => clean(max).nullable().optional();
const version = z.number().int().min(0).max(2_147_483_647);
const kobo = z.string().regex(/^[1-9][0-9]{0,15}$/, "Use positive integer kobo");
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const year = z
  .number()
  .int()
  .min(1886)
  .max(new Date().getUTCFullYear() + 1);
const optionalBoolean = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

export const vehicleEmptySchema = z.object({}).strict();
export const savedVehiclePageQuerySchema = z
  .object({
    cursor: savedVehicleCursorSchema.optional(),
    limit: z
      .string()
      .regex(/^(?:[1-9]|[1-4][0-9]|50)$/)
      .default("12")
      .transform(Number),
  })
  .strict();
export type SavedVehiclePageQuery = z.infer<typeof savedVehiclePageQuerySchema>;
export const vehicleParamsSchema = z.object({ vehicleId: uuid }).strict();
export const listingParamsSchema = z.object({ listingId: uuid }).strict();
export const imageParamsSchema = z.object({ imageId: uuid }).strict();
export const documentParamsSchema = z
  .object({ vehicleId: uuid, documentId: uuid })
  .strict();

const enumSelections = <T extends string>(options: readonly T[]) =>
  z
    .string()
    .min(1)
    .max(100)
    .describe(
      `Comma-separated distinct choices: ${options.join(", ")}. Matches any selected choice; do not combine with the singular filter.`,
    )
    .transform((value) => value.split(","))
    .pipe(
      z
        .array(z.enum(options as [T, ...T[]]))
        .min(1)
        .max(options.length),
    )
    .refine(
      (values) => new Set(values).size === values.length,
      "Choose each option only once",
    )
    .transform((values) => options.filter((option) => values.includes(option)))
    .optional();

export const publicVehicleListQueryBase = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    search: clean(100).optional(),
    location: clean(80)
      .optional()
      .describe("Literal branch city or state; not a vehicle import origin"),
    make: clean(80).optional(),
    model: clean(80).optional(),
    year: z.coerce.number().int().min(1886).max(2200).optional(),
    trim: clean(80).optional(),
    condition: z.enum(["NEW", "USED", "FOREIGN_USED", "LOCALLY_USED"]).optional(),
    conditions: enumSelections(["NEW", "USED", "FOREIGN_USED", "LOCALLY_USED"] as const),
    powertrains: enumSelections(["BEV", "HEV", "PHEV", "ICE"] as const),
    manufactureCountryCode: countryCode.optional(),
    manufactureRegion: z.literal("EUROPE").optional(),
    powertrain: z.enum(["BEV", "HEV", "PHEV", "ICE"]).optional(),
    driveType: z.enum(["FWD", "RWD", "AWD", "FOUR_WD", "OTHER"]).optional(),
    minYear: queryInteger(1886, 2200),
    maxYear: queryInteger(1886, 2200),
    minMileageKm: queryInteger(0, 10000000),
    maxMileageKm: queryInteger(0, 10000000),
    minEngineCapacityCc: queryInteger(1, 30000),
    maxEngineCapacityCc: queryInteger(1, 30000),
    seats: queryInteger(1, 100),
    color: clean(40).optional(),
    feature: clean(80).optional(),
    inspected: optionalBoolean,
    bodyType: z
      .enum([
        "CROSSOVER",
        "MINIVAN",
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
      ])
      .optional(),
    transmission: z.enum(["AUTOMATIC", "MANUAL", "CVT", "OTHER"]).optional(),
    fuelType: z.enum(["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "OTHER"]).optional(),
    featured: optionalBoolean,
    minPriceKobo: z.union([z.literal("0"), kobo]).optional(),
    maxPriceKobo: z.union([z.literal("0"), kobo]).optional(),
    sort: z
      .enum([
        "newest",
        "price_asc",
        "price_desc",
        "year_desc",
        "year_asc",
        "mileage_asc",
        "mileage_desc",
      ])
      .default("newest"),
  })
  .strict();
export function checkPublicVehicleQuery(
  v: Omit<z.infer<typeof publicVehicleListQueryBase>, "sort">,
  ctx: z.RefinementCtx,
) {
  if (
    v.minPriceKobo !== undefined &&
    v.maxPriceKobo !== undefined &&
    BigInt(v.minPriceKobo) > BigInt(v.maxPriceKobo)
  )
    ctx.addIssue({
      code: "custom",
      path: ["maxPriceKobo"],
      message: "Must be at least minPriceKobo",
    });
  for (const [single, multiple] of [
    ["condition", "conditions"],
    ["powertrain", "powertrains"],
  ] as const) {
    if (v[single] && v[multiple])
      ctx.addIssue({
        code: "custom",
        path: [multiple],
        message: `Use either ${single} or ${multiple}`,
      });
  }
  for (const [minimum, maximum] of [
    ["minYear", "maxYear"],
    ["minMileageKm", "maxMileageKm"],
    ["minEngineCapacityCc", "maxEngineCapacityCc"],
  ] as const) {
    if (v[minimum] !== undefined && v[maximum] !== undefined && v[minimum]! > v[maximum]!)
      ctx.addIssue({
        code: "custom",
        path: [maximum],
        message: `Must be at least ${minimum}`,
      });
  }
  if (v.model && !v.make)
    ctx.addIssue({
      code: "custom",
      path: ["model"],
      message: "Choose a make before a model",
    });
  if (
    v.year !== undefined &&
    ((v.minYear !== undefined && v.year < v.minYear) ||
      (v.maxYear !== undefined && v.year > v.maxYear))
  )
    ctx.addIssue({
      code: "custom",
      path: ["year"],
      message: "Year conflicts with the selected range",
    });
  if (
    v.manufactureRegion &&
    v.manufactureCountryCode &&
    !(europeanCountryCodes as readonly string[]).includes(v.manufactureCountryCode)
  )
    ctx.addIssue({
      code: "custom",
      path: ["manufactureCountryCode"],
      message: "Country is outside Europe",
    });
}
export const publicVehicleListQuerySchema = publicVehicleListQueryBase.superRefine(
  checkPublicVehicleQuery,
);
export const staffVehicleListQuerySchema = publicVehicleListQuerySchema
  .safeExtend({
    sort: z
      .enum(["newest", "year_desc", "year_asc", "mileage_asc", "mileage_desc"])
      .default("newest"),
    status: z
      .enum(["DRAFT", "AVAILABLE", "RESERVED", "SOLD", "INACTIVE", "ARCHIVED"])
      .optional(),
    branchId: uuid.optional(),
    listed: optionalBoolean,
  })
  .refine((value) => value.listed !== false || value.status === undefined, {
    path: ["listed"],
    message: "An unlisted record cannot have a listing status",
  })
  .refine(
    (value) =>
      value.listed !== false ||
      (value.featured === undefined &&
        value.minPriceKobo === undefined &&
        value.maxPriceKobo === undefined),
    {
      path: ["listed"],
      message: "An unlisted record cannot have listing-specific filters",
    },
  );

export const vehicleCreateBodySchema = z
  .object({
    branchId: uuid,
    stockNumber: clean(40)
      .transform((v) => v.toUpperCase())
      .refine(
        (v) => v.length <= 40,
        "Stock number must fit 40 characters after capitalization",
      ),
    make: clean(80),
    model: clean(80),
    trim: nullableClean(80),
    year,
    mileageKm: z.number().int().min(0).max(10_000_000).nullable().optional(),
    transmission: z.enum(["AUTOMATIC", "MANUAL", "CVT", "OTHER"]).nullable().optional(),
    fuelType: z
      .enum(["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "OTHER"])
      .nullable()
      .optional(),
    condition: z.enum(["NEW", "USED", "FOREIGN_USED", "LOCALLY_USED"]).default("USED"),
    bodyType: z
      .enum([
        "CROSSOVER",
        "MINIVAN",
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
      ])
      .nullable()
      .optional(),
    manufactureCountryCode: countryCode.nullable().optional(),
    powertrain: z.enum(["BEV", "HEV", "PHEV", "ICE"]).nullable().optional(),
    engineCapacityCc: z.number().int().min(1).max(30000).nullable().optional(),
    features: z
      .array(clean(80))
      .max(40)
      .refine(
        (v) => new Set(v.map((f) => f.toLowerCase())).size === v.length,
        "Features must be unique",
      )
      .optional(),
    engineCode: nullableClean(40),
    cylinders: z.number().int().min(1).max(24).nullable().optional(),
    ownerReportedCondition: nullableClean(2000),
    ownerReportedIssues: nullableClean(4000),
    engineSize: nullableClean(40),
    driveType: z.enum(["FWD", "RWD", "AWD", "FOUR_WD", "OTHER"]).nullable().optional(),
    color: nullableClean(40),
    doors: z.number().int().min(1).max(20).nullable().optional(),
    seats: z.number().int().min(1).max(100).nullable().optional(),
    vin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NPR-Z0-9]{17}$/)
      .nullable()
      .optional(),
    chassisNumber: nullableClean(80),
    registrationNumber: nullableClean(80),
    acquisitionCostKobo: kobo.nullable().optional(),
    acquiredAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();
export const vehicleUpdateBodySchema = vehicleCreateBodySchema
  .omit({ branchId: true, stockNumber: true })
  .partial()
  .safeExtend({ expectedVersion: version })
  .refine((value) => Object.keys(value).length > 1, "At least one change is required");
export const listingCreateBodySchema = z
  .object({
    vehicleId: uuid,
    title: clean(180),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(180),
    priceKobo: kobo,
    description: nullableClean(10_000),
    featured: z.boolean().default(false),
  })
  .strict();
export const listingUpdateBodySchema = z
  .object({
    expectedVersion: version,
    title: clean(180).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(180)
      .optional(),
    description: nullableClean(10_000),
    featured: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, "At least one change is required");
export const listingStatusBodySchema = z
  .object({
    expectedVersion: version,
    status: z.enum(["AVAILABLE", "INACTIVE", "ARCHIVED"]),
  })
  .strict();
export const listingPriceBodySchema = z
  .object({
    expectedVersion: version,
    priceKobo: kobo,
    reason: clean(500),
  })
  .strict();

export const assetUploadBodySchema = z
  .object({
    kind: z.enum(["IMAGE", "DOCUMENT", "CONDITION_REPORT", "HANDOVER"]),
    replaceImageId: uuid.optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    sizeBytes: z
      .number()
      .int()
      .min(1)
      .max(20 * 1024 * 1024),
    checksumSha256: sha256,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.replaceImageId !== undefined && value.kind !== "IMAGE")
      context.addIssue({
        code: "custom",
        path: ["replaceImageId"],
        message: "Only image uploads support replacement",
      });
    if (value.kind === "IMAGE" && value.mimeType === "application/pdf")
      context.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: "Images must use an allowed raster format",
      });
    if (
      (value.kind === "CONDITION_REPORT" || value.kind === "HANDOVER") &&
      value.mimeType !== "application/pdf"
    )
      context.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: "This asset must be a PDF",
      });
    if (value.kind === "IMAGE" && value.sizeBytes > 10 * 1024 * 1024)
      context.addIssue({
        code: "custom",
        path: ["sizeBytes"],
        message: "Image exceeds 10 MB",
      });
  });
const assetToken = z.string().min(40).max(4096);
export const imageCreateBodySchema = z
  .object({
    expectedVersion: version.optional(),
    replaceImageId: uuid.optional(),
    assetToken,
    altText: nullableClean(240),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    isPrimary: z.boolean().default(false),
  })
  .strict()
  .refine(
    (value) => value.replaceImageId === undefined || value.expectedVersion !== undefined,
    "Replacement requires expectedVersion",
  );
export const documentCreateBodySchema = z
  .object({
    assetToken,
    type: z.enum([
      "OWNERSHIP",
      "REGISTRATION",
      "CUSTOMS_CLEARANCE",
      "PURCHASE_RECEIPT",
      "INSPECTION_REPORT",
      "SERVICE_HISTORY",
      "OTHER",
    ]),
    issuedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();
export const documentReviewBodySchema = z
  .object({
    expectedVersion: version,
    status: z.enum(["VERIFIED", "REJECTED"]),
    rejectionReason: clean(1000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "REJECTED" && value.rejectionReason === undefined)
      context.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Required when rejected",
      });
    if (value.status === "VERIFIED" && value.rejectionReason !== undefined)
      context.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Not allowed when verified",
      });
  });
export const conditionReportBodySchema = z
  .object({
    inspectionId: uuid.nullable().optional(),
    odometerKm: z.number().int().min(0).max(10_000_000).nullable().optional(),
    conditionScore: z.number().int().min(0).max(100).nullable().optional(),
    summary: clean(5000),
    findings: z
      .record(
        z.string().max(100),
        z.union([z.string().max(1000), z.number(), z.boolean(), z.null()]),
      )
      .optional(),
    inspectedAt: z.iso.datetime({ offset: true }),
    assetToken: assetToken.optional(),
  })
  .strict();

export type PublicVehicleListQuery = z.infer<typeof publicVehicleListQuerySchema>;
export type StaffVehicleListQuery = z.infer<typeof staffVehicleListQuerySchema>;
export type VehicleCreateInput = z.infer<typeof vehicleCreateBodySchema>;
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateBodySchema>;
export type ListingCreateInput = z.infer<typeof listingCreateBodySchema>;
export type ListingUpdateInput = z.infer<typeof listingUpdateBodySchema>;
export type ListingStatusInput = z.infer<typeof listingStatusBodySchema>;
export type ListingPriceInput = z.infer<typeof listingPriceBodySchema>;
export type AssetUploadInput = z.infer<typeof assetUploadBodySchema>;
export type ImageCreateInput = z.infer<typeof imageCreateBodySchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateBodySchema>;
export type DocumentReviewInput = z.infer<typeof documentReviewBodySchema>;
export type ConditionReportInput = z.infer<typeof conditionReportBodySchema>;
