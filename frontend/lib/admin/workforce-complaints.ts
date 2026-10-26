import { supportEmailDeliveryPageSchema } from "../api/support-email-schemas";
import { z } from "zod";
import { workforceAccessSchema, type WorkforceAccess } from "../api/workforce-schemas";
import { sameWorkforceScope } from "./workforce-overview";
export { inspectionPageParams as workforceComplaintsPageParams } from "./work-inspections";

export const complaintPriorityLabels = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
} as const;
export const complaintStatusLabels = {
  OPEN: "Open",
  INVESTIGATING: "Investigating",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
} as const;
const complaintPriority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const complaintStatus = z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]);
const accessSchema = workforceAccessSchema.safeExtend({ managed: z.literal(true) });
const rowSchema = z.object({
  contact: z
    .object({
      name: z.string().nullable(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      customerId: z.uuid().nullable(),
    })
    .optional(),
  id: z.uuid(),
  branchId: z.uuid().nullable(),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  subject: z.string(),
  description: z.string(),
  priority: complaintPriority,
  status: complaintStatus,
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const messageSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["LEGACY", "REPLY", "INTERNAL_NOTE", "STATUS_CHANGE"]).optional(),
  fromStatus: z.string().nullable().optional(),
  toStatus: z.string().nullable().optional(),
  authorType: z.enum(["CUSTOMER", "STAFF", "SYSTEM"]),
  visibility: z.literal("CUSTOMER"),
  body: z.string(),
  createdAt: z.iso.datetime(),
  isOwn: z.boolean(),
});
const detailSchema = rowSchema.extend({
  emailDeliveries: supportEmailDeliveryPageSchema.optional(),
  acknowledgedAt: z.iso.datetime().nullable(),
  acknowledgementDueAt: z.iso.datetime().nullable(),
  escalatedAt: z.iso.datetime().nullable(),
  resolution: z.string().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  closedAt: z.iso.datetime().nullable(),
  access: accessSchema,
  generatedAt: z.iso.datetime(),
  latestMessageId: z.uuid().nullable(),
  messages: z.object({
    items: z.array(messageSchema).max(25),
    nextCursor: z.uuid().optional(),
  }),
});
export type WorkforceComplaint = z.infer<typeof detailSchema>;
export type WorkforceComplaintRow = z.infer<typeof rowSchema>;

