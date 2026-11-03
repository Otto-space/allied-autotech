import { z } from "zod";
import { selectionSchema } from "../fitment/fitment.schemas.js";

const text = z
  .string()
  .trim()
  .min(10)
  .max(2000)
  .refine(
    (value) =>
      [...value].every((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code > 31 && code !== 127;
      }),
    "Use printable text",
  );
const revision = z.number().int().min(0).max(2147483646);
export const purchaseOfferAcceptanceSchema = z
  .object({ id: z.uuid(), revision: revision.min(1) })
  .strict()
  .describe(
    "Displayed checked offer. Required for a new order payment; omission only recovers an existing original-key receipt.",
  );
export type PurchaseOfferAcceptance = z.infer<typeof purchaseOfferAcceptanceSchema>;
export const purchaseRequirementsSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            orderItemId: z.uuid(),
            // Null is only eligible for an evidenced, non-critical universal accessory.
            // It is never interpreted as a wildcard for a vehicle-specific part.
            selection: selectionSchema.nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(200)
      .refine(
        (lines) => new Set(lines.map((line) => line.orderItemId)).size === lines.length,
        "Supply each order line once",
      ),
  })
  .strict();
export const purchaseReviewRequestSchema = purchaseRequirementsSchema
  .extend({
    expectedVersion: revision,
    expectedRevision: revision,
    reason: text,
  })
  .strict();
const supplierAvailability = z
  .object({
    kind: z.literal("SUPPLIER"),
    sourceReference: text,
    availableUntil: z.iso.datetime({ offset: true }),
    expectedFrom: z.iso.datetime({ offset: true }),
    expectedTo: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((value) => new Date(value.expectedFrom) <= new Date(value.expectedTo), {
    message: "Arrival range ends before it begins",
    path: ["expectedTo"],
  });
export const purchaseReviewDecisionSchema = z
  .object({
    expectedVersion: revision,
    expectedRevision: revision.min(1),
    reason: text,
    decision: z.enum(["APPROVED", "DECLINED"]),
    availability: z
      .array(
        z
          .object({
            orderItemId: z.uuid(),
            evidence: z.discriminatedUnion("kind", [
              z.object({ kind: z.literal("BRANCH_STOCK") }).strict(),
              supplierAvailability,
            ]),
          })
          .strict(),
      )
      .max(200),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.decision === "APPROVED") !== value.availability.length > 0)
      context.addIssue({
        code: "custom",
        path: ["availability"],
        message:
          "Approval needs availability evidence; decline must not claim availability",
      });
    if (
      new Set(value.availability.map((line) => line.orderItemId)).size !==
      value.availability.length
    )
      context.addIssue({
        code: "custom",
        path: ["availability"],
        message: "Supply each order line once",
      });
  });
export type PurchaseRequirements = z.infer<typeof purchaseRequirementsSchema>;
export type PurchaseReviewRequest = z.infer<typeof purchaseReviewRequestSchema>;
export type PurchaseReviewDecision = z.infer<typeof purchaseReviewDecisionSchema>;
export const purchaseReviewPaymentBindingSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().positive(),
    payableFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const purchaseApprovalSnapshotSchema = z
  .object({
    version: z.literal(1),
    fitment: z
      .array(
        z
          .object({
            orderItemId: z.uuid(),
            productId: z.uuid(),
            quantity: z.number().int().positive(),
            evidence: z
              .array(
                z
                  .object({
                    id: z.uuid(),
                    version: revision,
                    sourceReference: z.string().min(1).max(500),
                    reviewedByUserId: z.uuid(),
                    reviewedAt: z.iso.datetime(),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    availability: z
      .array(
        z
          .object({
            orderItemId: z.uuid(),
            evidence: z.union([
              z
                .object({
                  kind: z.literal("BRANCH_STOCK"),
                  inventoryId: z.uuid(),
                  reservationId: z.uuid(),
                  quantity: z.number().int().positive(),
                })
                .strict(),
              supplierAvailability,
            ]),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
