import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) =>
      [...s].every((c) => {
        const code = c.codePointAt(0) ?? 0;
        return code === 9 || code === 10 || code === 13 || code > 31;
      }),
    );
export const handoffTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("NEW_ENQUIRY"),
    branchId: z.uuid().optional(),
    subject: text(160),
  }),
  z.strictObject({
    kind: z.enum(["ENQUIRY", "COMPLAINT"]),
    id: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
  }),
]);
export const handoffDraftSchema = z.strictObject({
  target: handoffTargetSchema,
  summary: text(2000),
  excerpts: z
    .strictObject({
      conversationId: z.uuid(),
      expectedVersion: z.number().int().positive(),
      selections: z
        .array(
          z.strictObject({
            operationId: z.uuid(),
            part: z.enum(["QUESTION", "ANSWER"]),
          }),
        )
        .min(1)
        .max(2)
        .refine(
          (items) =>
            new Set(items.map((x) => x.operationId + x.part)).size === items.length,
        ),
    })
    .optional(),
});
export const handoffReviewSchema = z.strictObject({
  expiresAt: z.iso.datetime(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
export const handoffSubmitSchema = z.strictObject({
  draft: handoffDraftSchema,
  review: handoffReviewSchema,
  consent: z.literal(true),
});
export const handoffKeySchema = z
  .string()
  .regex(
    /^handoff-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
export const handoffHeadersSchema = z.object({ "idempotency-key": handoffKeySchema });
export const handoffReceiptParamsSchema = z.strictObject({
  operationKey: handoffKeySchema,
});
export const handoffReferenceSchema = z.strictObject({
  kind: z.enum(["ENQUIRY", "COMPLAINT"]),
  id: z.uuid(),
  branchId: z.uuid(),
  messageId: z.uuid().nullable(),
  createdNew: z.boolean(),
});
export const handoffPreviewSchema = z.strictObject({
  target: z.strictObject({
    kind: z.enum(["NEW_ENQUIRY", "ENQUIRY", "COMPLAINT"]),
    id: z.uuid().nullable(),
    branchId: z.uuid(),
    branchName: z.string(),
    subject: z.string(),
    version: z.number().int().nonnegative().nullable(),
  }),
  body: z.string().min(1).max(4000),
  audience: z.literal("CUSTOMER_CARE"),
  mode: z.literal("QUEUED"),
  excerptCount: z.number().int().min(0).max(2),
  review: handoffReviewSchema,
});
export const handoffSavedSchema = z.strictObject({
  reference: handoffReferenceSchema,
  replayed: z.boolean(),
  state: z.literal("SAVED"),
  mode: z.literal("QUEUED"),
});
export type HandoffDraft = z.infer<typeof handoffDraftSchema>;
export type HandoffSubmit = z.infer<typeof handoffSubmitSchema>;
export type HandoffReference = z.infer<typeof handoffReferenceSchema>;
export type HandoffExcerpts = NonNullable<HandoffDraft["excerpts"]>;
