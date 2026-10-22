import { z } from "zod";
import { draftIdentity } from "../forms/drafts";
const prefix = "aat:workforce-order-pending:v1:";
const schema = z
  .object({
    token: z.uuid(),
    id: z.uuid(),
    action: z.literal("prepare"),
    version: z.number().int().min(0),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type WorkforceOrderPending = z.infer<typeof schema> | "unknown";
function identity(owner: string) {
  if (!draftIdentity()?.startsWith(`${owner}:`))
    throw Error("The acting account changed.");
}
export function readWorkforceOrderPending(
  owner: string,
): WorkforceOrderPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(prefix + owner);
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export async function markWorkforceOrderPending(
  owner: string,
  target: { id: string; action: "prepare"; version: number },
  body: unknown,
) {
  identity(owner);
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  identity(owner);
  if (readWorkforceOrderPending(owner))
    throw Error("An earlier order change still needs reconciliation.");
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
export function clearWorkforceOrderPending(owner: string, token?: string) {
  identity(owner);
  const current = readWorkforceOrderPending(owner);
  if (token && (current === "unknown" || current?.token !== token))
    throw Error("The pending order change has changed.");
  sessionStorage.removeItem(prefix + owner);
  if (sessionStorage.getItem(prefix + owner) !== null)
    throw Error("Recovery storage is unavailable.");
}
export function redactWorkforceOrderPending() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
