import { z } from "zod";
const prefix = "aat:care-channel:v1:";
const ownerSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const channelPendingSchema = z.strictObject({
  action: z.enum(["request", "claim", "transfer", "end"]),
  operationKey: z
    .string()
    .regex(
      /^support-reply-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
});
export type ChannelPending = z.infer<typeof channelPendingSchema>;
export async function channelRecoveryOwner(
  userId: string,
  role: string,
  kind: string,
  id: string,
) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([userId, role, kind, id])),
  );
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
export const newChannelOperationKey = () =>
  `support-reply-v1.${Date.now()}.${crypto.randomUUID()}`;
export function readChannelPending(owner: string) {
  const value = sessionStorage.getItem(prefix + ownerSchema.parse(owner));
  return value === null ? null : channelPendingSchema.parse(JSON.parse(value));
}
export function saveChannelPending(owner: string, marker: ChannelPending) {
  // Opaque owner hash + non-bearer operation ID only. No case/contact, reason or transcript.
  sessionStorage.setItem(
    prefix + ownerSchema.parse(owner),
    JSON.stringify(channelPendingSchema.parse(marker)),
  );
}
export function clearChannelPending(owner: string) {
  sessionStorage.removeItem(prefix + ownerSchema.parse(owner));
}
export function redactChannelPending() {
  if (typeof sessionStorage === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  } catch {
    /* Identity-bound UI is discarded independently of local storage. */
  }
}
