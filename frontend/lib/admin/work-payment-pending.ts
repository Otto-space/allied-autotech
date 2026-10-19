import { z } from "zod";
import { draftIdentity, draftKey, forgetDraft } from "@/lib/forms/drafts";
const prefix = "aat:staff-payment:v1:";
const schema = z
  .object({
    token: z.uuid(),
    paymentId: z.uuid(),
    attemptId: z.uuid(),
    operation: z.enum(["manual", "refund"]),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    requestKey: z.uuid().optional(),
  })
  .strict()
  .refine((v) => (v.operation === "refund") === !!v.requestKey);
export type PaymentPending = z.infer<typeof schema> | "unknown";
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Payment account changed");
}
export function readPaymentPending(
  owner: string,
  role: string,
): PaymentPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(`${prefix}${owner}:${role}`);
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markPaymentPending(
  owner: string,
  role: string,
  value: Omit<z.infer<typeof schema>, "token">,
) {
  identity(owner, role);
  if (readPaymentPending(owner, role)) throw Error("Payment needs reconciliation");
  const marker = schema.parse({ ...value, token: crypto.randomUUID() }),
    raw = JSON.stringify(marker),
    key = `${prefix}${owner}:${role}`;
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw) throw Error("Payment recovery unavailable");
  return marker;
}
export function clearPaymentPending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const marker = readPaymentPending(owner, role);
  if (token && (marker === "unknown" || marker?.token !== token))
    throw Error("Payment recovery changed");
  const key = `${prefix}${owner}:${role}`;
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null) throw Error("Payment recovery unavailable");
}
export function redactPaymentChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
export function forgetPaymentDraft(
  owner: string,
  role: string,
  operation: "manual" | "refund",
  id: string,
) {
  identity(owner, role);
  forgetDraft(
    draftKey(
      `${owner}:${role}`,
      "/admin/payments",
      JSON.stringify([`staff-payment-${operation}:1`, id]),
    ),
  );
}
export async function paymentFingerprint(body: unknown) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join(
    "",
  );
}
