import { z } from "zod";
import { draftIdentity } from "@/lib/forms/drafts";
import { branchCode } from "./work-branches";
const prefix = "aat:branch-change:v1:";
const schema = z.discriminatedUnion("kind", [
  z.object({ token: z.uuid(), kind: z.literal("create"), code: branchCode }).strict(),
  z.object({ token: z.uuid(), kind: z.literal("update"), target: z.uuid() }).strict(),
]);
export type BranchPending = z.infer<typeof schema> | "unknown";
export type BranchChange =
  { kind: "create"; code: string } | { kind: "update"; target: string };
const key = (owner: string, role: string) => `${prefix}${owner}:${role}`;
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("The acting account changed");
}
export function readBranchPending(
  owner: string,
  role: string,
): BranchPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(key(owner, role));
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markBranchPending(owner: string, role: string, change: BranchChange) {
  identity(owner, role);
  if (readBranchPending(owner, role))
    throw Error("An earlier branch change needs reconciliation");
  const marker = schema.parse({ token: crypto.randomUUID(), ...change }),
    raw = JSON.stringify(marker),
    k = key(owner, role);
  sessionStorage.setItem(k, raw);
  if (sessionStorage.getItem(k) !== raw) throw Error("Recovery storage is unavailable");
  return marker;
}
export function clearBranchPending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const pending = readBranchPending(owner, role);
  if (token && (pending === "unknown" || pending?.token !== token))
    throw Error("The pending branch change changed");
  const k = key(owner, role);
  sessionStorage.removeItem(k);
  if (sessionStorage.getItem(k) !== null) throw Error("Recovery storage is unavailable");
}
export function redactBranchChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(sessionStorage))
      if (k.startsWith(prefix)) sessionStorage.setItem(k, "pending");
  } catch {}
}
