import { z } from "zod";
import {
  anomalySchema,
  anomalyStatuses,
  anomalyTypes,
} from "@/lib/api/operations-schemas";
import { inspectionPageParams } from "./work-inspections";
const date = z.iso.datetime({ offset: true }),
  uuid = z.uuid();
export const exceptionSchema = anomalySchema
  .extend({
    detectedAt: date,
    updatedAt: date,
    resolvedAt: date.nullable(),
  })
  .strict()
  .refine((v) => {
    const closed = v.status === "RESOLVED" || v.status === "IGNORED";
    return (
      closed === !!v.resolvedAt &&
      closed === !!v.resolvedByUserId &&
      (!closed || !!v.resolutionNote?.trim()) &&
      Date.parse(v.updatedAt) >= Date.parse(v.detectedAt)
    );
  }, "Exception state could not be confirmed");
export type WorkException = z.infer<typeof exceptionSchema>;
export const exceptionLabels = {
  OPEN: "Open",
  INVESTIGATING: "Investigating",
  RESOLVED: "Resolved",
  IGNORED: "Ignored",
  UNKNOWN_REFERENCE: "Unknown reference",
  AMOUNT_MISMATCH: "Amount mismatch",
  CURRENCY_MISMATCH: "Currency mismatch",
  DUPLICATE_SUCCESS: "Duplicate success",
  LATE_SUCCESS: "Late success",
  REFUND_MISMATCH: "Refund mismatch",
  WEBHOOK_REPLAY: "Webhook replay",
  OTHER: "Other",
};
export function exceptionQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const key of input.keys())
    if (
      !["status", "type", "cursor", "_trail", "selected"].includes(key) ||
      input.getAll(key).length !== 1
    )
      invalid = true;
  for (const key of ["status", "type", "cursor", "selected"]) {
    const v = input.get(key);
    if (v === null) continue;
    const valid =
      key === "status"
        ? (anomalyStatuses as readonly string[]).includes(v)
        : key === "type"
          ? (anomalyTypes as readonly string[]).includes(v)
          : uuid.safeParse(v).success;
    if (!valid) invalid = true;
    else params.set(key, key === "status" || key === "type" ? v : v.toLowerCase());
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
  return {
    params,
    invalid,
    path: invalid ? null : `/admin/operations/payment-anomalies?${api}`,
  };
}
export const exceptionPageParams = inspectionPageParams;
export function parseExceptionPage(value: unknown, query: URLSearchParams) {
  const page = z
    .object({ items: z.array(exceptionSchema).max(25), nextCursor: uuid.optional() })
    .strict()
    .parse(value);
  if (
    new Set(page.items.map((v) => v.id)).size !== page.items.length ||
    (page.nextCursor &&
      (page.nextCursor !== page.items.at(-1)?.id ||
        page.nextCursor === query.get("cursor"))) ||
    page.items.some(
      (v, i) =>
        (query.has("status") && v.status !== query.get("status")) ||
        (query.has("type") && v.type !== query.get("type")) ||
        (i > 0 &&
          (Date.parse(page.items[i - 1].detectedAt) < Date.parse(v.detectedAt) ||
            (page.items[i - 1].detectedAt === v.detectedAt &&
              page.items[i - 1].id.localeCompare(v.id) <= 0))),
    )
  )
    throw Error("Exception page scope could not be confirmed");
  return page;
}
export function parseCurrentException(value: unknown, id: string) {
  const record = exceptionSchema.parse(value);
  if (record.id !== id) throw Error("Exception scope changed");
  return record;
}
export const exceptionBodySchema = z
  .object({
    expectedStatus: z.enum(["OPEN", "INVESTIGATING"]),
    status: z.enum(["INVESTIGATING", "RESOLVED", "IGNORED"]),
    resolutionNote: z.string().trim().min(3).max(2000),
  })
  .strict()
  .refine((v) =>
    v.expectedStatus === "OPEN"
      ? v.status === "INVESTIGATING"
      : v.status !== "INVESTIGATING",
  );
export type ExceptionBody = z.infer<typeof exceptionBodySchema>;
export type ExceptionChange = { before: WorkException; body: ExceptionBody };
export function exceptionSnapshot(row: WorkException) {
  return JSON.stringify(exceptionSchema.parse(row));
}
export function validateExceptionReceipt(
  value: unknown,
  before: WorkException,
  body: ExceptionBody,
  actor: string,
) {
  const parsed = exceptionBodySchema.parse(body),
    row = parseCurrentException(value, before.id);
  if (
    parsed.expectedStatus !== before.status ||
    row.status !== parsed.status ||
    row.resolutionNote !== parsed.resolutionNote ||
    Date.parse(row.updatedAt) < Date.parse(before.updatedAt)
  )
    throw Error("Exception transition receipt changed");
  for (const key of [
    "type",
    "summary",
    "paymentId",
    "paymentAttemptId",
    "refundId",
    "disputeId",
    "detectedAt",
  ] as const)
    if (row[key] !== before[key]) throw Error("Exception source receipt changed");
  if (
    parsed.status === "INVESTIGATING"
      ? row.resolvedAt !== null || row.resolvedByUserId !== null
      : !row.resolvedAt ||
        row.resolvedByUserId !== actor ||
        Date.parse(row.resolvedAt) < Date.parse(before.updatedAt)
  )
    throw Error("Exception closure receipt changed");
  return row;
}
