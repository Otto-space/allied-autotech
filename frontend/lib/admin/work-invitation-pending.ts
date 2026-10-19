import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
const prefix = "aat:invitation-change:v1:";
const changeSchema = z
  .object({
    action: z.enum(["promotion", "invitation", "revocation"]),
    target: z.uuid(),
  })
  .strict();
const markerSchema = changeSchema.extend({ token: z.uuid() }).strict();
export type InvitationChange = z.infer<typeof changeSchema>;
export type InvitationPending = z.infer<typeof markerSchema> | "unknown";
const key = (owner: string, role: string) => `${prefix}${owner}:${role}`;
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("The acting account changed");
}
export function readInvitationPending(
  owner: string,
  role: string,
): InvitationPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(key(owner, role));
    return raw === null ? undefined : markerSchema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markInvitationPending(
  owner: string,
  role: string,
  change: InvitationChange,
) {
  identity(owner, role);
  if (readInvitationPending(owner, role))
    throw Error("An access change needs reconciliation");
  const marker = markerSchema.parse({ ...change, token: crypto.randomUUID() });
  const raw = JSON.stringify(marker),
    k = key(owner, role);
  sessionStorage.setItem(k, raw);
  if (sessionStorage.getItem(k) !== raw) throw Error("Recovery storage is unavailable");
  return marker;
}
export function clearInvitationPending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const pending = readInvitationPending(owner, role);
  if (token && (pending === "unknown" || pending?.token !== token))
    throw Error("The pending access change changed");
  const k = key(owner, role);
  sessionStorage.removeItem(k);
  if (sessionStorage.getItem(k) !== null) throw Error("Recovery storage is unavailable");
}
export function redactInvitationChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage))
      if (k.startsWith(prefix)) sessionStorage.setItem(k, "pending");
  } catch {}
}
