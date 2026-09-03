import { z } from "zod";

import { isCommonPassword } from "../../common/security/passwords.js";
import { normalizeEmail } from "../../common/security/session-tokens.js";

const cleanText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) =>
        [...value].every((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return codePoint > 31 && codePoint !== 127;
        }),
      "Contains invalid characters",
    );
const name = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u, "Contains unsupported characters");
const phone = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .regex(/^\+?[0-9][0-9 ()-]*$/, "Enter a valid phone number");
const email = z.email().max(254).transform(normalizeEmail);
const password = z
  .string()
  .min(12)
  .max(128)
  .refine((value) => !isCommonPassword(value), "Choose a less common password");
const cursorPage = {
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
} as const;
const queryBoolean = z.enum(["true", "false"]).transform((value) => value === "true");

const timezone = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid IANA timezone");

const branchFields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/),
  name: cleanText(120),
  phone: phone.nullable().optional(),
  email: email.nullable().optional(),
  address: cleanText(250),
  city: cleanText(100),
  state: cleanText(100),
  country: z.literal("Nigeria").default("Nigeria"),
  timezone: timezone.default("Africa/Lagos"),
  isActive: z.boolean().default(true),
} as const;

export const branchCreateBodySchema = z.object(branchFields).strict();
export const branchUpdateBodySchema = z
  .object({
    code: branchFields.code.optional(),
    name: branchFields.name.optional(),
    phone: branchFields.phone,
    email: branchFields.email,
    address: branchFields.address.optional(),
    city: branchFields.city.optional(),
    state: branchFields.state.optional(),
    country: z.literal("Nigeria").optional(),
    timezone: timezone.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");
export const branchParamsSchema = z.object({ branchId: z.uuid() }).strict();
export const publicBranchListQuerySchema = z
  .object({
    ...cursorPage,
    city: cleanText(100).optional(),
    state: cleanText(100).optional(),
  })
  .strict();
export const adminBranchListQuerySchema = z
  .object({ ...cursorPage, isActive: queryBoolean.optional() })
  .strict();

export const privilegedInvitationBodySchema = z
  .object({
    email,
    role: z.enum(["STAFF", "ADMIN"]),
    branchId: z.uuid().nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.role === "STAFF" && value.branchId == null) {
      context.addIssue({
        code: "custom",
        path: ["branchId"],
        message: "A branch is required for staff",
      });
    }
    if (value.role === "ADMIN" && value.branchId != null) {
      context.addIssue({
        code: "custom",
        path: ["branchId"],
        message: "Administrators are not assigned to a branch",
      });
    }
  });

export const privilegedInvitationAcceptBodySchema = z
  .object({
    token: z.string().min(32).max(512),
    password,
    firstName: name,
    lastName: name,
    phone: phone.optional(),
    jobTitle: cleanText(100).optional(),
  })
  .strict();

export const staffParamsSchema = z.object({ staffUserId: z.uuid() }).strict();
export const staffListQuerySchema = z
  .object({
    ...cursorPage,
    branchId: z.uuid().optional(),
    role: z.enum(["STAFF", "ADMIN", "SUPER_ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
  })
  .strict();
export const staffStatusBodySchema = z
  .object({ status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]) })
  .strict();
export const staffBranchBodySchema = z.object({ branchId: z.uuid() }).strict();
export const staffRoleBodySchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("STAFF"), branchId: z.uuid() }).strict(),
  z.object({ role: z.literal("ADMIN"), branchId: z.null().optional() }).strict(),
]);
export const organizationEmptyQuerySchema = z.object({}).strict().default({});
export const organizationEmptyBodySchema = z.object({}).strict().default({});

export type BranchCreateInput = z.infer<typeof branchCreateBodySchema>;
export type BranchUpdateInput = z.infer<typeof branchUpdateBodySchema>;
export type PublicBranchListQuery = z.infer<typeof publicBranchListQuerySchema>;
export type AdminBranchListQuery = z.infer<typeof adminBranchListQuerySchema>;
export type PrivilegedInvitationInput = z.infer<typeof privilegedInvitationBodySchema>;
export type PrivilegedInvitationAcceptInput = z.infer<
  typeof privilegedInvitationAcceptBodySchema
>;
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;
export type StaffRoleInput = z.infer<typeof staffRoleBodySchema>;
