import { z } from "zod";
import {
  customerEnquiryRequestSchema,
  customerComplaintRequestSchema,
  type SupportKind,
} from "../api/support-schemas";
import { draftIdentity } from "../forms/drafts";

const prefix = "aat:support-create:v1:";
export const supportCreationKeySchema = z
  .string()
  .regex(
    /^support-create-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const intentFields = { owner: z.uuid(), key: supportCreationKeySchema };
export const supportCreationIntentSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...intentFields,
      kind: z.literal("enquiries"),
      body: customerEnquiryRequestSchema,
    })
    .strict(),
  z
    .object({
      ...intentFields,
      kind: z.literal("complaints"),
      body: customerComplaintRequestSchema,
    })
    .strict(),
]);
export type SupportCreationIntent = z.infer<typeof supportCreationIntentSchema>;
export type SupportCreationRecovery =
  | { kind: "pending"; intent: SupportCreationIntent }
  | { kind: "history" }
  | { kind: "unavailable" };
export function supportCreationIntentActive(
  intent: SupportCreationIntent,
  now = Date.now(),
) {
  const issued = Number(intent.key.split(".")[1]);
  return now >= issued && now < issued + 24 * 60 * 60 * 1000;
}
export function readSupportCreationRecovery(
  owner: string,
  kind: SupportKind,
): SupportCreationRecovery | undefined {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(`${prefix}${owner}:${kind}`);
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return;
  try {
    if (raw.length > 20000) return { kind: "history" };
    const value = supportCreationIntentSchema.parse(JSON.parse(raw));
    if (
      value.owner !== owner ||
      value.kind !== kind ||
      !supportCreationIntentActive(value)
    )
      return { kind: "history" };
    return { kind: "pending", intent: value };
  } catch {
    return { kind: "history" };
  }
}
export function saveSupportCreationRecovery(value: SupportCreationIntent) {
  const intent = supportCreationIntentSchema.parse(value);
  if (draftIdentity() !== `${intent.owner}:CUSTOMER`)
    throw new Error("SupportCreation draft account changed");
  const raw = JSON.stringify(intent);
  sessionStorage.setItem(`${prefix}${intent.owner}:${intent.kind}`, raw);
  if (sessionStorage.getItem(`${prefix}${intent.owner}:${intent.kind}`) !== raw)
    throw new Error("SupportCreation recovery storage unavailable");
}
export function clearSupportCreationRecovery(owner: string, kind: SupportKind) {
  sessionStorage.removeItem(`${prefix}${owner}:${kind}`);
}
export function redactSupportCreationRecoveries() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {
    /* Retain uncertainty if storage is unavailable. */
  }
}
