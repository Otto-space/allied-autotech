import { z } from "zod";
import { draftIdentity } from "../forms/drafts";
const prefix = "aat:workforce-booking-confirm:v1:";
const schema = z
  .object({ token: z.uuid(), id: z.uuid(), version: z.number().int().nonnegative() })
  .strict();
export type WorkforceBookingPending = z.infer<typeof schema> | "unknown";
function identity(owner: string) {
  if (!draftIdentity()?.startsWith(`${owner}:`))
    throw Error("The acting account changed.");
}
export function readWorkforceBookingPending(
  owner: string,
): WorkforceBookingPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(prefix + owner);
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markWorkforceBookingPending(owner: string, id: string, version: number) {
  identity(owner);
  if (readWorkforceBookingPending(owner))
    throw Error("An earlier booking confirmation still needs checking.");
  const marker = schema.parse({ token: crypto.randomUUID(), id, version });
  const raw = JSON.stringify(marker);
  sessionStorage.setItem(prefix + owner, raw);
  if (sessionStorage.getItem(prefix + owner) !== raw)
    throw Error("Confirmation recovery storage is unavailable.");
  return marker;
}
export function clearWorkforceBookingPending(owner: string, token?: string) {
  identity(owner);
  const current = readWorkforceBookingPending(owner);
  if (token && (current === "unknown" || current?.token !== token))
    throw Error("The pending confirmation changed.");
  sessionStorage.removeItem(prefix + owner);
  if (sessionStorage.getItem(prefix + owner) !== null)
    throw Error("Confirmation recovery storage is unavailable.");
}
export function redactWorkforceBookingPending() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
