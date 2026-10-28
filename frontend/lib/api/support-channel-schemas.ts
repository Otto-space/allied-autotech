import { z } from "zod";
const stamp = z.iso.datetime({ offset: true });
export const careChannelSchema = z.strictObject({
  id: z.uuid(),
  target: z.strictObject({ kind: z.enum(["ENQUIRY", "COMPLAINT"]), id: z.uuid() }),
  branchId: z.uuid(),
  state: z.enum(["QUEUED", "HUMAN_ACTIVE", "ENDED"]),
  version: z.number().int().nonnegative(),
  updatedAt: stamp,
  queuedSince: stamp.nullable(),
  claimedAt: stamp.nullable(),
  endedAt: stamp.nullable(),
  latestPublicMessageId: z.uuid().nullable(),
  assignedToYou: z.boolean(),
  canClaim: z.boolean(),
  canTransfer: z.boolean(),
  canEnd: z.boolean(),
  pollAfterMs: z.literal(5000),
});
export type CareChannel = z.infer<typeof careChannelSchema>;
export const careChannelLookupSchema = z.strictObject({
  channel: careChannelSchema.nullable(),
  caseVersion: z.number().int().nonnegative(),
  latestPublicMessageId: z.uuid().nullable(),
});
export const careChannelSavedSchema = careChannelSchema.extend({ replayed: z.boolean() });
const action = z.enum(["request", "claim", "transfer", "end"]);
export const careChannelOutcomeSchema = z.discriminatedUnion("state", [
  z.strictObject({ action, state: z.literal("SAVED"), channel: careChannelSchema }),
  z.strictObject({ action, state: z.literal("CANCELLED"), channel: z.null() }),
]);
export const careChannelCandidatesSchema = z.strictObject({
  items: z.array(z.strictObject({ staffId: z.uuid(), name: z.string().min(1).max(201) })),
  nextCursor: z.string().max(2048).optional(),
});
export const careChannelQueueSchema = z.strictObject({
  items: z.array(careChannelSchema),
  nextCursor: z.string().max(2048).optional(),
  pollAfterMs: z.literal(5000),
});
export const carePresenceSchema = z.strictObject({
  enabled: z.boolean(),
  version: z.number().int().nonnegative(),
  branchId: z.uuid().nullable(),
  optedIn: z.boolean(),
  expiresAt: stamp.nullable(),
  capacity: z.number().int().min(1).max(5),
  eligibleBranches: z.array(
    z.strictObject({
      branchId: z.uuid(),
      kinds: z.array(z.enum(["ENQUIRY", "COMPLAINT"])),
    }),
  ),
});
export const careAvailabilitySchema = z.strictObject({
  branchId: z.uuid(),
  kind: z.enum(["ENQUIRY", "COMPLAINT"]),
  state: z.enum(["disabled", "after_hours", "unavailable", "available"]),
  checkedAt: stamp,
  channel: z.literal("queued_customer_care"),
});
export function assertChannelTarget(
  channel: CareChannel,
  kind: "enquiries" | "complaints",
  id: string,
) {
  if (
    channel.target.id !== id ||
    channel.target.kind !== (kind === "enquiries" ? "ENQUIRY" : "COMPLAINT")
  )
    throw new Error("The conversation response does not match this case.");
  return channel;
}
