import { z } from "zod";
import { reviewSchema, reviewTargets, type ReviewRecord } from "../api/review-schemas";
import { inspectionPageParams } from "./work-inspections";
import { draftIdentity, draftKey, forgetDraft } from "../forms/drafts";
const uuid = z.uuid(),
  instant = z.iso.datetime({ offset: true });
export const moderationRecordSchema = reviewSchema.extend({
  customer: z.object({ firstName: z.string(), lastName: z.string() }),
  orderItem: z.object({ id: uuid, orderId: uuid }).nullable(),
  order: z.object({ orderNumber: z.string() }).nullable(),
  booking: z.object({ id: uuid, completedAt: instant.nullable() }).nullable(),
  vehicleTransaction: z.object({ transactionNumber: z.string() }).nullable(),
});
export type ModerationRecord = z.infer<typeof moderationRecordSchema>;
export type ModerationChange = {
  review: ReviewRecord;
  body: { expectedVersion: number; decision: "APPROVED" | "REJECTED"; note?: string };
};
export function parseModerationRecord(value: unknown, id?: string) {
  const r = moderationRecordSchema.parse(value),
    fields = [
      r.productId,
      r.orderItemId,
      r.serviceId,
      r.bookingId,
      r.orderId,
      r.vehicleTransactionId,
    ],
    wanted =
      r.targetType === "PRODUCT"
        ? [0, 1]
        : r.targetType === "SERVICE"
          ? [2, 3]
          : r.targetType === "ORDER"
            ? [4]
            : r.targetType === "VEHICLE_TRANSACTION"
              ? [5]
              : [];
  if (
    (id && r.id !== id) ||
    fields.some((v, i) => (wanted.includes(i) ? !v : v !== null)) ||
    (r.productId !== r.product?.id && r.productId !== null) ||
    (r.productId === null && r.product !== null) ||
    (r.serviceId !== r.service?.id && r.serviceId !== null) ||
    (r.serviceId === null && r.service !== null) ||
    (r.orderItemId !== r.orderItem?.id && r.orderItemId !== null) ||
    (r.orderItemId === null && r.orderItem !== null) ||
    (r.bookingId !== r.booking?.id && r.bookingId !== null) ||
    (r.bookingId === null && r.booking !== null) ||
    (r.orderId === null) !== (r.order === null) ||
    (r.vehicleTransactionId === null) !== (r.vehicleTransaction === null)
  )
    throw Error("Unexpected moderation review source");
  return r;
}
export function moderationQuery(input: URLSearchParams) {
  const params = new URLSearchParams(),
    status = input.get("status") ?? "PENDING";
  let invalid = !["PENDING", "APPROVED", "REJECTED"].includes(status);
  params.set("status", status);
  for (const key of input.keys())
    if (
      !["status", "targetType", "reviewId", "cursor", "_trail", "selected"].includes(
        key,
      ) ||
      input.getAll(key).length !== 1
    )
      invalid = true;
  for (const key of ["targetType", "reviewId", "cursor", "selected"]) {
    const v = input.get(key);
    if (v === null) continue;
    if (
      key === "targetType"
        ? !reviewTargets.includes(v as (typeof reviewTargets)[number])
        : !uuid.safeParse(v).success
    )
      invalid = true;
    else params.set(key, key === "targetType" ? v : v.toLowerCase());
  }
  const trail = input.get("_trail");
  if (trail !== null) {
    const t = trail.split(",");
    if (
      !params.has("cursor") ||
      t.length > 50 ||
      t[0] !== "start" ||
      t.slice(1).some((s) => !uuid.safeParse(s).success) ||
      new Set(t).size !== t.length ||
      t.includes(params.get("cursor")!)
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams(params);
  api.delete("selected");
  api.delete("_trail");
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/staff/support/reviews?${api}` };
}
export const moderationPageParams = inspectionPageParams;
export function parseModerationPage(value: unknown, params: URLSearchParams) {
  const page = z
      .object({ items: z.array(z.unknown()).max(25), nextCursor: uuid.nullish() })
      .parse(value),
    items = page.items.map((v) => parseModerationRecord(v));
  if (
    new Set(items.map((r) => r.id)).size !== items.length ||
    (page.nextCursor &&
      (page.nextCursor !== items.at(-1)?.id ||
        page.nextCursor === params.get("cursor"))) ||
    items.some(
      (r, i) =>
        r.status !== (params.get("status") ?? "PENDING") ||
        (params.has("targetType") && r.targetType !== params.get("targetType")) ||
        (params.has("reviewId") && r.id !== params.get("reviewId")) ||
        (i > 0 && Date.parse(r.createdAt) < Date.parse(items[i - 1].createdAt)),
    )
  )
    throw Error("Unexpected moderation review page");
  return { items, nextCursor: page.nextCursor ?? undefined };
}
export const moderationSnapshot = (r: ModerationRecord) => JSON.stringify(r);
const immutable = (r: ReviewRecord) =>
  JSON.stringify([
    r.id,
    r.targetType,
    r.rating,
    r.title,
    r.comment,
    r.createdAt,
    r.productId,
    r.orderItemId,
    r.serviceId,
    r.bookingId,
    r.orderId,
    r.vehicleTransactionId,
  ]);
export function validateModerationReceipt(value: unknown, change: ModerationChange) {
  const data = z.object({ data: z.unknown() }).parse(value).data,
    saved = reviewSchema.parse(data),
    before = change.review,
    body = change.body;
  if (
    immutable(saved) !== immutable(before) ||
    body.expectedVersion !== before.version ||
    (saved.product?.id ?? null) !== saved.productId ||
    (saved.service?.id ?? null) !== saved.serviceId ||
    saved.version !== body.expectedVersion + 1 ||
    saved.status !== body.decision ||
    saved.moderationNote !== (body.note ?? null) ||
    !saved.moderatedAt
  )
    throw Error("Unconfirmed moderation decision");
  return saved;
}
const prefix = "aat:review-moderation:v1:",
  pendingSchema = z
    .object({ token: uuid, reviewId: uuid, version: z.number().int().nonnegative() })
    .strict();
export type ModerationPending = z.infer<typeof pendingSchema> | "unknown";
const marker = (owner: string, role: string) => `${prefix}${owner}:${role}`;
function identity(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Moderation account changed");
}
export function readModerationPending(
  owner: string,
  role: string,
): ModerationPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(marker(owner, role));
    return raw === null ? undefined : pendingSchema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markModerationPending(
  owner: string,
  role: string,
  change: ModerationChange,
) {
  identity(owner, role);
  if (readModerationPending(owner, role)) throw Error("Moderation needs reconciliation");
  const value = {
      token: crypto.randomUUID(),
      reviewId: change.review.id,
      version: change.body.expectedVersion,
    },
    raw = JSON.stringify(value),
    key = marker(owner, role);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw) throw Error("Moderation recovery unavailable");
  return value;
}
export function clearModerationPending(owner: string, role: string, token?: string) {
  identity(owner, role);
  const current = readModerationPending(owner, role);
  if (token && (current === "unknown" || current?.token !== token))
    throw Error("Moderation recovery changed");
  const key = marker(owner, role);
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null)
    throw Error("Moderation recovery unavailable");
}
export function redactModerationChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
export function forgetModerationDraft(owner: string, role: string, id: string) {
  identity(owner, role);
  forgetDraft(
    draftKey(
      `${owner}:${role}`,
      "/admin/reviews",
      JSON.stringify(["review-moderation-form:1", id]),
    ),
  );
}
export function forgetModerationForm(element: HTMLElement, id: string) {
  const root = element.closest("[data-moderation-owner]"),
    owner = root?.getAttribute("data-moderation-owner");
  if (owner === draftIdentity())
    forgetDraft(
      draftKey(
        owner!,
        "/admin/reviews",
        JSON.stringify(["review-moderation-form:1", id]),
      ),
    );
}
