import { z } from "zod";
import { draftIdentity } from "../forms/drafts";
const prefix = "aat:workforce-enquiry-pending:v1:";
const schema = z
  .object({
    token: z.uuid(),
    id: z.uuid(),
    action: z.enum(["reply", "assignment"]),
    version: z.number().int().min(0),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type WorkforceEnquiryPending = z.infer<typeof schema> | "unknown";
function identity(owner: string) {
  if (!draftIdentity()?.startsWith(`${owner}:`))
    throw Error("The acting account changed.");
}
export function readWorkforceEnquiryPending(
  owner: string,
): WorkforceEnquiryPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(prefix + owner);
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export async function markWorkforceEnquiryPending(
  owner: string,
  target: { id: string; action: "reply" | "assignment"; version: number },
  body: unknown,
) {
  identity(owner);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  identity(owner);
  if (readWorkforceEnquiryPending(owner))
    throw Error("An earlier enquiry change still needs reconciliation.");
  const marker = schema.parse({
    ...target,
    token: crypto.randomUUID(),
    fingerprint: [...new Uint8Array(bytes)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  });
  const raw = JSON.stringify(marker);
  sessionStorage.setItem(prefix + owner, raw);
  if (sessionStorage.getItem(prefix + owner) !== raw)
    throw Error("Recovery storage is unavailable.");
  return marker;
}
export function clearWorkforceEnquiryPending(owner: string, token?: string) {
  identity(owner);
  const current = readWorkforceEnquiryPending(owner);
  if (token && (current === "unknown" || current?.token !== token))
    throw Error("The pending enquiry change has changed.");
  sessionStorage.removeItem(prefix + owner);
  if (sessionStorage.getItem(prefix + owner) !== null)
    throw Error("Recovery storage is unavailable.");
}
export function redactWorkforceEnquiryPending() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
