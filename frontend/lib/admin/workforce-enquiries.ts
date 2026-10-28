import { supportEmailDeliveryPageSchema } from "../api/support-email-schemas";
import { z } from "zod";
import { workforceAccessSchema, type WorkforceAccess } from "../api/workforce-schemas";
import { workforceAllows, workforceActionPredicates } from "../workforce-registry";
import {
  careCaseAllows,
  currentWorkforceAssignment as activeAssignment,
} from "../workforce-care";
import { sameWorkforceScope } from "./workforce-overview";
export { inspectionPageParams as workforceEnquiriesPageParams } from "./work-inspections";

export const enquiryTypeLabels = {
  GENERAL: "General",
  PRODUCT: "Product",
  VEHICLE: "Vehicle",
  SERVICE: "Service",
  BOOKING: "Booking",
  QUOTATION: "Quotation",
} as const;
export const enquiryStatusLabels = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
} as const;
const enquiryType = z.enum([
  "GENERAL",
  "PRODUCT",
  "VEHICLE",
  "SERVICE",
  "BOOKING",
  "QUOTATION",
]);
const enquiryStatus = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const accessSchema = workforceAccessSchema.safeExtend({ managed: z.literal(true) });
const personSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
});
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
  assignedStaffId: z.uuid().nullable(),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  assignedStaff: personSchema.nullable(),
  subject: z.string(),
  message: z.string(),
  type: enquiryType,
  vehicleEnquiryIntent: z.enum(["LISTING", "REQUIREMENTS"]).nullable().optional(),
  status: enquiryStatus,
  version: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const messageSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["LEGACY", "REPLY", "STATUS_CHANGE"]).optional(),
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
  access: accessSchema,
  generatedAt: z.iso.datetime(),
  latestMessageId: z.uuid().nullable(),
  messages: z.object({
    items: z.array(messageSchema).max(25),
    nextCursor: z.uuid().optional(),
  }),
});
export type WorkforceEnquiry = z.infer<typeof detailSchema>;
export type WorkforceEnquiryRow = z.infer<typeof rowSchema>;
export type WorkforceEnquiryCandidate = z.infer<typeof personSchema>;

