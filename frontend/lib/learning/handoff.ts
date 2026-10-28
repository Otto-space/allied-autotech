import { z } from "zod";
import { supportText } from "../api/support-schemas";
import type { AllieConversation } from "./conversation";

const targetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("NEW_ENQUIRY"),
    branchId: z.uuid().optional(),
    subject: supportText(160),
  }),
  z.strictObject({
    kind: z.enum(["ENQUIRY", "COMPLAINT"]),
    id: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
  }),
]);
export const handoffDraftSchema = z.strictObject({
  target: targetSchema,
  summary: supportText(2000),
  excerpts: z
    .strictObject({
      conversationId: z.uuid(),
      expectedVersion: z.number().int().positive(),
      selections: z
        .array(
          z.strictObject({ operationId: z.uuid(), part: z.enum(["QUESTION", "ANSWER"]) }),
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
const reviewSchema = z.strictObject({
  expiresAt: z.iso.datetime(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
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
  review: reviewSchema,
  recoveryExpiresAt: z.iso.datetime(),
});
const referenceSchema = z
  .strictObject({
    kind: z.enum(["ENQUIRY", "COMPLAINT"]),
    id: z.uuid(),
    branchId: z.uuid(),
    messageId: z.uuid().nullable(),
    createdNew: z.boolean(),
  })
  .refine((ref) =>
    ref.createdNew
      ? ref.kind === "ENQUIRY" && ref.messageId === null
      : ref.messageId !== null,
  );
export const handoffSavedSchema = z.strictObject({
  reference: referenceSchema,
  replayed: z.boolean(),
  state: z.literal("SAVED"),
  mode: z.literal("QUEUED"),
});
export const handoffCancelledSchema = z.strictObject({
  state: z.literal("CANCELLED"),
  cancelled: z.literal(true),
});
export const handoffRecoverySchema = z.union([
  handoffSavedSchema,
  handoffCancelledSchema,
  z.strictObject({
    state: z.literal("REVIEW"),
    draft: handoffDraftSchema,
    preview: handoffPreviewSchema,
    expiresAt: z.iso.datetime(),
  }),
  z.strictObject({
    state: z.literal("NEEDS_REVIEW"),
    draft: handoffDraftSchema,
    preview: z.null(),
    expiresAt: z.iso.datetime(),
    excerptsCleared: z.boolean(),
  }),
]);
export type HandoffDraft = z.infer<typeof handoffDraftSchema>;
export type HandoffPreview = z.infer<typeof handoffPreviewSchema>;
export type HandoffSaved = z.infer<typeof handoffSavedSchema>;

/** Independently bind the exact proposed body to selected current visible help.
 * A server response cannot silently add an unselected transcript or target.
 */
export function handoffBody(draft: HandoffDraft, conversation: AllieConversation | null) {
  const parts: string[] = [];
  if (draft.excerpts) {
    if (
      !conversation ||
      conversation.audience !== "customer" ||
      conversation.id !== draft.excerpts.conversationId ||
      conversation.version !== draft.excerpts.expectedVersion ||
      conversation.historyReset ||
      Date.parse(conversation.expiresAt) <= Date.now()
    )
      throw new Error("Help context changed");
    for (const selection of draft.excerpts.selections) {
      const message = conversation.messages.find(
        (m) => m.operationId === selection.operationId,
      );
      if (!message) throw new Error("Selected help is unavailable");
      parts.push(
        selection.part === "QUESTION"
          ? `You (selected help question):\n${message.question}`
          : `Allie (AI-generated guidance; may be wrong):\n${[message.answer.answer, ...message.answer.steps.map((s, i) => `${i + 1}. ${s}`), ...(message.answer.caveat ? [message.answer.caveat] : [])].join("\n")}`,
      );
    }
  }
  return [
    "Customer Care handoff — reviewed by the customer",
    "Issue summary (customer editable):",
    draft.summary,
    ...(parts.length
      ? [
          "Selected help excerpts (shared with permission; AI guidance is not verified case evidence):",
          ...parts,
        ]
      : []),
  ].join("\n\n");
}
export function parseHandoffPreview(
  value: unknown,
  rawDraft: HandoffDraft,
  conversation: AllieConversation | null,
) {
  const draft = handoffDraftSchema.parse(rawDraft),
    preview = handoffPreviewSchema.parse(value),
    target = draft.target;
  if (
    preview.body !== handoffBody(draft, conversation) ||
    preview.excerptCount !== (draft.excerpts?.selections.length ?? 0) ||
    Date.parse(preview.review.expiresAt) <= Date.now() ||
    Date.parse(preview.recoveryExpiresAt) <= Date.now() ||
    preview.target.kind !== target.kind
  )
    throw new Error("Unconfirmed handoff preview");
  if (
    target.kind === "NEW_ENQUIRY"
      ? preview.target.id !== null ||
        preview.target.version !== null ||
        preview.target.subject !== target.subject ||
        (target.branchId !== undefined && preview.target.branchId !== target.branchId)
      : preview.target.id !== target.id ||
        preview.target.version !== target.expectedVersion
  )
    throw new Error("Unconfirmed handoff destination");
  return preview;
}
export function parseHandoffSaved(value: unknown, preview?: HandoffPreview) {
  const saved = handoffSavedSchema.parse(value);
  if (
    preview &&
    (saved.reference.branchId !== preview.target.branchId ||
      (preview.target.kind === "NEW_ENQUIRY"
        ? !saved.reference.createdNew
        : saved.reference.createdNew ||
          saved.reference.kind !== preview.target.kind ||
          saved.reference.id !== preview.target.id))
  )
    throw new Error("Unconfirmed handoff receipt");
  return saved;
}
export function handoffHref(saved: HandoffSaved) {
  const ref = handoffSavedSchema.parse(saved).reference;
  return `/dashboard/support/${ref.kind === "COMPLAINT" ? "complaints" : "enquiries"}/${ref.id}`;
}
