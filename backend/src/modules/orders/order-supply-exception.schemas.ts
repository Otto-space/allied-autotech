import { z } from "zod";
import {
  affectedUnitRangesSchema,
  supplyExceptionKind,
} from "./order-supply-exception.engine.js";
const paragraph = z
  .string()
  .trim()
  .min(12)
  .max(1000)
  .refine(
    (value) =>
      [...value].every(
        (character) =>
          (character.codePointAt(0) ?? 0) > 31 && character.codePointAt(0) !== 127,
      ),
    "Use one paragraph without control characters",
  );
export const supplyExceptionRaiseSchema = z
  .object({
    expectedVersion: z.number().int().min(0).max(2147483647),
    idempotencyKey: z.uuid(),
    kind: supplyExceptionKind,
    affectedLines: affectedUnitRangesSchema,
    customerNote: paragraph,
    reason: paragraph,
    actualConcernConfirmed: z.literal(true),
  })
  .strict();

export const supplyRemedyChoiceSchema = z
  .object({
    expectedVersion: z.number().int().min(0).max(2147483647),
    idempotencyKey: z.uuid(),
    supplyExceptionId: z.uuid(),
    choice: z.enum(["REFUND_REVIEW", "SUITABLE_ALTERNATIVE_REVIEW", "TECHNICAL_REVIEW"]),
    customerNote: paragraph.optional(),
    statementVersion: z.literal("SUPPLY_CHOICE_20261110_V1"),
    choiceConfirmed: z.literal(true),
  })
  .strict();

export const supplyResolutionSchema = z
  .object({
    expectedVersion: z.number().int().min(0).max(2147483647),
    idempotencyKey: z.uuid(),
    supplyExceptionId: z.uuid(),
    reason: paragraph,
    settlementAndPhysicalHistoryReviewed: z.literal(true),
  })
  .strict();
