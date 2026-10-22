import { z } from "zod";
import {
  disputeSchema,
  disputeCategories,
  disputeStatuses,
} from "@/lib/api/operations-schemas";
import { inspectionPageParams } from "./work-inspections";
const date = z.iso.datetime({ offset: true }),
  uuid = z.uuid();
export const overviewDisputeSchema = disputeSchema
  .extend({
    openedAt: date,
    updatedAt: date,
    responseDueAt: date.nullable(),
    respondedAt: date.nullable(),
    resolvedAt: date.nullable(),
    providerUpdatedAt: date.nullable().default(null),
  })
  .strict();
export type OverviewDispute = z.infer<typeof overviewDisputeSchema>;
export const disputeLabels = {
  AWAITING_RESPONSE: "Awaiting response",
  UNDER_REVIEW: "Under review",
  WON: "Won",
  LOST: "Lost",
  ACCEPTED: "Accepted",
  EXPIRED: "Expired",
  NOT_RECOGNIZED: "Not recognized",
  FRAUD: "Fraud",
  NOT_RECEIVED: "Not received",
  NOT_AS_DESCRIBED: "Not as described",
  DUPLICATE_CHARGE: "Duplicate charge",
  REFUND_NOT_RECEIVED: "Refund not received",
  OTHER: "Other",
};
export function disputeOverviewQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const key of input.keys())
    if (
      !["status", "category", "cursor", "_trail", "expanded"].includes(key) ||
      input.getAll(key).length !== 1
    )
      invalid = true;
  for (const key of ["status", "category", "cursor", "expanded"]) {
    const value = input.get(key);
    if (value === null) continue;
    const valid =
      key === "status"
        ? (disputeStatuses as readonly string[]).includes(value)
        : key === "category"
          ? (disputeCategories as readonly string[]).includes(value)
          : uuid.safeParse(value).success;
    if (!valid) invalid = true;
    else
      params.set(
        key,
        key === "status" || key === "category" ? value : value.toLowerCase(),
      );
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
  api.delete("expanded");
  api.delete("_trail");
  api.set("limit", "25");
  return {
    params,
    invalid,
    path: invalid ? null : `/admin/operations/payment-disputes?${api}`,
  };
}
export const disputeOverviewPageParams = inspectionPageParams;
export function parseDisputeOverviewPage(value: unknown, query: URLSearchParams) {
  const page = z
    .object({
      items: z.array(overviewDisputeSchema).max(25),
      nextCursor: uuid.optional(),
    })
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
        (query.has("category") && v.category !== query.get("category")) ||
        (i > 0 &&
          (Date.parse(page.items[i - 1].openedAt) < Date.parse(v.openedAt) ||
            (page.items[i - 1].openedAt === v.openedAt &&
              page.items[i - 1].id.localeCompare(v.id) <= 0))),
    )
  )
    throw Error("Dispute overview scope could not be confirmed");
  return page;
}
