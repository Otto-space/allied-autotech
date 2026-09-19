import { z } from "zod";
import { auditActions, auditEntities, type AuditQuery } from "@/lib/api/audit-schemas";
import { lagosDateTime } from "./vehicle-condition";
const optionalDate = z.union([z.literal(""), lagosDateTime]);
export const auditFilterSchema = z
  .object({
    userId: z.union([
      z.literal(""),
      z.string().trim().uuid("Enter a valid user reference."),
    ]),
    action: z.enum(["", ...auditActions]),
    entityType: z.enum(["", ...auditEntities]),
    entityId: z.string().trim().max(120),
    requestId: z.string().trim().max(100),
    from: optionalDate,
    to: optionalDate,
  })
  .superRefine((value, context) => {
    if (!value.from || !value.to) return;
    const difference =
      Date.parse(`${value.to}:00+01:00`) - Date.parse(`${value.from}:00+01:00`);
    if (difference < 0)
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Choose an end time on or after the start time.",
      });
    if (difference > 90 * 86400000)
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Keep a date range within 90 days.",
      });
  });
export type AuditFilters = z.infer<typeof auditFilterSchema>;
export const emptyAuditFilters: AuditFilters = {
  userId: "",
  action: "",
  entityType: "",
  entityId: "",
  requestId: "",
  from: "",
  to: "",
};
export function auditQuery(value: AuditFilters): AuditQuery {
  return {
    limit: 25,
    ...(value.userId && { userId: value.userId }),
    ...(value.action && { action: value.action }),
    ...(value.entityType && { entityType: value.entityType }),
    ...(value.entityId && { entityId: value.entityId }),
    ...(value.requestId && { requestId: value.requestId }),
    ...(value.from && { from: `${value.from}:00+01:00` }),
    ...(value.to && { to: `${value.to}:00+01:00` }),
  };
}
