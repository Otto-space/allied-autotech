import { z } from "zod";
import { refundProcessingSchema } from "@/lib/api/refund-processing";
import { refundStatuses } from "@/lib/api/staff-payment-schemas";
import { inspectionPageParams } from "./work-inspections";
const uuid = z.uuid(),
  date = z.iso.datetime({ offset: true });
export const workRefundSchema = refundProcessingSchema
  .extend({
    refundNumber: z.string().min(1).max(50),
    amountKobo: z
      .string()
      .regex(/^\d+$/)
      .refine((v) => BigInt(v) > BigInt(0)),
    providerRefundId: z.string().nullable(),
    policyVersionId: uuid.nullable(),
    requestedAt: date,
    updatedAt: date,
    approvedAt: date.nullable(),
    processedAt: date.nullable(),
    failedAt: date.nullable(),
  })
  .strict();
export const currentRefundSchema = workRefundSchema
  .extend({ cancelledAt: date.nullable(), cancellationNote: z.string().nullable() })
  .strict();
export type WorkRefund = z.infer<typeof workRefundSchema>;
export type CurrentRefund = z.infer<typeof currentRefundSchema>;
export type RefundAction = "decision" | "transfer" | "check";
export const refundStatusLabels = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  PENDING: "Pending",
  PROCESSING: "Processing",
  NEEDS_ATTENTION: "Needs attention",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};
