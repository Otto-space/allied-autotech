import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
const prefix = "aat:staff-invoice-transition:v1:";
const schema = z
  .object({
    token: z.uuid(),
    invoiceId: z.uuid(),
    action: z.enum(["issue", "void"]),
    expectedVersion: z.number().int().nonnegative(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type InvoiceTransitionPending = z.infer<typeof schema> | "unknown";
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Invoice account changed");
}
export function readInvoiceTransitionPending(
  owner: string,
  role: string,
): InvoiceTransitionPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(prefix + owner + ":" + role);
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markInvoiceTransitionPending(
  owner: string,
  role: string,
  value: Omit<z.infer<typeof schema>, "token">,
) {
  identity(owner, role);
  if (readInvoiceTransitionPending(owner, role))
    throw Error("An invoice transition needs reconciliation");
  const marker = schema.parse({ ...value, token: crypto.randomUUID() }),
    key = prefix + owner + ":" + role,
    raw = JSON.stringify(marker);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw)
    throw Error("Invoice recovery storage is unavailable");
  return marker;
}
export function clearInvoiceTransitionPending(
  owner: string,
  role: string,
  token?: string,
) {
  identity(owner, role);
  const marker = readInvoiceTransitionPending(owner, role);
  if (token && (marker === "unknown" || marker?.token !== token))
    throw Error("Invoice recovery changed");
  const key = prefix + owner + ":" + role;
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null)
    throw Error("Invoice recovery storage is unavailable");
}
