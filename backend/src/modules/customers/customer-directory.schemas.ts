import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const directoryParamsSchema = z.object({ customerId: z.uuid() }).strict();
export const customerAccountStatusSchema = z
  .object({
    expectedStatus: z.enum(["ACTIVE", "SUSPENDED"]),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict()
  .refine((v) => v.status !== v.expectedStatus, {
    message: "Choose a different account status",
    path: ["status"],
  });
export const directoryListQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(120)
      .transform((v) => v.replace(/\s+/gu, " ").toLowerCase())
      .default(""),
    field: z.enum(["name", "email", "phone", "id"]).default("name"),
    status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
    verified: z.enum(["true", "false"]).optional(),
    sort: z.enum(["newest", "oldest"]).default("newest"),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    cursor: z
      .string()
      .min(1)
      .max(1024)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.search) return;
    const invalid =
      v.field === "id"
        ? !z.uuid().safeParse(v.search).success
        : v.field === "phone"
          ? !/^\+?[0-9 ()-]+$/.test(v.search) || v.search.replace(/\D/g, "").length < 3
          : v.search.length < 2 ||
            [...v.search].some((character) => {
              const code = character.codePointAt(0) ?? 0;
              return code < 32 || code === 127;
            });
    if (invalid)
      ctx.addIssue({
        code: "custom",
        path: ["search"],
        message:
          "Use a full customer ID, at least 3 phone digits, or at least 2 search characters",
      });
  });
export const directoryRelatedQuerySchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();
export const directoryRowSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  createdAt: z.iso.datetime(),
});
export const directoryDetailSchema = directoryRowSchema.extend({
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string(),
});
export const directoryPageSchema = z.object({
  items: z.array(directoryRowSchema),
  nextCursor: z.string().optional(),
});
export const directoryRelatedRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.string().nullable(),
  createdAt: z.iso.datetime(),
  amountKobo: z.string().nullable(),
  currency: z.string().nullable(),
});
export const directoryRelatedPageSchema = z.object({
  items: z.array(directoryRelatedRowSchema),
  nextCursor: z.string().optional(),
});
export const directoryCollections = [
  "vehicles",
  "bookings",
  "quotations",
  "orders",
  "payments",
  "enquiries",
  "complaints",
] as const;
export type DirectoryCollection = (typeof directoryCollections)[number];
export type DirectoryQuery = z.infer<typeof directoryListQuerySchema>;
export type RelatedQuery = z.infer<typeof directoryRelatedQuerySchema>;
export type DirectoryRow = z.infer<typeof directoryRowSchema>;
