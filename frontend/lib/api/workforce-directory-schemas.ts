import { z } from "zod";
import { workforceTemplateSchema } from "./workforce-schemas";

export const workforcePositionSchema = z.enum([
  "CEO_MD",
  ...workforceTemplateSchema.options,
]);
export const workforceDirectoryQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .refine(
      (value) => ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
    )
    .optional(),
  role: z.enum(["STAFF", "ADMIN", "SUPER_ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
  position: workforcePositionSchema.optional(),
  branchId: z.uuid().optional(),
  cursor: z.uuid().optional(),
});
const directorySchema = z.object({
  items: z.array(
    z.object({
      userId: z.uuid(),
      name: z.string(),
      email: z.string(),
      role: z.enum(["STAFF", "ADMIN", "SUPER_ADMIN"]),
      status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
      verified: z.boolean(),
      managed: z.boolean(),
      position: workforcePositionSchema.nullable(),
      version: z.number().int().nonnegative().nullable(),
      accountBranch: z
        .object({ id: z.uuid(), name: z.string(), isActive: z.boolean() })
        .nullable(),
      responsibilities: z.array(
        z.object({
          assignmentId: z.uuid(),
          template: workforceTemplateSchema,
          branch: z.object({ id: z.uuid(), name: z.string() }),
          scope: z.enum(["BRANCH", "ASSIGNED"]),
          temporary: z.boolean(),
          expiresAt: z.iso.datetime().nullable(),
        }),
      ),
      canInspect: z.boolean(),
      responsibilitiesMore: z.boolean(),
    }),
  ),
  nextCursor: z.uuid().optional(),
  generatedAt: z.iso.datetime(),
});
export const parseWorkforceDirectory = (value: unknown) => directorySchema.parse(value);
export type WorkforceDirectory = z.infer<typeof directorySchema>;
