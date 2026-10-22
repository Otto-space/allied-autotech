import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
const prefix = "aat:capacity-policy:v1:",
  schema = z
    .object({
      token: z.uuid(),
      expectedVersion: z.number().int().nonnegative(),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
export type CapacityPolicyPending = z.infer<typeof schema> | "unknown";
const key = (owner: string, role: string, branchId: string) =>
  prefix + owner + ":" + role + ":" + z.uuid().parse(branchId);
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`)
    throw Error("CapacityPolicy account changed");
}
export function readCapacityPolicyPending(
  owner: string,
  role: string,
  branchId: string,
): CapacityPolicyPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(key(owner, role, branchId));
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markCapacityPolicyPending(
  owner: string,
  role: string,
  branchId: string,
  value: Omit<z.infer<typeof schema>, "token">,
) {
  identity(owner, role);
  if (readCapacityPolicyPending(owner, role, branchId))
    throw Error("An earlier capacityPolicy change needs reconciliation");
  const marker = schema.parse({ ...value, token: crypto.randomUUID() }),
    raw = JSON.stringify(marker),
    k = key(owner, role, branchId);
  sessionStorage.setItem(k, raw);
  if (sessionStorage.getItem(k) !== raw)
    throw Error("CapacityPolicy recovery storage unavailable");
  return marker;
}
export function clearCapacityPolicyPending(
  owner: string,
  role: string,
  branchId: string,
  token?: string,
) {
  identity(owner, role);
  const marker = readCapacityPolicyPending(owner, role, branchId);
  if (token && (marker === "unknown" || marker?.token !== token))
    throw Error("CapacityPolicy recovery changed");
  const k = key(owner, role, branchId);
  sessionStorage.removeItem(k);
  if (sessionStorage.getItem(k) !== null)
    throw Error("CapacityPolicy recovery storage unavailable");
}
export function redactCapacityPolicyChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage))
      if (k.startsWith(prefix)) sessionStorage.setItem(k, "pending");
  } catch {}
}
export async function capacityPolicyFingerprint(body: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
}
