import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
const prefix = "aat:job-retry:v1:";
const schema = z
  .object({ token: z.uuid(), id: z.uuid(), source: z.enum(["outbox", "webhook"]) })
  .strict();
export type JobPending = z.infer<typeof schema> | "unknown";
const key = (owner: string, role: string) => `${prefix}${owner}:${role}`;
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("The acting account changed");
}
export function readJobPending(owner: string, role: string): JobPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(key(owner, role));
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markJobPending(
  owner: string,
  role: string,
  target: { id: string; source: "outbox" | "webhook" },
) {
  identity(owner, role);
  if (readJobPending(owner, role)) throw Error("An earlier retry needs reconciliation");
  const marker = schema.parse({ token: crypto.randomUUID(), ...target }),
    raw = JSON.stringify(marker),
    k = key(owner, role);
  sessionStorage.setItem(k, raw);
  if (sessionStorage.getItem(k) !== raw) throw Error("Recovery storage is unavailable");
  return marker;
}
export function clearJobPending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const pending = readJobPending(owner, role);
  if (token && (pending === "unknown" || pending?.token !== token))
    throw Error("The pending retry changed");
  const k = key(owner, role);
  sessionStorage.removeItem(k);
  if (sessionStorage.getItem(k) !== null) throw Error("Recovery storage is unavailable");
}
export function redactJobRetries() {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage))
      if (k.startsWith(prefix)) sessionStorage.setItem(k, "pending");
  } catch {}
}
