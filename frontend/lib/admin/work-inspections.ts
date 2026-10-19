import { z } from "zod";
import {
  staffInspectionSchema,
  inspectionStatuses,
  type StaffInspection,
} from "../api/staff-inspection-schemas";
import { customerInspectionQuery, inspectionLabels } from "../customer-inspection-query";
import { draftIdentity, draftKey, forgetDraft } from "../forms/drafts";
export { inspectionLabels };
const date = z.iso.datetime({ offset: true }),
  nullableDate = date.nullable();
export const workInspectionSchema = staffInspectionSchema
  .extend({
    customerName: z.string().min(1),
    version: z.number().int().nonnegative(),
    preferredStartAt: date,
    preferredEndAt: nullableDate,
    scheduledStartAt: nullableDate,
    scheduledEndAt: nullableDate,
    confirmedAt: nullableDate,
    completedAt: nullableDate,
    cancelledAt: nullableDate,
    createdAt: date.optional(),
    updatedAt: date.optional(),
    vehicleListing: staffInspectionSchema.shape.vehicleListing.extend({
      status: z.enum(["DRAFT", "AVAILABLE", "RESERVED", "SOLD", "INACTIVE", "ARCHIVED"]),
    }),
  })
  .superRefine((row, ctx) => {
    if (
      row.preferredEndAt &&
      Date.parse(row.preferredEndAt) <= Date.parse(row.preferredStartAt)
    )
      ctx.addIssue({ code: "custom", message: "Invalid preference interval" });
    if (
      (row.scheduledStartAt === null) !== (row.scheduledEndAt === null) ||
      (row.scheduledStartAt &&
        row.scheduledEndAt &&
        Date.parse(row.scheduledEndAt) <= Date.parse(row.scheduledStartAt))
    )
      ctx.addIssue({ code: "custom", message: "Invalid scheduled interval" });
    if (row.assignedStaffId !== (row.assignedStaff?.id ?? null))
      ctx.addIssue({ code: "custom", message: "Invalid staff assignment" });
  });
export type WorkInspection = z.infer<typeof workInspectionSchema>;
export function parseWorkInspections(
  value: unknown,
  branchId?: string | null,
  params = new URLSearchParams(),
) {
  const data = z
    .object({
      items: z.array(workInspectionSchema).max(25),
      nextCursor: z.uuid().optional(),
    })
    .parse(value);
  if (
    new Set(data.items.map((row) => row.id)).size !== data.items.length ||
    data.items.some(
      (row) =>
        (branchId && row.vehicleListing.branchId !== branchId) ||
        (params.has("branchId") &&
          row.vehicleListing.branchId !== params.get("branchId")) ||
        (params.has("status") && row.status !== params.get("status")),
    )
  )
    throw Error("Unexpected inspection scope");
  return data;
}
export function workInspectionsQuery(
  input: URLSearchParams,
  role: string,
  branchId?: string | null,
) {
  let invalid = false;
  const supported = ["status", "branchId", "cursor", "_trail"];
  for (const key of input.keys())
    if (!supported.includes(key) || input.getAll(key).length !== 1) invalid = true;
  const shared = new URLSearchParams(input);
  shared.delete("branchId");
  shared.set("limit", "20");
  const parsed = customerInspectionQuery(shared),
    params = new URLSearchParams(parsed.params);
  params.delete("limit");
  invalid ||= parsed.invalid;
  const branch = input.get("branchId");
  if (branch) {
    if (!z.uuid().safeParse(branch).success || (role === "STAFF" && branch !== branchId))
      invalid = true;
    else params.set("branchId", branch);
  }
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.set("limit", "25");
  return {
    params,
    api,
    invalid,
    path: invalid ? null : `/staff/vehicle-inspections?${api}`,
  };
}
export function inspectionPageParams(
  params: URLSearchParams,
  nextCursor?: string,
  previous = false,
) {
  const next = new URLSearchParams(params),
    trail = params.get("_trail")?.split(",") ?? [];
  if (previous) {
    const prior = trail.pop();
    if (prior && prior !== "start") next.set("cursor", prior);
    else next.delete("cursor");
  } else {
    if (!nextCursor) return next;
    trail.push(params.get("cursor") ?? "start");
    next.set("cursor", nextCursor);
  }
  if (trail.length && trail.length <= 50 && trail[0] === "start")
    next.set("_trail", trail.join(","));
  else next.delete("_trail");
  return next;
}
export function inspectionSnapshot(row: StaffInspection) {
  return JSON.stringify([
    row.id,
    row.version,
    row.status,
    row.vehicleListing,
    row.customerName,
    row.preferredStartAt,
    row.preferredEndAt,
    row.scheduledStartAt,
    row.scheduledEndAt,
    row.assignedStaffId,
    row.assignedStaff,
    row.cancellationReason,
  ]);
}
export type InspectionChange = {
  id: string;
  expectedVersion: number;
  body: Record<string, unknown>;
};
export function validateInspectionReceipt(
  result: unknown,
  before: WorkInspection,
  body: Record<string, unknown>,
  ownStaffId?: string | null,
) {
  const raw = z
    .object({ success: z.literal(true), data: workInspectionSchema })
    .parse(result).data;
  if (
    raw.id !== before.id ||
    raw.version !== before.version + 1 ||
    raw.status !== body.status ||
    raw.vehicleListing.id !== before.vehicleListing.id ||
    raw.vehicleListing.branchId !== before.vehicleListing.branchId ||
    raw.customerName !== before.customerName
  )
    throw Error("Unexpected inspection receipt");
  for (const key of ["scheduledStartAt", "scheduledEndAt"] as const)
    if (
      body[key] !== undefined &&
      Date.parse(raw[key] ?? "") !== Date.parse(String(body[key]))
    )
      throw Error("Unexpected inspection schedule");
  if (body.reason !== undefined && raw.cancellationReason !== body.reason)
    throw Error("Unexpected inspection cancellation");
  const assignee = ownStaffId ?? body.assignedStaffId ?? before.assignedStaffId;
  if (raw.assignedStaffId !== assignee) throw Error("Unexpected inspection assignee");
  return raw;
}
const prefix = "aat:inspection-change:v1:",
  pending = z
    .object({ token: z.uuid(), id: z.uuid(), version: z.number().int().nonnegative() })
    .strict();
