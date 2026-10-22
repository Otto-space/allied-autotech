import { z } from "zod";
import { parseWorkSupport } from "./work-support";
import {
  supportMessageSchema,
  type SupportKind,
  type SupportRecord,
} from "../api/support-schemas";
import { draftIdentity, draftKey, forgetDraft } from "../forms/drafts";
import { inspectionPageParams } from "./work-inspections";
export type SupportChange = {
  kind: "assignment" | "status" | "priority" | "acknowledgement" | "reply";
  expectedVersion?: number;
  body: Record<string, unknown>;
};
export const threadReceiptSchema = supportMessageSchema.extend({
  conversationId: z.uuid(),
  conversationKind: z.enum(["enquiries", "complaints"]),
});
export type ThreadReceipt = z.infer<typeof threadReceiptSchema>;
export function parseStaffThread(
  value: unknown,
  id: string,
  kind: SupportKind,
  role: string,
  branchId?: string | null,
) {
  const row = parseWorkSupport({ items: [value] }, kind, role, branchId).items[0];
  if (row.id !== id) throw Error("Unexpected conversation reference");
  return row;
}
export function threadAtLeast(row: SupportRecord, known: SupportRecord) {
  return (
    row.id === known.id &&
    row.kind === known.kind &&
    row.version >= known.version &&
    !(
      known.kind === "complaints" &&
      known.acknowledgedAt &&
      (row.kind !== "complaints" || row.acknowledgedAt !== known.acknowledgedAt)
    )
  );
}
export function mergeThread(known: SupportRecord | undefined, row: SupportRecord) {
  if (!known) return row;
  return threadAtLeast(row, known) ? row : known;
}
export function threadSnapshot(row: SupportRecord, change: SupportChange) {
  const common = [row.id, row.kind, row.branchId, row.subject, row.contact?.customerId];
  return JSON.stringify(
    change.kind === "reply"
      ? [...common, row.status === "CLOSED"]
      : change.kind === "acknowledgement"
        ? [
            ...common,
            row.status === "CLOSED",
            row.kind === "complaints" ? row.acknowledgedAt : null,
          ]
        : [
            ...common,
            row.version,
            row.status,
            row.assignedStaffId,
            row.kind === "complaints" ? row.priority : null,
          ],
  );
}
function validateMessage(
  value: unknown,
  before: SupportRecord,
  body: unknown,
  visibility: unknown,
) {
  const saved = threadReceiptSchema.parse(value);
  if (
    saved.conversationId !== before.id ||
    saved.conversationKind !== before.kind ||
    saved.authorType !== "STAFF" ||
    saved.body !== body ||
    saved.visibility !== visibility
  )
    throw Error("Unconfirmed conversation message");
  return saved;
}
export function validateThreadChange(
  response: unknown,
  change: SupportChange,
  before: SupportRecord,
  role: string,
  branchId?: string | null,
) {
  const data = z.object({ data: z.unknown() }).parse(response).data;
  if (change.kind === "reply")
    return {
      receipt: validateMessage(data, before, change.body.message, change.body.visibility),
      added: true,
    };
  const saved = parseStaffThread(data, before.id, before.kind, role, branchId);
  if (
    saved.branchId !== before.branchId ||
    saved.contact?.customerId !== before.contact?.customerId
  )
    throw Error("Unexpected conversation scope");
  let receipt: ThreadReceipt | undefined,
    added = true;
  if (change.kind === "acknowledgement") {
    const extra = z
      .object({ acknowledgedNow: z.boolean(), messageReceipt: z.unknown().nullable() })
      .parse(data);
    if (
      saved.kind !== "complaints" ||
      !saved.acknowledgedAt ||
      saved.version < before.version
    )
      throw Error("Unconfirmed acknowledgement");
    added = extra.acknowledgedNow;
    if (added) {
      if (saved.status === "CLOSED") throw Error("Closed acknowledgement");
      receipt = validateMessage(
        extra.messageReceipt,
        before,
        change.body.message,
        "CUSTOMER",
      );
    } else if (extra.messageReceipt !== null)
      throw Error("Unexpected acknowledgement receipt");
  } else {
    if (saved.version !== change.expectedVersion! + 1)
      throw Error("Unexpected support version");
    if (
      change.kind === "assignment" &&
      saved.assignedStaffId !== change.body.assignedStaffId
    )
      throw Error("Unconfirmed assignment");
    if (
      change.kind === "priority" &&
      (saved.kind !== "complaints" || saved.priority !== change.body.priority)
    )
      throw Error("Unconfirmed priority");
    if (change.kind === "status") {
      if (saved.status !== change.body.status) throw Error("Unconfirmed status");
      const text = change.body.response ?? change.body.resolution;
      const extra = z.object({ messageReceipt: z.unknown().nullable() }).parse(data);
      if (text) receipt = validateMessage(extra.messageReceipt, before, text, "CUSTOMER");
      else if (extra.messageReceipt !== null) throw Error("Unexpected response message");
      if (
        saved.kind === "complaints" &&
        change.body.resolution &&
        saved.resolution !== change.body.resolution
      )
        throw Error("Unconfirmed resolution");
    }
  }
  return { record: saved, receipt, added };
}
export function threadMessagesQuery(input: URLSearchParams, base: string) {
  let invalid = false;
  const params = new URLSearchParams();
  for (const key of input.keys())
    if (!["cursor", "_trail"].includes(key) || input.getAll(key).length !== 1)
      invalid = true;
  const cursor = input.get("cursor"),
    trail = input.get("_trail");
  if (cursor !== null) {
    if (!z.uuid().safeParse(cursor).success) invalid = true;
    else params.set("cursor", cursor);
  }
  if (trail !== null) {
    const parts = trail.split(",");
    if (
      !cursor ||
      parts.length > 50 ||
      parts[0] !== "start" ||
      parts.slice(1).some((s) => !z.uuid().safeParse(s).success) ||
      parts.includes(cursor) ||
      new Set(parts).size !== parts.length
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.set("limit", "50");
  return { params, invalid, path: invalid ? null : `${base}/messages?${api}` };
}
export function parseThreadMessages(value: unknown, cursor?: string | null) {
  const data = z
    .object({
      items: z.array(supportMessageSchema).max(50),
      cursor: z.uuid().nullable(),
      hasMore: z.boolean(),
      pollAfterMs: z.number().int().positive(),
    })
    .parse(value);
  if (
    new Set(data.items.map((r) => r.id)).size !== data.items.length ||
    (data.items.length && data.cursor !== data.items.at(-1)?.id) ||
    (data.hasMore && (!data.items.length || !data.cursor || data.cursor === cursor)) ||
    data.items.some(
      (r, i) =>
        i > 0 && Date.parse(r.createdAt) < Date.parse(data.items[i - 1].createdAt),
    )
  )
    throw Error("Unexpected conversation history page");
  return data;
}
export const threadPageParams = inspectionPageParams;
const prefix = "aat:staff-conversation:v1:",
  pending = z
    .object({
      token: z.uuid(),
      kind: z.enum(["assignment", "status", "priority", "acknowledgement", "reply"]),
      version: z.number().int().nonnegative(),
    })
    .strict();
export type ThreadPending = z.infer<typeof pending> | "unknown";
const marker = (owner: string, role: string, kind: SupportKind, id: string) =>
  `${prefix}${owner}:${role}:${kind}:${id}`;
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Conversation account changed");
}
export function readThreadPending(
  owner: string,
  role: string,
  kind: SupportKind,
  id: string,
): ThreadPending | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(marker(owner, role, kind, id));
    if (raw === null) return;
    return pending.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markThreadPending(
  owner: string,
  role: string,
  kind: SupportKind,
  id: string,
  operation: SupportChange["kind"],
  version: number,
) {
  identity(owner, role);
  if (readThreadPending(owner, role, kind, id))
    throw Error("Conversation needs reconciliation");
  const value = { token: crypto.randomUUID(), kind: operation, version },
    raw = JSON.stringify(value),
    key = marker(owner, role, kind, id);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw)
    throw Error("Conversation recovery unavailable");
  return value;
}
export function clearThreadPending(
  owner: string,
  role: string,
  kind: SupportKind,
  id: string,
  token?: string,
) {
  identity(owner, role);
  const key = marker(owner, role, kind, id),
    value = readThreadPending(owner, role, kind, id);
  if (token && (value === "unknown" || value?.token !== token))
    throw Error("Conversation recovery changed");
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null)
    throw Error("Conversation recovery unavailable");
}
export function redactThreadChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
export function forgetThreadDrafts(
  owner: string,
  role: string,
  kind: SupportKind,
  id: string,
) {
  identity(owner, role);
  for (const key of Object.keys(sessionStorage)) {
    if (!key.startsWith("aat:form-draft:v1:")) continue;
    try {
      const parts = JSON.parse(key.slice("aat:form-draft:v1:".length));
      if (parts[0] === `${owner}:${role}` && parts[1] === `/admin/support/${kind}/${id}`)
        forgetDraft(key);
    } catch {}
  }
}
export function forgetThreadFormDraft(element: HTMLElement) {
  const form = element.closest("form"),
    root = form?.closest("[data-support-owner]"),
    owner = root?.getAttribute("data-support-owner"),
    path = root?.getAttribute("data-support-path");
  if (owner && path && owner === draftIdentity() && form?.dataset.draftKey)
    forgetDraft(draftKey(owner, path, form.dataset.draftKey));
}
