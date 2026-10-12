import { z } from "zod";
import { auditActionSchema, auditEntityTypeSchema } from "./audit.schemas.js";

// Database constraints permit nullable JSON objects, including nested JSON values.
const values = z.record(z.string(), z.unknown()).nullable();
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
