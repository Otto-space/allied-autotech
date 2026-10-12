import { z } from "zod";
import { supportText, type SupportKind } from "../api/support-schemas";
import { draftIdentity } from "../forms/drafts";

const prefix = "aat:support-reply:v1:";
export const supportReplyKeySchema = z
  .string()
  .regex(
    /^support-reply-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
export const supportReplyIntentSchema = z
  .object({
    owner: z.uuid(),
    key: supportReplyKeySchema,
    kind: z.enum(["enquiries", "complaints"]),
    conversationId: z.uuid(),
    body: z.object({ message: supportText(4000) }).strict(),
  })
  .strict();
export type SupportReplyIntent = z.infer<typeof supportReplyIntentSchema>;
export type SupportReplyRecovery =
  | { kind: "pending"; intent: SupportReplyIntent }
  | { kind: "history" }
  | { kind: "unavailable" };
export function supportReplyIntentActive(intent: SupportReplyIntent, now = Date.now()) {
  const issued = Number(intent.key.split(".")[1]);
  return now >= issued && now < issued + 24 * 60 * 60 * 1000;
}
export function readSupportReplyRecovery(
  owner: string,
  kind: SupportKind,
  conversationId: string,
): SupportReplyRecovery | undefined {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(`${prefix}${owner}:${kind}:${conversationId}`);
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return;
  try {
    if (raw.length > 20000) return { kind: "history" };
    const value = supportReplyIntentSchema.parse(JSON.parse(raw));
    if (
      value.owner !== owner ||
      value.kind !== kind ||
      value.conversationId !== conversationId ||
      !supportReplyIntentActive(value)
    )
      return { kind: "history" };
    return { kind: "pending", intent: value };
  } catch {
    return { kind: "history" };
  }
}
export function saveSupportReplyRecovery(value: SupportReplyIntent) {
  const intent = supportReplyIntentSchema.parse(value);
  if (draftIdentity() !== `${intent.owner}:CUSTOMER`)
    throw new Error("SupportReply draft account changed");
  const raw = JSON.stringify(intent);
  sessionStorage.setItem(
    `${prefix}${intent.owner}:${intent.kind}:${intent.conversationId}`,
    raw,
  );
  if (
    sessionStorage.getItem(
      `${prefix}${intent.owner}:${intent.kind}:${intent.conversationId}`,
    ) !== raw
  )
    throw new Error("SupportReply recovery storage unavailable");
}
export function clearSupportReplyRecovery(
  owner: string,
  kind: SupportKind,
  conversationId: string,
) {
  sessionStorage.removeItem(`${prefix}${owner}:${kind}:${conversationId}`);
}
export function redactSupportReplyRecoveries() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {
    /* Retain uncertainty if storage is unavailable. */
  }
}
