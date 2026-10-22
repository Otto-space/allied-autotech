import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
const prefix = "aat:finance-policy:v1:",
  schema = z
    .object({
      token: z.uuid(),
      expectedVersion: z.number().int().nonnegative(),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
export type FinancePolicyPending = z.infer<typeof schema> | "unknown";
const key = (owner: string, role: string) => prefix + owner + ":" + role;
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`)
    throw Error("FinancePolicy account changed");
}
export function readFinancePolicyPending(
  owner: string,
  role: string,
): FinancePolicyPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(key(owner, role));
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markFinancePolicyPending(
  owner: string,
  role: string,
  value: Omit<z.infer<typeof schema>, "token">,
) {
  identity(owner, role);
  if (readFinancePolicyPending(owner, role))
    throw Error("An earlier financePolicy change needs reconciliation");
  const marker = schema.parse({ ...value, token: crypto.randomUUID() }),
    raw = JSON.stringify(marker),
    k = key(owner, role);
  sessionStorage.setItem(k, raw);
  if (sessionStorage.getItem(k) !== raw)
    throw Error("FinancePolicy recovery storage unavailable");
  return marker;
}
export function clearFinancePolicyPending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const marker = readFinancePolicyPending(owner, role);
  if (token && (marker === "unknown" || marker?.token !== token))
    throw Error("FinancePolicy recovery changed");
  const k = key(owner, role);
  sessionStorage.removeItem(k);
  if (sessionStorage.getItem(k) !== null)
    throw Error("FinancePolicy recovery storage unavailable");
}
export function redactFinancePolicyChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage))
      if (k.startsWith(prefix)) sessionStorage.setItem(k, "pending");
  } catch {}
}
export async function financePolicyFingerprint(body: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
}
