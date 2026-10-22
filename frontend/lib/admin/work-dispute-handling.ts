import { z } from "zod";
import {
  disputeWorkSchema,
  type DisputeChange,
  type DisputeWork,
} from "@/lib/api/dispute-workflow";
import { inspectionPageParams } from "./work-inspections";
const uuid = z.uuid();
export const handlingSchema = disputeWorkSchema
  .strict()
  .refine(
    (v) =>
      v.primaryUserId === (v.primaryOperator?.id ?? null) &&
      v.backupUserId === (v.backupOperator?.id ?? null) &&
      (!v.primaryUserId || v.primaryUserId !== v.backupUserId) &&
      !!v.acknowledgedAt === !!v.acknowledgedByUserId &&
      !!v.respondedAt === !!v.providerSubmissionReference &&
      (!v.evidenceChecklist || v.hasEvidence),
    "Dispute facts could not be confirmed",
  );
export function handlingQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const key of input.keys())
    if (
      !["openOnly", "cursor", "_trail", "selected"].includes(key) ||
      input.getAll(key).length !== 1
    )
      invalid = true;
  for (const key of ["openOnly", "cursor", "selected"]) {
    const v = input.get(key);
    if (v === null) continue;
    if (key === "openOnly" ? !["true", "false"].includes(v) : !uuid.safeParse(v).success)
      invalid = true;
    else params.set(key, v.toLowerCase());
  }
  const trail = input.get("_trail");
  if (trail !== null) {
    const parts = trail.split(",");
    if (
      !params.has("cursor") ||
      parts[0] !== "start" ||
      parts.length > 50 ||
      parts.slice(1).some((v) => !uuid.safeParse(v).success) ||
      new Set(parts).size !== parts.length ||
      parts.includes(params.get("cursor")!)
    )
      invalid = true;
    else params.set("_trail", trail.toLowerCase());
  }
  const api = new URLSearchParams(params);
  api.delete("selected");
  api.delete("_trail");
  api.set("limit", "25");
  if (!api.has("openOnly")) api.set("openOnly", "true");
  return { params, invalid, path: invalid ? null : `/staff/disputes?${api}` };
}
export const handlingPageParams = inspectionPageParams;
export function parseCurrentDispute(
  value: unknown,
  id: string,
  actor: string,
  role: string,
) {
  const row = handlingSchema.parse(value);
  if (
    row.id !== id ||
    (role === "STAFF" && ![row.primaryUserId, row.backupUserId].includes(actor))
  )
    throw Error("Dispute assignment scope changed");
  return row;
}
export function parseHandlingPage(
  value: unknown,
  query: URLSearchParams,
  actor: string,
  role: string,
) {
  const page = z
    .object({ items: z.array(handlingSchema).max(25), nextCursor: uuid.nullable() })
    .strict()
    .parse(value);
  if (
    new Set(page.items.map((v) => v.id)).size !== page.items.length ||
    (page.nextCursor &&
      (page.nextCursor !== page.items.at(-1)?.id ||
        page.nextCursor === query.get("cursor"))) ||
    page.items.some(
      (v) =>
        (query.get("openOnly") !== "false" && !!v.resolvedAt) ||
        (role === "STAFF" && ![v.primaryUserId, v.backupUserId].includes(actor)),
    )
  )
    throw Error("Dispute page scope could not be confirmed");
  return page;
}
export function disputeSnapshot(row: DisputeWork) {
  return JSON.stringify(handlingSchema.parse(row));
}
export type HandlingChange = { before: DisputeWork; change: DisputeChange };
export function validateHandlingReceipt(
  value: unknown,
  before: DisputeWork,
  change: DisputeChange,
  actor: string,
  role: string,
) {
  const row = parseCurrentDispute(value, before.id, actor, role);
  if (before.resolvedAt || Date.parse(row.updatedAt) < Date.parse(before.updatedAt))
    throw Error("Dispute receipt version changed");
  const allowed = new Set<string>([
    "updatedAt",
    ...(change.action === "assign"
      ? ["primaryUserId", "backupUserId", "primaryOperator", "backupOperator"]
      : change.action === "acknowledge"
        ? ["acknowledgedAt", "acknowledgedByUserId"]
        : change.action === "evidence"
          ? ["hasEvidence", "evidenceChecklist"]
          : ["respondedAt", "providerSubmissionReference"]),
  ]);
  for (const key of Object.keys(handlingSchema.parse(before)) as (keyof DisputeWork)[])
    if (!allowed.has(key) && JSON.stringify(row[key]) !== JSON.stringify(before[key]))
      throw Error("Dispute source receipt changed");
  const valid =
    change.action === "assign"
      ? row.primaryUserId === change.body.primaryUserId &&
        row.backupUserId === change.body.backupUserId
      : change.action === "acknowledge"
        ? !!row.acknowledgedAt && row.acknowledgedByUserId === actor
        : change.action === "evidence"
          ? row.hasEvidence &&
            row.evidenceChecklist?.invoice === true &&
            row.evidenceChecklist?.fulfillmentOrHandoverProof === true &&
            row.evidenceChecklist?.relevantCustomerMessages === true &&
            row.evidenceChecklist?.note === change.body.note.trim()
          : row.providerSubmissionReference ===
              change.body.providerSubmissionReference.trim() &&
            !!row.respondedAt &&
            Date.parse(row.respondedAt) === Date.parse(change.body.submittedAt);
  if (!valid) throw Error("Dispute action receipt could not be confirmed");
  return row;
}
