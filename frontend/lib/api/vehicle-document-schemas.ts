import { z } from "zod";

export const documentTypes = [
  "OWNERSHIP",
  "REGISTRATION",
  "CUSTOMS_CLEARANCE",
  "PURCHASE_RECEIPT",
  "INSPECTION_REPORT",
  "SERVICE_HISTORY",
  "OTHER",
] as const;
export const vehicleImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
});
export const vehicleDocumentSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(documentTypes),
  verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  mimeType: z.string().nullable(),
  sizeBytes: z.string().regex(/^\d+$/),
  issuedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string(),
});
export const conditionSummarySchema = z.object({
  id: z.string().uuid(),
  odometerKm: z.number().int().nullable(),
  conditionScore: z.number().int().nullable(),
  summary: z.string(),
  findings: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .nullable(),
  inspectedAt: z.string(),
});
export type VehicleDocument = z.infer<typeof vehicleDocumentSchema>;