export function workforceComplaintsQuery(input: URLSearchParams) {
  const allowed = [
    "q",
    "priority",
    "status",
    "cursor",
    "_trail",
    "selected",
    "messageCursor",
    "messageId",
    "_messageTrail",
  ];
  const params = new URLSearchParams();
  let invalid = [...input.keys()].some(
    (key) => !allowed.includes(key) || input.getAll(key).length !== 1,
  );
  const q = (input.get("q") ?? "").trim(),
    priority = input.get("priority") ?? "",
    status = input.get("status") ?? "";
  if (
    q.length > 120 ||
    [...q].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    (priority && !Object.hasOwn(complaintPriorityLabels, priority)) ||
    (status && !Object.hasOwn(complaintStatusLabels, status))
  )
    invalid = true;
  if (q) params.set("q", q);
  if (priority) params.set("priority", priority);
  if (status) params.set("status", status);
  for (const name of ["cursor", "selected", "messageCursor", "messageId"]) {
    const value = input.get(name);
    if (value !== null) {
      if (!z.uuid().safeParse(value).success) invalid = true;
      else params.set(name, value);
    }
  }
  for (const [trailName, cursorName] of [
    ["_trail", "cursor"],
    ["_messageTrail", "messageCursor"],
  ]) {
    const trail = input.get(trailName),
      cursor = input.get(cursorName);
    if (trail !== null) {
      const entries = trail.split(",");
      if (
        !cursor ||
        entries.length > 50 ||
        entries[0] !== "start" ||
        entries.slice(1).some((value) => !z.uuid().safeParse(value).success) ||
        entries.includes(cursor) ||
        new Set(entries).size !== entries.length
      )
        invalid = true;
      else params.set(trailName, trail);
    }
  }
  if (
    (input.has("messageCursor") ||
      input.has("_messageTrail") ||
      input.has("messageId")) &&
    !params.has("selected")
  )
    invalid = true;
  if (params.has("messageId") && params.has("messageCursor")) invalid = true;
  const api = new URLSearchParams(params);
  for (const name of [
    "_trail",
    "selected",
    "messageCursor",
    "_messageTrail",
    "messageId",
  ])
    api.delete(name);
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/staff/workforce/complaints?${api}` };
}
export const complaintsHref = (params: URLSearchParams) =>
  `/admin/workforce/complaints${params.size ? `?${params}` : ""}`;

function activeAssignment(
  assignment: WorkforceAccess["assignments"][number],
  access: WorkforceAccess,
) {
  return (
    assignment.userId === access.userId &&
    assignment.revokedAt === null &&
    Date.parse(assignment.startsAt) <= Date.parse(access.serverTime) &&
    (assignment.expiresAt === null ||
      Date.parse(assignment.expiresAt) > Date.parse(access.serverTime))
  );
}
export function complaintInScope(row: WorkforceComplaintRow, access: WorkforceAccess) {
  return (
    access.managed &&
    access.permissions.includes("COMPLAINTS") &&
    !!row.branchId &&
    row.branch?.id === row.branchId &&
    access.assignments.some(
      (assignment) =>
        activeAssignment(assignment, access) &&
        assignment.branchId === row.branchId &&
        assignment.template === "CUSTOMER_SERVICE" &&
        assignment.scope === "BRANCH",
    )
  );
}
function validPage(items: { id: string }[], nextCursor?: string) {
  return (
    new Set(items.map((item) => item.id)).size === items.length &&
    (!nextCursor || (items.length === 25 && nextCursor === items.at(-1)?.id))
  );
}
export function parseScopedWorkforceComplaints(value: unknown) {
  const data = z
    .object({
      items: z.array(rowSchema).max(25),
      nextCursor: z.uuid().optional(),
      access: accessSchema,
      generatedAt: z.iso.datetime(),
    })
    .parse(value);
  if (
    !data.access.permissions.includes("COMPLAINTS") ||
    !validPage(data.items, data.nextCursor) ||
    data.items.some((row) => !complaintInScope(row, data.access))
  )
    throw Error("Complaints do not match current responsibilities");
  return data;
}
export function parseWorkforceComplaint(value: unknown) {
  const data = detailSchema.parse(value);
  if (
    !complaintInScope(data, data.access) ||
    !validPage(data.messages.items, data.messages.nextCursor)
  )
    throw Error("Complaint does not match current responsibilities");
  for (let i = 1; i < data.messages.items.length; i++) {
    const previous = data.messages.items[i - 1],
      current = data.messages.items[i];
    if (
      Date.parse(previous.createdAt) < Date.parse(current.createdAt) ||
      (previous.createdAt === current.createdAt && previous.id < current.id)
    )
      throw Error("Conversation order is invalid");
  }
  return data;
}
export const complaintRevision = (row: WorkforceComplaint) =>
  JSON.stringify([row.id, row.version, row.updatedAt, row.latestMessageId]);
export type ComplaintChange = {
  action: "reply";
  body: { expectedVersion: number; expectedLatestMessageId: string | null; body: string };
};

export function validateComplaintReceipt(
  value: unknown,
  base: WorkforceComplaint,
  change: ComplaintChange,
) {
  const common = z
    .object({
      id: z.uuid(),
      version: z.number().int(),
      branchId: z.uuid(),
      actorUserId: z.uuid(),
      action: z.literal("reply"),
      access: accessSchema,
      generatedAt: z.iso.datetime(),
    })
    .parse(value);
  if (
    common.id !== base.id ||
    common.version !== base.version + 1 ||
    common.branchId !== base.branchId ||
    common.actorUserId !== base.access.userId ||
    common.action !== change.action ||
    !sameWorkforceScope(base.access, common.access) ||
    !complaintInScope(base, common.access)
  )
    throw Error("The change receipt could not be verified");
  const { messageReceipt: receipt } = z
    .object({
      messageReceipt: messageSchema
        .omit({ isOwn: true })
        .extend({ complaintId: z.uuid() }),
    })
    .parse(value);
  if (
    receipt.complaintId !== base.id ||
    receipt.authorType !== "STAFF" ||
    receipt.body !== change.body.body
  )
    throw Error("The reply receipt could not be verified");
  return common;
}