export function parseCurrentRefund(value: unknown, id: string) {
  const row = currentRefundSchema.parse(value);
  if (row.id !== id) throw Error("Refund scope could not be confirmed");
  return row;
}
export function refundQuery(input: URLSearchParams, administrator: boolean) {
  const params = new URLSearchParams();
  let invalid = false;
  const supported = ["status", "cursor", "_trail", "refundId", "expanded"];
  for (const key of input.keys())
    if (!supported.includes(key) || input.getAll(key).length !== 1) invalid = true;
  for (const key of supported) {
    const raw = input.get(key);
    if (raw === null) continue;
    const value = raw.trim();
    const valid =
      key === "status"
        ? (refundStatuses as readonly string[]).includes(value)
        : key === "_trail" || uuid.safeParse(value).success;
    if (!valid) invalid = true;
    else params.set(key, key === "status" ? value : value.toLowerCase());
  }
  const trail = params.get("_trail")?.split(",");
  if (
    trail &&
    (!params.has("cursor") ||
      trail[0] !== "start" ||
      trail.length > 50 ||
      trail.slice(1).some((v) => !uuid.safeParse(v).success) ||
      new Set(trail).size !== trail.length ||
      trail.includes(params.get("cursor")!))
  )
    invalid = true;
  const api = new URLSearchParams(params);
  for (const key of ["_trail", "refundId", "expanded"]) api.delete(key);
  api.set("limit", "25");
  return {
    params,
    invalid,
    path: invalid
      ? null
      : `/${administrator ? "admin/operations/payment-refunds" : "staff/refunds"}?${api}`,
  };
}
export const refundPageParams = inspectionPageParams;
export function parseRefundPage(value: unknown, params: URLSearchParams) {
  const data = z
    .object({ items: z.array(workRefundSchema).max(25), nextCursor: uuid.optional() })
    .strict()
    .parse(value);
  if (
    new Set(data.items.map((v) => v.id)).size !== data.items.length ||
    (data.nextCursor &&
      (data.nextCursor !== data.items.at(-1)?.id ||
        data.nextCursor === params.get("cursor"))) ||
    data.items.some(
      (v, i) =>
        (params.has("status") && v.status !== params.get("status")) ||
        (i > 0 &&
          (Date.parse(data.items[i - 1].requestedAt) < Date.parse(v.requestedAt) ||
            (Date.parse(data.items[i - 1].requestedAt) === Date.parse(v.requestedAt) &&
              data.items[i - 1].id.localeCompare(v.id) <= 0))),
    )
  )
    throw Error("Refund page facts could not be confirmed");
  return data;
}
export function availableRefundAction(
  row: WorkRefund,
  actor: string,
  capabilities: readonly string[],
): RefundAction | undefined {
  if (
    row.status === "REQUESTED" &&
    capabilities.includes("REFUND_APPROVE") &&
    row.requestedByUserId !== actor
  )
    return "decision";
  if (row.paymentAttempt.provider !== "MANUAL" || row.authorizationKind !== "HUMAN")
    return;
  if (
    capabilities.includes("REFUND_TRANSFER") &&
    row.approvedAt &&
    !row.transferredByUserId &&
    ["APPROVED", "NEEDS_ATTENTION"].includes(row.status) &&
    ![row.requestedByUserId, row.approvedByUserId].includes(actor)
  )
    return "transfer";
  if (
    capabilities.includes("REFUND_CHECK") &&
    row.transferredByUserId &&
    (row.status === "PROCESSING" ||
      (row.status === "NEEDS_ATTENTION" &&
        row.providerStatus === "BANK_TRANSFER_DISPUTED")) &&
    ![row.requestedByUserId, row.approvedByUserId, row.transferredByUserId].includes(
      actor,
    )
  )
    return "check";
}
export function refundSnapshot(row: CurrentRefund) {
  return JSON.stringify(currentRefundSchema.parse(row));
}
export function refundHandlingMessage(row: WorkRefund) {
  if (["SUCCEEDED", "CANCELLED", "FAILED"].includes(row.status))
    return "No further action is available for this refund here.";
  if (row.status === "REQUESTED")
    return "An authorized operator other than the requester must approve or cancel this refund.";
  if (row.paymentAttempt.provider !== "MANUAL" || row.authorizationKind !== "HUMAN")
    return "Provider processing is handled separately. Reconcile its current outcome before any replacement request.";
  if (row.transferredByUserId)
    return "An independent authorized checker must verify this transfer.";
  if (row.approvedAt)
    return "An authorized transfer operator other than the requester and approver must record the bank transfer.";
  return "An authorized independent operator is required for the next step. Your current permissions do not allow that action.";
}
export function validateRefundDecision(
  value: unknown,
  before: CurrentRefund,
  body: { decision: "APPROVED" | "CANCELLED"; note?: string },
  actor: string,
) {
  const saved = parseCurrentRefund(value, before.id);
  const immutable = [
    "id",
    "refundNumber",
    "paymentAttemptId",
    "amountKobo",
    "currency",
    "reason",
    "requestedByUserId",
    "requestedAt",
    "authorizationKind",
    "policyVersionId",
    "transferredByUserId",
    "transferRecordedAt",
    "bankTransferAt",
    "checkedByUserId",
    "checkedAt",
  ] as const;
  if (
    before.status !== "REQUESTED" ||
    actor === before.requestedByUserId ||
    Date.parse(saved.updatedAt) < Date.parse(before.updatedAt) ||
    immutable.some((key) => saved[key] !== before[key]) ||
    saved.paymentAttempt.provider !== before.paymentAttempt.provider ||
    (body.decision === "CANCELLED"
      ? saved.status !== "CANCELLED" ||
        !saved.cancelledAt ||
        Date.parse(saved.cancelledAt) < Date.parse(before.requestedAt) ||
        saved.cancellationNote !== (body.note ?? null) ||
        saved.processedAt !== before.processedAt ||
        saved.failedAt !== before.failedAt ||
        saved.providerRefundId !== before.providerRefundId ||
        saved.approvedAt !== before.approvedAt ||
        saved.approvedByUserId !== before.approvedByUserId
      : ["REQUESTED", "CANCELLED"].includes(saved.status) ||
        saved.approvedByUserId !== actor ||
        !saved.approvedAt ||
        Date.parse(saved.approvedAt) < Date.parse(before.requestedAt) ||
        (saved.status === "SUCCEEDED" && !saved.processedAt) ||
        saved.cancelledAt !== null ||
        saved.cancellationNote !== null)
  )
    throw Error("The refund decision receipt could not be confirmed");
  return saved;
}
