import { z } from "zod";

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
export const vehicleParamsSchema = z.object({ vehicleId: uuid }).strict();
export const listingParamsSchema = z.object({ listingId: uuid }).strict();
export const imageParamsSchema = z.object({ imageId: uuid }).strict();
export const documentParamsSchema = z
  .object({ vehicleId: uuid, documentId: uuid })
  .strict();

export const publicVehicleListQuerySchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    search: clean(100).optional(),
    make: clean(80).optional(),
    model: clean(80).optional(),
    year: z.coerce.number().int().min(1886).max(2200).optional(),
    bodyType: z
      .enum([
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
    minPriceKobo: kobo.optional(),
    maxPriceKobo: kobo.optional(),
    sort: z.enum(["newest", "price_asc", "price_desc", "year_desc"]).default("newest"),
  })
  .strict()
  .refine(
    (value) =>
      value.minPriceKobo === undefined ||
      value.maxPriceKobo === undefined ||
      BigInt(value.minPriceKobo) <= BigInt(value.maxPriceKobo),
    { path: ["maxPriceKobo"], message: "Must be at least minPriceKobo" },
  );
export const staffVehicleListQuerySchema = publicVehicleListQuerySchema.safeExtend({
  status: z
    .enum(["DRAFT", "AVAILABLE", "RESERVED", "SOLD", "INACTIVE", "ARCHIVED"])
    .optional(),
  branchId: uuid.optional(),
});

export const vehicleCreateBodySchema = z
  .object({
    branchId: uuid,
    stockNumber: clean(40).transform((v) => v.toUpperCase()),
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
    condition: z.enum(["NEW", "USED"]).default("USED"),
    bodyType: z
      .enum([
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
    assetToken,
    altText: nullableClean(240),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    isPrimary: z.boolean().default(false),
  })
  .strict();
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
