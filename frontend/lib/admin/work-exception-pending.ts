import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
const prefix = "aat:exception-change:v1:",
  schema = z
    .object({
      token: z.uuid(),
      id: z.uuid(),
      expectedStatus: z.enum(["OPEN", "INVESTIGATING"]),
      expectedUpdatedAt: z.iso.datetime({ offset: true }),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict();
export type ExceptionPending = z.infer<typeof schema> | "unknown";
function key(owner: string, role: string) {
  return prefix + owner + ":" + role;
}
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Exception account changed");
}
export function readExceptionPending(
  owner: string,
  role: string,
): ExceptionPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(key(owner, role));
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markExceptionPending(
  owner: string,
  role: string,
  value: Omit<z.infer<typeof schema>, "token">,
) {
  identity(owner, role);
  if (readExceptionPending(owner, role))
    throw Error("An earlier exception change needs reconciliation");
  const marker = schema.parse({ ...value, token: crypto.randomUUID() }),
    raw = JSON.stringify(marker),
    k = key(owner, role);
  sessionStorage.setItem(k, raw);
  if (sessionStorage.getItem(k) !== raw)
    throw Error("Exception recovery storage unavailable");
  return marker;
}
export function clearExceptionPending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const marker = readExceptionPending(owner, role);
  if (token && (marker === "unknown" || marker?.token !== token))
    throw Error("Exception recovery changed");
  const k = key(owner, role);
  sessionStorage.removeItem(k);
  if (sessionStorage.getItem(k) !== null)
    throw Error("Exception recovery storage unavailable");
}
export function redactExceptionChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage))
      if (k.startsWith(prefix)) sessionStorage.setItem(k, "pending");
  } catch {}
}
export async function exceptionFingerprint(body: unknown) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(body)),
  );
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
}