export function workforceEnquiriesQuery(input: URLSearchParams) {
  const allowed = [
    "q",
    "type",
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
    type = input.get("type") ?? "",
    status = input.get("status") ?? "";
  if (
    q.length > 120 ||
    [...q].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    (type && !Object.hasOwn(enquiryTypeLabels, type)) ||
    (status && !Object.hasOwn(enquiryStatusLabels, status))
  )
    invalid = true;
  if (q) params.set("q", q);
  if (type) params.set("type", type);
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
  return { params, invalid, path: invalid ? null : `/staff/workforce/enquiries?${api}` };
}
export const enquiriesHref = (params: URLSearchParams) =>
  `/admin/workforce/enquiries${params.size ? `?${params}` : ""}`;

export function enquiryContactInScope(
  row: Pick<WorkforceEnquiryRow, "branchId">,
  access: WorkforceAccess,
) {
  return careCaseAllows(access, "ENQUIRY", "view", row);
}
function salesInScope(row: WorkforceEnquiryRow, access: WorkforceAccess) {
  return (
    ["PRODUCT", "VEHICLE"].includes(row.type) &&
    workforceAllows(access, { all: ["SALES_ENQUIRIES"], scope: "responsibility" }, row) &&
    access.assignments.some(
      (a) =>
        activeAssignment(a, access) &&
        a.branchId === row.branchId &&
        ((a.template === "SALES_SUPERVISOR" && a.scope === "BRANCH") ||
          (a.template === "SALES_CASHIER" &&
            a.scope === "ASSIGNED" &&
            access.staffId !== null &&
            row.assignedStaffId === access.staffId)),
    )
  );
}
export function enquiryInScope(row: WorkforceEnquiryRow, access: WorkforceAccess) {
  if (
    !access.managed ||
    row.branch?.id !== row.branchId ||
    (row.assignedStaff?.id ?? null) !== row.assignedStaffId ||
    (row.contact !== undefined && !enquiryContactInScope(row, access))
  )
    return false;
  return careCaseAllows(access, "ENQUIRY", "view", row) || salesInScope(row, access);
}
export function canReplyEnquiry(row: WorkforceEnquiryRow, access: WorkforceAccess) {
  return (
    enquiryInScope(row, access) &&
    ["OPEN", "IN_PROGRESS"].includes(row.status) &&
    (careCaseAllows(access, "ENQUIRY", "reply", row) || salesInScope(row, access))
  );
}

function validPage(items: { id: string }[], nextCursor?: string) {
  return (
    new Set(items.map((item) => item.id)).size === items.length &&
    (!nextCursor || (items.length === 25 && nextCursor === items.at(-1)?.id))
  );
}
export function parseScopedWorkforceEnquiries(value: unknown) {
  const data = z
    .object({
      items: z.array(rowSchema).max(25),
      nextCursor: z.uuid().optional(),
      access: accessSchema,
      generatedAt: z.iso.datetime(),
    })
    .parse(value);
  if (
    !data.access.permissions.some(
      (p) =>
        p === "CUSTOMER_ENQUIRIES" || p === "SALES_ENQUIRIES" || p === "CARE_CASE_VIEW",
    ) ||
    !validPage(data.items, data.nextCursor) ||
    data.items.some((row) => !enquiryInScope(row, data.access))
  )
    throw Error("Enquiries do not match current responsibilities");
  return data;
}
export function parseWorkforceEnquiry(value: unknown) {
  const data = detailSchema.parse(value);
  if (
    !enquiryInScope(data, data.access) ||
    !validPage(data.messages.items, data.messages.nextCursor)
  )
    throw Error("Enquiry does not match current responsibilities");
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
export function canAssignEnquiry(row: WorkforceEnquiryRow, access: WorkforceAccess) {
  return (
    enquiryInScope(row, access) &&
    ["OPEN", "IN_PROGRESS"].includes(row.status) &&
    (careCaseAllows(access, "ENQUIRY", "assign", row) ||
      (salesInScope(row, access) &&
        workforceAllows(access, workforceActionPredicates.enquiryAssign, row) &&
        access.assignments.some(
          (a) =>
            activeAssignment(a, access) &&
            a.template === "SALES_SUPERVISOR" &&
            a.scope === "BRANCH" &&
            a.branchId === row.branchId,
        )))
  );
}

export function parseWorkforceEnquiryCandidates(value: unknown) {
  const data = z
    .object({
      items: z.array(personSchema).max(25),
      nextCursor: z.uuid().optional(),
      enquiryId: z.uuid(),
      enquiryVersion: z.number().int().nonnegative(),
      branchId: z.uuid(),
      access: accessSchema,
      generatedAt: z.iso.datetime(),
    })
    .parse(value);
  if (
    !validPage(data.items, data.nextCursor) ||
    !(
      careCaseAllows(data.access, "ENQUIRY", "assign", { branchId: data.branchId }) ||
      (data.access.permissions.includes("ENQUIRIES_ASSIGN") &&
        data.access.assignments.some(
          (a) =>
            activeAssignment(a, data.access) &&
            a.template === "SALES_SUPERVISOR" &&
            a.scope === "BRANCH" &&
            a.branchId === data.branchId,
        ))
    )
  )
    throw Error("Eligible staff do not match current responsibilities");
  return data;
}
export const enquiryRevision = (row: WorkforceEnquiry) =>
  JSON.stringify([row.id, row.version, row.updatedAt, row.latestMessageId]);
export const enquiryStaffName = (person: WorkforceEnquiryCandidate | null) =>
  person ? [person.firstName, person.lastName].filter(Boolean).join(" ") : "Unassigned";

export type EnquiryChange =
  | {
      action: "reply";
      body: {
        expectedVersion: number;
        expectedLatestMessageId: string | null;
        body: string;
      };
    }
  | {
      action: "assignment";
      body: { expectedVersion: number; staffId: string; reason: string };
    };

export function validateEnquiryReceipt(
  value: unknown,
  base: WorkforceEnquiry,
  change: EnquiryChange,
) {
  const common = z
    .object({
      id: z.uuid(),
      version: z.number().int(),
      branchId: z.uuid(),
      actorUserId: z.uuid(),
      action: z.enum(["reply", "assignment"]),
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
    !enquiryInScope(base, common.access) ||
    !(change.action === "reply"
      ? canReplyEnquiry(base, common.access)
      : canAssignEnquiry(base, common.access))
  )
    throw Error("The change receipt could not be verified");
  if (change.action === "reply") {
    const { messageReceipt: receipt } = z
      .object({
        messageReceipt: messageSchema
          .omit({ isOwn: true })
          .extend({ enquiryId: z.uuid() }),
      })
      .parse(value);
    if (
      receipt.enquiryId !== base.id ||
      receipt.authorType !== "STAFF" ||
      receipt.body !== change.body.body
    )
      throw Error("The reply receipt could not be verified");
  } else {
    const { assignmentReceipt: receipt } = z
      .object({
        assignmentReceipt: z.object({
          staffId: z.uuid(),
          previousStaffId: z.uuid().nullable(),
          reason: z.string(),
        }),
      })
      .parse(value);
    if (
      receipt.staffId !== change.body.staffId ||
      receipt.previousStaffId !== base.assignedStaffId ||
      receipt.reason !== change.body.reason
    )
      throw Error("The assignment receipt could not be verified");
  }
  return common;
}
