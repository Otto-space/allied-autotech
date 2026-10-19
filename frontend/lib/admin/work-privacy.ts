import { z } from "zod";
import {
  parsePrivacyPage,
  parseHolds,
  privacyKinds,
  privacyStatuses,
  privacyRequestSchema,
  retentionHoldSchema,
  type PrivacyRequest,
  type RetentionHold,
} from "../api/privacy-schemas";
import { inspectionPageParams } from "./work-inspections";
import { draftIdentity, draftKey, forgetDraft } from "../forms/drafts";
export type PrivacyChange = {
  kind: "review" | "hold" | "release";
  request: PrivacyRequest;
  body: Record<string, unknown>;
  hold?: RetentionHold;
};
const uuid = z.uuid();
export function privacyQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const key of input.keys())
    if (
      !["kind", "status", "userId", "cursor", "_trail", "request"].includes(key) ||
      input.getAll(key).length !== 1
    )
      invalid = true;
  for (const key of ["kind", "status", "userId", "cursor", "request"]) {
    const value = input.get(key);
    if (value === null) continue;
    if (
      (key === "kind" && !Object.hasOwn(privacyKinds, value)) ||
      (key === "status" && !Object.hasOwn(privacyStatuses, value)) ||
      (["userId", "cursor", "request"].includes(key) && !uuid.safeParse(value).success)
    )
      invalid = true;
    else
      params.set(
        key,
        ["userId", "cursor", "request"].includes(key) ? value.toLowerCase() : value,
      );
  }
  const trail = input.get("_trail");
  if (trail !== null) {
    const items = trail.split(",");
    if (
      !params.has("cursor") ||
      items.length > 50 ||
      items[0] !== "start" ||
      items.slice(1).some((s) => !uuid.safeParse(s).success) ||
      new Set(items).size !== items.length ||
      items.includes(params.get("cursor")!)
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.delete("request");
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/staff/privacy-requests?${api}` };
}
export const privacyPageParams = inspectionPageParams;
export function parsePrivacyWorkPage(value: unknown, params: URLSearchParams) {
  const data = parsePrivacyPage(value);
  if (
    data.items.length > 25 ||
    new Set(data.items.map((r) => r.id)).size !== data.items.length ||
    (data.nextCursor &&
      (data.nextCursor !== data.items.at(-1)?.id ||
        data.nextCursor === params.get("cursor"))) ||
    data.items.some(
      (r, i) =>
        (params.has("kind") && r.kind !== params.get("kind")) ||
        (params.has("status") && r.status !== params.get("status")) ||
        (params.has("userId") && r.userId !== params.get("userId")) ||
        (i > 0 && Date.parse(r.createdAt) > Date.parse(data.items[i - 1].createdAt)),
    )
  )
    throw Error("Unexpected privacy review page");
  return data;
}
export function parsePrivacyHolds(value: unknown, userId: string) {
  const rows = parseHolds(value);
  if (
    rows.length > 100 ||
    new Set(rows.map((r) => r.id)).size !== rows.length ||
    rows.some((r) => r.userId !== userId)
  )
    throw Error("Unexpected retention hold account");
  return rows;
}
export function privacySnapshot(r: PrivacyRequest) {
  return JSON.stringify([
    r.id,
    r.userId,
    r.kind,
    r.reason,
    r.status,
    r.createdAt,
    r.reviewedAt,
    r.reviewNote,
  ]);
}
export function validatePrivacyChange(response: unknown, change: PrivacyChange) {
  const data = z.object({ data: z.unknown() }).parse(response).data,
    before = change.request,
    body = change.body;
  if (change.kind === "review") {
    const saved = privacyRequestSchema.parse(data);
    if (
      saved.id !== before.id ||
      saved.userId !== before.userId ||
      saved.kind !== before.kind ||
      saved.reason !== before.reason ||
      saved.createdAt !== before.createdAt ||
      saved.status !== body.status ||
      saved.reviewNote !== body.note ||
      !saved.reviewedAt ||
      Date.parse(saved.reviewedAt) <=
        Date.parse(before.reviewedAt ?? "1970-01-01T00:00:00Z")
    )
      throw Error("Unconfirmed privacy review");
    return { record: saved };
  }
  if (change.kind === "hold") {
    const saved = retentionHoldSchema.parse(data);
    if (
      saved.userId !== before.userId ||
      saved.recordType !== body.recordType ||
      saved.recordId !== (body.recordId ?? null) ||
      saved.reason !== body.reason ||
      saved.releasedAt !== null
    )
      throw Error("Unconfirmed retention hold");
    return { hold: saved };
  }
  const saved = z
    .object({
      id: uuid,
      userId: uuid,
      releasedAt: z.iso.datetime({ offset: true }),
      releaseReason: z.string(),
    })
    .parse(data);
  if (
    !change.hold ||
    saved.id !== change.hold.id ||
    saved.userId !== before.userId ||
    saved.releaseReason !== body.reason
  )
    throw Error("Unconfirmed hold release");
  return { released: saved };
}
const prefix = "aat:privacy-review:v1:",
  pendingSchema = z
    .object({
      token: uuid,
      kind: z.enum(["review", "hold", "release"]),
      requestId: uuid,
      userId: uuid,
    })
    .strict();
export type PrivacyPending = z.infer<typeof pendingSchema> | "unknown";
const marker = (owner: string, role: string) => `${prefix}${owner}:${role}`;
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`)
    throw Error("Privacy review account changed");
}
export function readPrivacyPending(
  owner: string,
  role: string,
): PrivacyPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(marker(owner, role));
    return raw === null ? undefined : pendingSchema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markPrivacyPending(owner: string, role: string, change: PrivacyChange) {
  identity(owner, role);
  if (readPrivacyPending(owner, role)) throw Error("Privacy review needs reconciliation");
  const value = {
      token: crypto.randomUUID(),
      kind: change.kind,
      requestId: change.request.id,
      userId: change.request.userId,
    },
    raw = JSON.stringify(value),
    key = marker(owner, role);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw) throw Error("Privacy recovery unavailable");
  return value;
}
export function clearPrivacyPending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const current = readPrivacyPending(owner, role);
  if (token && (current === "unknown" || current?.token !== token))
    throw Error("Privacy recovery changed");
  const key = marker(owner, role);
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null) throw Error("Privacy recovery unavailable");
}
export function redactPrivacyChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
export function forgetPrivacyDrafts(owner: string, role: string) {
  identity(owner, role);
  for (const key of Object.keys(sessionStorage)) {
    if (!key.startsWith("aat:form-draft:v1:")) continue;
    try {
      const parts = JSON.parse(key.slice("aat:form-draft:v1:".length));
      if (parts[0] === `${owner}:${role}` && parts[1] === "/admin/privacy")
        forgetDraft(key);
    } catch {}
  }
}
export function forgetPrivacyForm(element: HTMLElement) {
  const form = element.closest("form"),
    root = form?.closest("[data-privacy-owner]"),
    owner = root?.getAttribute("data-privacy-owner");
  if (owner === draftIdentity() && form?.dataset.draftKey)
    forgetDraft(draftKey(owner!, "/admin/privacy", form.dataset.draftKey));
}
