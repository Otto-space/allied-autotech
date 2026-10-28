import { z } from "zod";
import { supportReplyHeadersSchema, supportReplyKeySchema } from "./support.schemas.js";

const revision = z.number().int().min(0).max(2147483646);
export const supportChannelTargetSchema = z.strictObject({
  kind: z.enum(["ENQUIRY", "COMPLAINT"]),
  id: z.uuid(),
});
export const supportChannelRequestSchema = z.strictObject({
  target: supportChannelTargetSchema,
  expectedCaseVersion: revision,
  expectedChannelVersion: revision,
  assistantContext: z
    .strictObject({
      conversationId: z.uuid(),
      expectedVersion: revision.refine((n) => n > 0),
    })
    .optional(),
});
export const supportChannelActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("claim"), expectedVersion: revision }),
  z.strictObject({
    action: z.literal("transfer"),
    expectedVersion: revision,
    targetStaffId: z.uuid(),
    reason: z.string().trim().min(5).max(300),
  }),
  z.strictObject({ action: z.literal("end"), expectedVersion: revision }),
]);
export const supportChannelParamsSchema = z.strictObject({ channelId: z.uuid() });
export const supportChannelHeadersSchema = supportReplyHeadersSchema;
export const supportChannelOperationSchema = z.strictObject({
  action: z.enum(["request", "claim", "transfer", "end"]),
  operationKey: supportReplyKeySchema,
});
export const supportChannelCancelSchema = z.strictObject({
  target: supportChannelTargetSchema,
});
export const supportChannelCursorSchema = z
  .string()
  .min(80)
  .max(2048)
  .regex(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
export const supportChannelQueueSchema = z.strictObject({
  kind: z.enum(["ENQUIRY", "COMPLAINT"]).optional(),
  state: z.enum(["ACTIVE", "QUEUED", "HUMAN_ACTIVE", "ENDED"]).default("ACTIVE"),
  branchId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  cursor: supportChannelCursorSchema.optional(),
});
export const supportChannelCandidatesSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(25).default(10),
  cursor: supportChannelCursorSchema.optional(),
});
export const supportChannelSchema = z.strictObject({
  id: z.uuid(),
  target: supportChannelTargetSchema,
  branchId: z.uuid(),
  state: z.enum(["QUEUED", "HUMAN_ACTIVE", "ENDED"]),
  version: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  queuedSince: z.iso.datetime().nullable(),
  claimedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  latestPublicMessageId: z.uuid().nullable(),
  assignedToYou: z.boolean(),
  canClaim: z.boolean(),
  canTransfer: z.boolean(),
  canEnd: z.boolean(),
  pollAfterMs: z.literal(5000),
});
export const supportChannelQueuePageSchema = z.strictObject({
  items: z.array(supportChannelSchema),
  nextCursor: supportChannelCursorSchema.optional(),
  pollAfterMs: z.literal(5000),
});
export const supportChannelCandidatesPageSchema = z.strictObject({
  items: z.array(z.strictObject({ staffId: z.uuid(), name: z.string().min(1).max(201) })),
  nextCursor: supportChannelCursorSchema.optional(),
});
export const supportChannelOperationOutcomeSchema = z.discriminatedUnion("state", [
  z.strictObject({
    action: z.enum(["request", "claim", "transfer", "end"]),
    state: z.literal("SAVED"),
    channel: supportChannelSchema,
  }),
  z.strictObject({
    action: z.enum(["request", "claim", "transfer", "end"]),
    state: z.literal("CANCELLED"),
    channel: z.null(),
  }),
]);
