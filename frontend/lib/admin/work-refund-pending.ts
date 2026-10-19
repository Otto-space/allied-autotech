import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
import type { MutationProposal } from "@/app/components/mutation-review";
import type { RefundAction } from "./work-refunds";
export type RefundReview = MutationProposal & {
  refundChange?: { action: RefundAction; body: unknown };
};
const prefix = "aat:staff-refund-change:v1:";
const schema = z
  .object({
    token: z.uuid(),
    refundId: z.uuid(),
    action: z.enum(["decision", "transfer", "check"]),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type RefundPending = z.infer<typeof schema> | "unknown";
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Refund account changed");
}
export function readRefundPending(
  owner: string,
  role: string,
): RefundPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(prefix + owner + ":" + role);
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markRefundPending(
  owner: string,
  role: string,
  value: Omit<z.infer<typeof schema>, "token">,
) {
  identity(owner, role);
  if (readRefundPending(owner, role))
    throw Error("An earlier refund change needs reconciliation");
  const marker = schema.parse({ ...value, token: crypto.randomUUID() }),
    key = prefix + owner + ":" + role,
    raw = JSON.stringify(marker);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw)
    throw Error("Refund recovery storage is unavailable");
  return marker;
}
export function clearRefundPending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const marker = readRefundPending(owner, role);
  if (token && (marker === "unknown" || marker?.token !== token))
    throw Error("Refund recovery changed");
  const key = prefix + owner + ":" + role;
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null)
    throw Error("Refund recovery storage is unavailable");
}
export function redactRefundChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
export function purgeRefundBankDrafts(owner: string, role: string) {
  identity(owner, role);
  const draftPrefix = "aat:form-draft:v1:";
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (!key.startsWith(draftPrefix)) continue;
      let parts: unknown;
      try {
        parts = JSON.parse(key.slice(draftPrefix.length));
      } catch {
        continue;
      }
      if (
        Array.isArray(parts) &&
        parts[0] === `${owner}:${role}` &&
        parts[1] === "/admin/refunds" &&
        typeof parts[2] === "string" &&
        /"refund-(?:transfer-form|evidence-check):1"/.test(parts[2])
      )
        sessionStorage.removeItem(key);
    }
  } catch {
    /* Optional storage may be blocked; bank forms never restore drafts. */
  }
}
export async function refundFingerprint(body: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
}
