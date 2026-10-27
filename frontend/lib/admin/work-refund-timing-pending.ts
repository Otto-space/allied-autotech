import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
const prefix = "aat:refund-timing-policy:v1:",
  schema = z
    .object({
      token: z.uuid(),
      expectedVersion: z.number().int().nonnegative(),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
export type RefundTimingPolicyPending = z.infer<typeof schema> | "unknown";
const key = (owner: string, role: string) => prefix + owner + ":" + role;
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`)
    throw Error("RefundTimingPolicy account changed");
}
export function readRefundTimingPolicyPending(
  owner: string,
  role: string,
): RefundTimingPolicyPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(key(owner, role));
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markRefundTimingPolicyPending(
  owner: string,
  role: string,
  value: Omit<z.infer<typeof schema>, "token">,
) {
  identity(owner, role);
  if (readRefundTimingPolicyPending(owner, role))
    throw Error("An earlier refund timing change needs reconciliation");
  const marker = schema.parse({ ...value, token: crypto.randomUUID() }),
    raw = JSON.stringify(marker),
    k = key(owner, role);
  sessionStorage.setItem(k, raw);
  if (sessionStorage.getItem(k) !== raw)
    throw Error("RefundTimingPolicy recovery storage unavailable");
  return marker;
}
export function clearRefundTimingPolicyPending(
  owner: string,
  role: string,
  token?: string,
) {
  identity(owner, role);
  const marker = readRefundTimingPolicyPending(owner, role);
  if (token && (marker === "unknown" || marker?.token !== token))
    throw Error("RefundTimingPolicy recovery changed");
  const k = key(owner, role);
  sessionStorage.removeItem(k);
  if (sessionStorage.getItem(k) !== null)
    throw Error("RefundTimingPolicy recovery storage unavailable");
}
export function redactRefundTimingPolicyChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage))
      if (k.startsWith(prefix)) sessionStorage.setItem(k, "pending");
  } catch {}
}
export async function refundTimingPolicyFingerprint(body: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
}
