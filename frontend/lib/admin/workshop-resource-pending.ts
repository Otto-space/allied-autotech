import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
const prefix = "aat:resource-policy:v1:",
  schema = z
    .object({
      token: z.uuid(),
      expectedVersion: z.number().int().nonnegative(),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
export type ResourcePolicyPending = z.infer<typeof schema> | "unknown";
const key = (owner: string, role: string, branchId: string) =>
  prefix + owner + ":" + role + ":" + z.uuid().parse(branchId);
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`)
    throw Error("Your resource-policy account changed");
}
export function readResourcePolicyPending(
  owner: string,
  role: string,
  branchId: string,
): ResourcePolicyPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(key(owner, role, branchId));
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markResourcePolicyPending(
  owner: string,
  role: string,
  branchId: string,
  value: Omit<z.infer<typeof schema>, "token">,
) {
  identity(owner, role);
  if (readResourcePolicyPending(owner, role, branchId))
    throw Error("An earlier resource approval needs reconciliation");
  const marker = schema.parse({ ...value, token: crypto.randomUUID() }),
    raw = JSON.stringify(marker),
    k = key(owner, role, branchId);
  sessionStorage.setItem(k, raw);
  if (sessionStorage.getItem(k) !== raw)
    throw Error("Resource approval recovery storage is unavailable");
  return marker;
}
export function clearResourcePolicyPending(
  owner: string,
  role: string,
  branchId: string,
  token?: string,
) {
  identity(owner, role);
  const marker = readResourcePolicyPending(owner, role, branchId);
  if (token && (marker === "unknown" || marker?.token !== token))
    throw Error("Resource approval recovery changed");
  const k = key(owner, role, branchId);
  sessionStorage.removeItem(k);
  if (sessionStorage.getItem(k) !== null)
    throw Error("Resource approval recovery storage is unavailable");
}
export function redactResourcePolicyChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage))
      if (k.startsWith(prefix)) sessionStorage.setItem(k, "pending");
  } catch {}
}
export async function resourcePolicyFingerprint(body: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
}
