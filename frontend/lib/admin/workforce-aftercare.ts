import { z } from "zod";
import { workforceAccessSchema, type WorkforceAccess } from "../api/workforce-schemas";
import { workforceAllows, workforceActionPredicates } from "../workforce-registry";
import { aftercareLabels, aftercareKinds } from "../api/aftercare-schemas";
export { inspectionPageParams as aftercarePageParams } from "./work-inspections";
export { aftercareLabels, aftercareKinds };
const date = z.iso.datetime({ offset: true }),
  money = z.string().regex(/^\d{1,19}$/);
const row = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  kind: z.string().max(80),
  status: z.string().max(80),
  requestedAt: date,
  receivedAt: date.nullable(),
  inspectedAt: date.nullable(),
  reviewedAt: date.nullable(),
  approvedFeeKobo: money.nullable(),
  order: z.object({
    id: z.uuid(),
    orderNumber: z.string().min(1).max(120),
    branchId: z.uuid(),
    branch: z.object({ id: z.uuid(), name: z.string() }),
    currency: z.literal("NGN"),
    totalKobo: money,
    confirmedAt: date.nullable(),
    fulfillmentMethod: z.enum(["COLLECTION", "DELIVERY"]),
  }),
});
const accessSchema = workforceAccessSchema.safeExtend({ managed: z.literal(true) });
const detail = row.extend({
  reason: z.string().max(2000),
  reviewReason: z.string().max(1000),
  inspectionNote: z.string().max(2000).nullable(),
  goodCondition: z.boolean().nullable(),
  reviewNote: z.string().max(2000).nullable(),
  requestedItems: z
    .array(
      z.object({
        orderItemId: z.uuid(),
        quantity: z.number().int().positive(),
        orderedQuantity: z.number().int().positive(),
        productName: z.string(),
      }),
    )
    .min(1)
    .max(100)
    .nullable(),
  policy: z
    .object({
      id: z.uuid(),
      key: z.string(),
      version: z.number().int().positive(),
      approvalStatus: z.string(),
      source: z.string().max(10000),
      effectiveAt: date,
    })
    .nullable(),
  reviewEvidenceReady: z.boolean(),
  reviewRevision: z.string().regex(/^[a-f0-9]{64}$/),
  access: accessSchema,
  generatedAt: date,
});
export type WorkforceAftercare = z.infer<typeof detail>;
function inScope(value: z.infer<typeof row>, access: WorkforceAccess) {
  return (
    value.orderId === value.order.id &&
    value.order.branchId === value.order.branch.id &&
    workforceAllows(access, workforceActionPredicates.financialAftercare, {
      branchId: value.order.branchId,
    })
  );
}
export function parseWorkforceAftercarePage(value: unknown) {
  const page = z
    .object({
      items: z.array(row).max(25),
      nextCursor: z.uuid().optional(),
      access: accessSchema,
      generatedAt: date,
    })
    .parse(value);
  if (
    !workforceAllows(page.access, workforceActionPredicates.financialAftercare) ||
    new Set(page.items.map((r) => r.id)).size !== page.items.length ||
    page.items.some((r) => !inScope(r, page.access)) ||
    (page.nextCursor &&
      (page.items.length !== 25 || page.nextCursor !== page.items.at(-1)?.id))
  )
    throw Error("Aftercare records do not match current finance scope");
  return page;
}
export function parseWorkforceAftercare(value: unknown, id: string) {
  const record = detail.parse(value);
  const items = record.requestedItems;
  if (
    record.id !== id ||
    !inScope(record, record.access) ||
    (items &&
      (new Set(items.map((i) => i.orderItemId)).size !== items.length ||
        items.some((i) => i.quantity > i.orderedQuantity))) ||
    (record.reviewEvidenceReady &&
      (!items ||
        !record.policy ||
        !Object.hasOwn(aftercareKinds, record.kind) ||
        !["REQUESTED", "RECEIVED", "INSPECTED"].includes(record.status)))
  )
    throw Error("Aftercare evidence could not be verified in current scope");
  return record;
}
export const aftercareDecisionSchema = z
  .object({
    stage: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().trim().min(20).max(2000),
    approvedFeeKobo: z
      .string()
      .regex(/^\d{1,18}$/)
      .optional(),
    expectedStatus: z.enum([
      "REQUESTED",
      "RECEIVED",
      "INSPECTED",
      "APPROVED",
      "REJECTED",
    ]),
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type AftercareDecision = z.infer<typeof aftercareDecisionSchema>;
export function parseAftercareDecisionReceipt(
  value: unknown,
  before: WorkforceAftercare,
  owner: string,
  input: AftercareDecision,
) {
  const saved = z
    .object({
      id: z.uuid(),
      orderId: z.uuid(),
      branchId: z.uuid(),
      status: z.enum(["APPROVED", "REJECTED"]),
      reviewNote: z.string(),
      approvedFeeKobo: money,
      reviewedAt: date,
      performedByUserId: z.uuid(),
    })
    .parse(value);
  if (
    saved.id !== before.id ||
    saved.orderId !== before.orderId ||
    saved.branchId !== before.order.branchId ||
    saved.performedByUserId !== owner ||
    saved.status !== input.stage ||
    saved.reviewNote !== input.note ||
    BigInt(saved.approvedFeeKobo) !== BigInt(input.approvedFeeKobo ?? "0")
  )
    throw Error("The financial decision receipt could not be verified");
  return saved;
}
export const aftercareHref = (params: URLSearchParams) =>
  `/admin/workforce/aftercare${params.size ? `?${params}` : ""}`;
export function workforceAftercareQuery(input: URLSearchParams) {
  const params = new URLSearchParams(),
    allowed = ["q", "status", "kind", "cursor", "_trail"];
  let invalid = [...input.keys()].some(
    (k) => !allowed.includes(k) || input.getAll(k).length !== 1,
  );
  const q = (input.get("q") ?? "").trim(),
    status = input.get("status") ?? "",
    kind = input.get("kind") ?? "";
  if (
    q.length > 120 ||
    [...q].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    (status && !Object.hasOwn(aftercareLabels, status)) ||
    (kind && !Object.hasOwn(aftercareKinds, kind))
  )
    invalid = true;
  for (const [key, value] of [
    ["q", q],
    ["status", status],
    ["kind", kind],
  ])
    if (value) params.set(key, value);
  const cursor = input.get("cursor"),
    trail = input.get("_trail");
  if (cursor !== null) {
    if (!z.uuid().safeParse(cursor).success) invalid = true;
    else params.set("cursor", cursor);
  }
  if (trail !== null) {
    const entries = trail.split(",");
    if (
      !cursor ||
      entries.length > 50 ||
      entries[0] !== "start" ||
      entries.slice(1).some((v) => !z.uuid().safeParse(v).success) ||
      entries.includes(cursor) ||
      new Set(entries).size !== entries.length
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/staff/workforce/aftercare?${api}` };
}
export function aftercareLabel(labels: Readonly<Record<string, string>>, value: string) {
  return Object.hasOwn(labels, value) ? labels[value] : `Unrecognised (${value})`;
}