export type InspectionPending = z.infer<typeof pending> | "unknown";
export const inspectionPendingKey = (owner: string, role: string) =>
  `${prefix}${owner}:${role}`;
export function readInspectionPending(
  owner: string,
  role: string,
): InspectionPending | undefined {
  try {
    const raw = sessionStorage.getItem(inspectionPendingKey(owner, role));
    if (raw === null) return;
    if (raw.length > 200) return "unknown";
    return pending.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markInspectionPending(
  owner: string,
  role: string,
  id: string,
  version: number,
) {
  if (
    draftIdentity() !== `${owner}:${role}` ||
    readInspectionPending(owner, role) !== undefined
  )
    throw Error("Inspection recovery unavailable");
  const value = pending.parse({ token: crypto.randomUUID(), id, version }),
    key = inspectionPendingKey(owner, role),
    raw = JSON.stringify(value);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw) throw Error("Inspection recovery unavailable");
  return value;
}
export function clearInspectionPending(owner: string, role: string, token?: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Inspection account changed");
  const stored = readInspectionPending(owner, role);
  if (token && (typeof stored !== "object" || stored.token !== token))
    throw Error("Inspection recovery changed");
  const key = inspectionPendingKey(owner, role);
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null)
    throw Error("Inspection recovery unavailable");
}
export function forgetInspectionDrafts(owner: string, role: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Inspection account changed");
  for (const key of Object.keys(sessionStorage)) {
    if (!key.startsWith("aat:form-draft:v1:")) continue;
    try {
      const parts = JSON.parse(key.slice("aat:form-draft:v1:".length));
      if (parts[0] === `${owner}:${role}` && parts[1] === "/admin/inspections")
        forgetDraft(key);
    } catch {}
  }
}
export function redactInspectionChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
export function forgetInspectionFormDraft(element: HTMLElement) {
  const form = element.closest("form"),
    owner = form
      ?.closest("[data-inspection-owner]")
      ?.getAttribute("data-inspection-owner");
  if (owner && owner === draftIdentity() && form?.dataset.draftKey)
    forgetDraft(draftKey(owner, "/admin/inspections", form.dataset.draftKey));
}
export const isInspectionStatus = (value: string) =>
  inspectionStatuses.some((s) => s === value);
