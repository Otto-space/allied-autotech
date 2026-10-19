import { z } from "zod";
import { draftIdentity, draftKey, forgetDraft } from "@/lib/forms/drafts";
const prefix = "aat:staff-invoice:v1:";
const schema = z
  .object({
    token: z.uuid(),
    sourceType: z.enum(["ORDER", "BOOKING", "VEHICLE_TRANSACTION"]),
    sourceId: z.uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type InvoicePending = z.infer<typeof schema> | "unknown";
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Invoice account changed");
}
export function readInvoicePending(
  owner: string,
  role: string,
): InvoicePending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(prefix + owner + ":" + role);
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markInvoicePending(
  owner: string,
  role: string,
  value: Omit<z.infer<typeof schema>, "token">,
) {
  identity(owner, role);
  if (readInvoicePending(owner, role))
    throw Error("Invoice creation needs reconciliation");
  const marker = schema.parse({ ...value, token: crypto.randomUUID() }),
    raw = JSON.stringify(marker),
    key = prefix + owner + ":" + role;
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw)
    throw Error("Invoice recovery storage is unavailable");
  return marker;
}
export function clearInvoicePending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const current = readInvoicePending(owner, role);
  if (token && (current === "unknown" || current?.token !== token))
    throw Error("Invoice recovery changed");
  const key = prefix + owner + ":" + role;
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null)
    throw Error("Invoice recovery storage is unavailable");
}
export function redactInvoiceChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix) || key.startsWith("aat:staff-invoice-transition:v1:"))
        sessionStorage.setItem(key, "pending");
  } catch {}
}
export function forgetInvoiceDraft(owner: string, role: string) {
  identity(owner, role);
  forgetDraft(draftKey(`${owner}:${role}`, "/admin/invoices", "invoice-create:1"));
}
export async function invoiceFingerprint(body: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
}
