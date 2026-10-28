import { z } from "zod";
import { draftIdentity } from "../forms/drafts";
const prefix = "aat:workforce-aftercare-decision:v1:";
const schema = z.object({ id: z.uuid(), token: z.uuid() }).strict();
export type WorkforceAftercarePending = z.infer<typeof schema> | "unknown";
function identity(owner: string) {
  if (!draftIdentity()?.startsWith(`${owner}:`))
    throw Error("The acting account changed");
}
export function readAftercarePending(
  owner: string,
): WorkforceAftercarePending | undefined {
  if (typeof window === "undefined") return;
  try {
    const value = sessionStorage.getItem(prefix + owner);
    return value === null ? undefined : schema.parse(JSON.parse(value));
  } catch {
    return "unknown";
  }
}
export function markAftercarePending(owner: string, id: string) {
  identity(owner);
  if (readAftercarePending(owner))
    throw Error("An earlier financial decision needs checking");
  const value = schema.parse({ id, token: crypto.randomUUID() }),
    raw = JSON.stringify(value);
  sessionStorage.setItem(prefix + owner, raw);
  if (sessionStorage.getItem(prefix + owner) !== raw)
    throw Error("Financial review recovery storage is unavailable");
  return value;
}
export function clearAftercarePending(owner: string, token?: string) {
  identity(owner);
  const value = readAftercarePending(owner);
  if (token && (value === "unknown" || value?.token !== token))
    throw Error("The pending decision changed");
  sessionStorage.removeItem(prefix + owner);
  if (sessionStorage.getItem(prefix + owner) !== null)
    throw Error("The recovery state could not be cleared");
}
export function redactAftercarePending() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
