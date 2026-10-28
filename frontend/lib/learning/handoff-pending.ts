import { z } from "zod";

const prefix = "aat:handoff:v1:";
export const handoffOperationKey = z
  .string()
  .regex(
    /^handoff-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const ownerKey = z.string().regex(/^[a-f0-9]{64}$/);
const markerSchema = z.strictObject({ operationKey: handoffOperationKey });
export function newHandoffKey() {
  return `handoff-v1.${Date.now()}.${crypto.randomUUID()}`;
}
export function readHandoffPending(owner: string) {
  const raw = sessionStorage.getItem(prefix + ownerKey.parse(owner));
  if (raw === null) return null;
  const parsed = markerSchema.safeParse(JSON.parse(raw));
  if (!parsed.success)
    throw new Error("Handoff recovery marker is invalid; check Customer Care history.");
  return parsed.data.operationKey;
}
export function saveHandoffPending(owner: string, operationKey: string) {
  // Exact payloads are encrypted server-side. Only a non-bearer operation ID is
  // retained in this session, never summary, transcript, case/contact or token.
  sessionStorage.setItem(
    prefix + ownerKey.parse(owner),
    JSON.stringify(markerSchema.parse({ operationKey })),
  );
}
export function clearHandoffPending(owner: string) {
  sessionStorage.removeItem(prefix + ownerKey.parse(owner));
}
export function redactHandoffPending() {
  if (typeof sessionStorage === "undefined") return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch {
    /* Current UI still disposes identity-bound memory. */
  }
}
