import { z } from "zod";
import type { paths } from "./generated";
export type AuditQuery = NonNullable<paths["/admin/audit"]["get"]["parameters"]["query"]>;
export const auditActions = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "READ",
  "LOGIN",
  "LOGOUT",
  "PASSWORD_RESET",
  "EMAIL_VERIFIED",
  "MFA_ENABLED",
  "MFA_DISABLED",
  "SESSION_REVOKED",
  "ROLE_CHANGE",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_DEACTIVATED",
  "STATUS_CHANGE",
  "INVENTORY_ADJUSTED",
  "PAYMENT_INITIALIZED",
  "PAYMENT_VERIFIED",
  "MANUAL_PAYMENT_APPROVED",
  "REFUND_REQUESTED",
  "REFUND_APPROVED",
  "PAYMENT_REFUNDED",
  "DISPUTE_UPDATED",
  "VEHICLE_RESERVED",
  "VEHICLE_RELEASED",
  "INVITATION_CREATED",
  "INVITATION_ACCEPTED",
  "BRANCH_ASSIGNED",
] as const satisfies readonly AuditQuery["action"][];
export const auditEntities = [
  "USER",
  "BRANCH",
  "PRIVILEGED_INVITATION",
  "SESSION",
  "MFA_FACTOR",
  "CUSTOMER_PROFILE",
  "STAFF_PROFILE",
  "CUSTOMER_VEHICLE",
  "SERVICE",
  "BOOKING",
  "QUOTE",
  "WORK_ORDER",
  "PRODUCT",
  "INVENTORY",
  "ORDER",
  "PAYMENT",
  "PAYMENT_ATTEMPT",
  "REFUND",
  "DISPUTE",
  "VEHICLE",
  "VEHICLE_LISTING",
  "VEHICLE_TRANSACTION",
  "INSPECTION",
  "REVIEW",
  "ENQUIRY",
  "COMPLAINT",
  "PROMOTION",
  "INVOICE",
] as const satisfies readonly AuditQuery["entityType"][];
export const auditEventSchema = z.object({
  id: z.uuid(),
  userId: z.uuid().nullable(),
  action: z.enum(auditActions),
  entityType: z.enum(auditEntities),
  entityId: z.string().nullable(),
  requestId: z.string().nullable(),
  oldValues: z.json(),
  newValues: z.json(),
  createdAt: z.iso.datetime({ offset: true }),
  user: z
    .object({ role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) })
    .nullable(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;
export const parseAuditEvents = (value: unknown) =>
  z
    .object({ items: z.array(auditEventSchema), nextCursor: z.uuid().optional() })
    .parse(value);
export function currentAuditRecord(event: AuditEvent): string | undefined {
  if (!z.uuid().safeParse(event.entityId).success) return undefined;
  const routes: Partial<Record<AuditEvent["entityType"], string>> = {
    ORDER: "/admin/orders",
    BOOKING: "/admin/bookings",
    INVOICE: "/admin/invoices",
    VEHICLE: "/admin/vehicles",
    VEHICLE_TRANSACTION: "/admin/vehicle-sales",
  };
  const route = routes[event.entityType];
  return route ? `${route}/${event.entityId}` : undefined;
}
