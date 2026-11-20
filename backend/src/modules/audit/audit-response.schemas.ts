import { z } from "zod";
import { auditActionSchema, auditEntityTypeSchema } from "./audit.schemas.js";

// Database constraints permit nullable JSON objects, including nested JSON values.
const values = z.record(z.string(), z.unknown()).nullable();
const currentStaffName = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(500).nullable(),
  role: z.enum(["STAFF", "ADMIN", "SUPER_ADMIN"]),
});
export const auditEventResponseSchema = z
  .object({
    id: z.uuid(),
    userId: z.uuid().nullable(),
    action: auditActionSchema,
    entityType: auditEntityTypeSchema,
    entityId: z.string().nullable(),
    requestId: z.string().nullable(),
    oldValues: values,
    newValues: values,
    createdAt: z.iso.datetime({ offset: true }),
    currentContext: z
      .strictObject({
        actor: currentStaffName.nullable(),
        subject: currentStaffName.nullable(),
        branches: z
          .array(z.strictObject({ id: z.uuid(), name: z.string().min(1) }))
          .max(42),
      })
      .optional()
      .describe(
        "Included only for ACCESS_CHANGES view. Minimal current staff names and roles, not identities at event time; unavailable or ineligible identities are null. Invitation recipients retain existing own/all visibility. No customer profiles or contact/security fields.",
      ),
    user: z
      .object({ role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) })
      .strict()
      .nullable(),
  })
  .strict();
export const auditPageResponseSchema = z
  .object({
    items: z.array(auditEventResponseSchema).max(100),
    nextCursor: z.uuid().optional(),
  })
  .strict();
