import { z } from "zod";
import { jobSchema } from "@/lib/api/operations-schemas";
import { inspectionPageParams } from "./work-inspections";
const date = z.iso.datetime({ offset: true }),
  uuid = z.uuid();
export const jobCursor = z
  .string()
  .min(80)
  .max(1024)
  .regex(/^[A-Za-z0-9_-]+$/);
export const jobSource = z.enum(["outbox", "webhook"]);
const outbox = jobSchema.options[0]
  .extend({
    availableAt: date,
    createdAt: date,
    updatedAt: date,
    lockedAt: date.nullable(),
  })
  .strict();
const webhook = jobSchema.options[1]
  .extend({
    nextAttemptAt: date.nullable(),
    receivedAt: date,
    updatedAt: date,
    lockedAt: date.nullable(),
  })
  .strict();
const queueJob = z.discriminatedUnion("source", [
  outbox.extend({ lastError: z.null().optional() }).strict(),
  webhook
    .extend({ lastErrorCode: z.null().optional(), lastErrorMessage: z.null().optional() })
    .strict(),
]);
export const currentJobSchema = z.discriminatedUnion("source", [
  outbox
    .extend({
      status: z.enum(["PENDING", "PROCESSING", "PUBLISHED", "FAILED", "DEAD_LETTER"]),
      publishedAt: date.nullable(),
    })
    .strict(),
  webhook
    .extend({
      status: z.enum(["RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "DEAD_LETTER"]),
      processedAt: date.nullable(),
      failedAt: date.nullable(),
    })
    .strict(),
]);
export type CurrentJob = z.infer<typeof currentJobSchema>;
export type QueueJob = z.infer<typeof queueJob>;
export const jobKey = (row: { id: string; source: string }) =>
  `${row.source === "OUTBOX" ? "outbox" : "webhook"}:${row.id}`;
export const jobAttempts = (row: CurrentJob | QueueJob) =>
  row.source === "OUTBOX" ? row.attempts : row.processingAttempts;
export const jobName = (row: { eventType: string }) =>
  row.eventType === "notification.delivery.requested"
    ? "Notification delivery"
    : row.eventType;
export const jobStatusLabel = (status: string) =>
  ({
    FAILED: "Failed",
    DEAD_LETTER: "Dead letter",
    PROCESSING: "Processing",
    PENDING: "Pending",
    RECEIVED: "Received",
    PUBLISHED: "Published",
    PROCESSED: "Processed",
  })[status] ?? status;
export function jobSelection(value: string | null) {
  if (!value) return;
  const [source, id, extra] = value.split(":");
  if (
    extra !== undefined ||
    !jobSource.safeParse(source).success ||
    !uuid.safeParse(id).success
  )
    return;
  return { source: source as "outbox" | "webhook", id: id!.toLowerCase() };
}
export function jobQuery(input: URLSearchParams) {
  const params = new URLSearchParams(input),
    source = input.get("source") ?? "OUTBOX",
    status = input.get("status"),
    cursor = input.get("cursor"),
    trail = input.get("_trail");
  let invalid =
    input.toString().length > 60000 || !["OUTBOX", "PAYMENT_WEBHOOK"].includes(source);
  for (const key of input.keys())
    if (
      !["source", "status", "cursor", "_trail", "selected"].includes(key) ||
      input.getAll(key).length !== 1
    )
      invalid = true;
  if (status !== null && !["FAILED", "DEAD_LETTER", "PROCESSING"].includes(status))
    invalid = true;
  if (cursor !== null && !jobCursor.safeParse(cursor).success) invalid = true;
  if (input.has("selected") && !jobSelection(input.get("selected"))) invalid = true;
  if (trail !== null) {
    const parts = trail.split(",");
    if (
      !cursor ||
      parts[0] !== "start" ||
      parts.length > 50 ||
      new Set(parts).size !== parts.length ||
      parts.includes(cursor) ||
      parts.slice(1).some((p) => !jobCursor.safeParse(p).success)
    )
      invalid = true;
  }
  const api = new URLSearchParams({ source, limit: "25" });
  if (status) api.set("status", status);
  if (cursor) api.set("cursor", cursor);
  return {
    params,
    source,
    invalid,
    path: invalid ? null : `/admin/operations/jobs?${api}`,
  };
}
export const jobPageParams = inspectionPageParams;
export function parseJobPage(value: unknown, query: URLSearchParams) {
  const page = z
    .object({ items: z.array(queueJob).max(25), nextCursor: jobCursor.optional() })
    .strict()
    .parse(value);
  const keys = new Set<string>();
  for (const [index, row] of page.items.entries()) {
    const key = jobKey(row),
      before = page.items[index - 1];
    if (
      keys.has(key) ||
      row.source !== (query.get("source") ?? "OUTBOX") ||
      (query.has("status") && row.status !== query.get("status"))
    )
      throw Error("Unexpected processing-job scope");
    keys.add(key);
    if (
      before &&
      (Date.parse(before.updatedAt) < Date.parse(row.updatedAt) ||
        (Date.parse(before.updatedAt) === Date.parse(row.updatedAt) &&
          (before.id < row.id || (before.id === row.id && before.source <= row.source))))
    )
      throw Error("Unexpected processing-job ordering");
  }
  if (page.nextCursor && (!page.items.length || page.nextCursor === query.get("cursor")))
    throw Error("Unexpected processing-job cursor");
  return page;
}
export function parseCurrentJob(value: unknown, key: string) {
  const row = currentJobSchema.parse(value);
  if (jobKey(row) !== key) throw Error("Unexpected current job");
  return row;
}
export const jobSnapshot = (row: CurrentJob) =>
  JSON.stringify(currentJobSchema.parse(row));
export function validateJobRetry(value: unknown, before: CurrentJob) {
  const receipt = z
    .object({
      id: uuid,
      source: jobSource,
      status: z.literal("RETRY_REQUESTED"),
      attempts: z.number().int().min(0).max(1000),
    })
    .strict()
    .parse(value);
  if (
    receipt.id !== before.id ||
    receipt.source !== jobSelection(jobKey(before))!.source ||
    receipt.attempts !== jobAttempts(before)
  )
    throw Error("The retry receipt does not match the reviewed job");
  return receipt;
}
