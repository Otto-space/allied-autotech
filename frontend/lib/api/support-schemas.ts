import { z } from "zod";
export const supportKinds = ["enquiries", "complaints"] as const;
export type SupportKind = (typeof supportKinds)[number];
export const enquiryTypes = [
  "GENERAL",
  "PRODUCT",
  "SERVICE",
  "VEHICLE",
  "BOOKING",
  "QUOTATION",
] as const;
export const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const supportStatuses = {
  enquiries: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  complaints: ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"],
} as const;
const stamp = z.iso.datetime({ offset: true });
const ref = z.uuid().nullable();
const base = z.object({
  id: z.uuid(),
  branchId: ref,
  assignedStaffId: ref,
  subject: z.string(),
  version: z.number().int().nonnegative(),
  createdAt: stamp,
  updatedAt: stamp,
  resolvedAt: stamp.nullable(),
  closedAt: stamp.nullable(),
  branch: z.object({ id: z.uuid(), code: z.string(), name: z.string() }).nullable(),
  assignedStaff: z
    .object({ id: z.uuid(), firstName: z.string(), lastName: z.string() })
    .nullable(),
});
const enquiry = base.extend({
  type: z.enum(enquiryTypes),
  status: z.enum(supportStatuses.enquiries),
  message: z.string(),
  productId: ref,
  serviceId: ref,
  bookingId: ref,
  quoteId: ref,
  vehicleListingId: ref,
});
const complaint = base.extend({
  status: z.enum(supportStatuses.complaints),
  description: z.string(),
  resolution: z.string().nullable(),
  priority: z.enum(priorities),
  bookingId: ref,
  orderId: ref,
  vehicleTransactionId: ref,
});
const contact = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  customerId: ref,
});
export function parseSupportRecord(kind: SupportKind, staff: boolean, value: unknown) {
  const common = { contact: staff ? contact.parse(value) : null };
  if (kind === "enquiries") {
    const record = enquiry.parse(value);
    return { ...record, ...common, kind, text: record.message };
  }
  const record = complaint.parse(value);
  return { ...record, ...common, kind, text: record.description };
}
export type SupportRecord = ReturnType<typeof parseSupportRecord>;
export function parseSupportPage(kind: SupportKind, staff: boolean, value: unknown) {
  const result = z
    .object({ items: z.array(z.unknown()), nextCursor: z.uuid().optional() })
    .parse(value);
  return {
    ...result,
    items: result.items.map((item) => parseSupportRecord(kind, staff, item)),
  };
}
export const supportMessageSchema = z.object({
  id: z.uuid(),
  authorType: z.enum(["CUSTOMER", "STAFF", "SYSTEM"]),
  visibility: z.enum(["CUSTOMER", "INTERNAL"]),
  body: z.string(),
  createdAt: stamp,
});
export function parseSupportMessages(staff: boolean, value: unknown) {
  const result = z
    .object({
      items: z.array(supportMessageSchema),
      cursor: z.uuid().nullable(),
      hasMore: z.boolean(),
      pollAfterMs: z.number().int().positive(),
    })
    .parse(value);
  if (
    (!staff && result.items.some((item) => item.visibility !== "CUSTOMER")) ||
    (result.hasMore && !result.cursor) ||
    (result.items.length > 0 && result.cursor !== result.items.at(-1)?.id)
  )
    throw new Error("Invalid message page");
  return result;
}
export const supportText = (max: number, required = true) =>
  z
    .string()
    .trim()
    .min(required ? 1 : 0, "Enter the required information.")
    .max(max)
    .refine(
      (value) =>
        [...value].every(
          (c) =>
            [9, 10, 13].includes(c.codePointAt(0) ?? 0) || (c.codePointAt(0) ?? 0) > 31,
        ),
      "Remove unsupported control characters.",
    );
export const supportCreateSchema = z.object({
  subject: supportText(160),
  message: supportText(4000),
  name: supportText(120, false),
  email: z.string().trim(),
  phone: z.string().trim().max(32),
});
export function supportCreationSchema(publicMode: boolean) {
  return supportCreateSchema.superRefine((value, context) => {
    if (!publicMode) return;
    if (!value.name)
      context.addIssue({ code: "custom", path: ["name"], message: "Enter your name." });
    if (!z.email().max(254).safeParse(value.email).success)
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Enter a valid email address.",
      });
    if (
      value.phone &&
      (value.phone.length < 7 || !/^\+?[0-9][0-9 ()-]*$/.test(value.phone))
    )
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid phone number.",
      });
  });
}
export const supportReplySchema = z.object({
  message: supportText(4000),
  visibility: z.enum(["CUSTOMER", "INTERNAL"]),
});
export const supportActionSchema = z
  .object({
    action: z.enum(["assignment", "status", "priority"]),
    selection: z.string(),
    note: supportText(4000, false),
    staffId: z.string(),
    unassign: z.boolean(),
  })
  .superRefine((value, context) => {
    if (
      value.action === "assignment" &&
      !value.unassign &&
      !z.uuid().safeParse(value.staffId).success
    )
      context.addIssue({
        code: "custom",
        path: ["staffId"],
        message: "Choose a staff member.",
      });
    if (value.action !== "assignment" && !value.selection)
      context.addIssue({
        code: "custom",
        path: ["selection"],
        message: "Choose a new value.",
      });
    if (value.action === "status" && value.selection === "RESOLVED" && !value.note)
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "Enter a customer-visible resolution.",
      });
  });
export const publicSupportResult = z.object({
  id: z.uuid(),
  status: z.literal("OPEN"),
  createdAt: stamp,
});
export function supportTransitions(record: SupportRecord): string[] {
  if (record.status === "OPEN")
    return [record.kind === "enquiries" ? "IN_PROGRESS" : "INVESTIGATING", "RESOLVED"];
  if (["IN_PROGRESS", "INVESTIGATING"].includes(record.status)) return ["RESOLVED"];
  return record.status === "RESOLVED" ? ["CLOSED"] : [];
}
