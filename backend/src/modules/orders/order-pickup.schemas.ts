import { z } from "zod";
import { pickupCodeSchema, pickupLinesSchema } from "./order-pickup.engine.js";
const version = z.number().int().min(0).max(2147483647);
const paragraph = (minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine(
      (value) =>
        [...value].every(
          (character) =>
            (character.codePointAt(0) ?? 0) > 31 && character.codePointAt(0) !== 127,
        ),
      "Use one paragraph without control characters",
    );
export const pickupIssueSchema = z
  .object({
    expectedVersion: version,
    idempotencyKey: z.uuid(),
    lines: pickupLinesSchema,
  })
  .strict();
export const pickupRevokeSchema = z
  .object({
    expectedVersion: version,
    authorisationId: z.uuid(),
    reason: paragraph(1, 500),
  })
  .strict();
export const pickupVerifySchema = z
  .object({
    expectedVersion: version,
    pickupCode: pickupCodeSchema,
    lines: pickupLinesSchema,
  })
  .strict();
export const pickupHandoverSchema = pickupVerifySchema
  .extend({
    authorisationId: z.uuid(),
    claimId: z.uuid(),
    financialReviewHash: z.string().regex(/^[0-9a-f]{64}$/),
    idempotencyKey: z.uuid(),
    collectorName: paragraph(1, 120),
    verificationNote: paragraph(12, 1000),
    physicalHandoverConfirmed: z.literal(true),
  })
  .strict();

export const pickupCancelClaimSchema = z
  .object({
    expectedVersion: version,
    claimId: z.uuid(),
    reason: paragraph(12, 1000),
    goodsNotHandedOverConfirmed: z.literal(true),
  })
  .strict();
