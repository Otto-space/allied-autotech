import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
const prefix = "aat:staff-change:v1:";
export const staffChangeArea = z.enum(["account", "capability", "workforce"]);
export type StaffChangeArea = z.infer<typeof staffChangeArea>;
const markerSchema = z.object({ token: z.uuid(), area: staffChangeArea }).strict();
export type StaffChangePending = z.infer<typeof markerSchema> | "unknown";
const key = (owner: string, role: string, target: string) =>
  prefix + owner + ":" + role + ":" + target;
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("The acting account changed");
}
export function readStaffPending(
  owner: string,
  role: string,
  target: string,
): StaffChangePending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(key(owner, role, target));
    return raw === null ? undefined : markerSchema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markStaffPending(
  owner: string,
  role: string,
  target: string,
  area: StaffChangeArea,
) {
  identity(owner, role);
  if (readStaffPending(owner, role, target))
    throw Error("An earlier account change needs reconciliation");
  const marker = markerSchema.parse({ token: crypto.randomUUID(), area }),
    raw = JSON.stringify(marker),
    k = key(owner, role, target);
  sessionStorage.setItem(k, raw);
  if (sessionStorage.getItem(k) !== raw)
    throw Error("Account-change recovery storage is unavailable");
  return marker;
}
export function clearStaffPending(
  owner: string,
  role: string,
  target: string,
  token?: string,
) {
  identity(owner, role);
  const marker = readStaffPending(owner, role, target);
  if (token && (marker === "unknown" || marker?.token !== token))
    throw Error("The pending account change changed");
  const k = key(owner, role, target);
  sessionStorage.removeItem(k);
  if (sessionStorage.getItem(k) !== null)
    throw Error("Account-change recovery storage is unavailable");
}
export function redactStaffChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage))
      if (k.startsWith(prefix)) sessionStorage.setItem(k, "pending");
  } catch {}
}
