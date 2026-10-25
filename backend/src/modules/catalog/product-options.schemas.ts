import { z } from "zod";
import { catalogueCursorSchema } from "../../common/security/catalogue-cursors.js";
import { productDiscoveryQuerySchema } from "./product-discovery.schemas.js";
export const productOptionQuerySchema = z
  .object({
    field: z.enum([
      "brand",
      "family",
      "productType",
      "oilViscosityGrade",
      "packVolumeMl",
    ]),
    scope: z.string().max(6000).default(""),
    search: z
      .string()
      .trim()
      .max(120)
      .refine((v) =>
        [...v].every((c) => (c.codePointAt(0) ?? 0) > 31 && c.codePointAt(0) !== 127),
      )
      .optional(),
    cursor: catalogueCursorSchema.optional(),
    limit: z
      .string()
      .regex(/^(?:[1-9]|[1-4][0-9]|50)$/)
      .default("20")
      .transform(Number),
  })
  .strict()
  .transform((input, context) => {
    const params = new URLSearchParams(input.scope);
    for (const key of ["sort", "cursor", "_trail", "limit"]) params.delete(key);
    if ([...new Set(params.keys())].some((key) => params.getAll(key).length !== 1)) {
      context.addIssue({
        code: "custom",
        path: ["scope"],
        message: "Use each search criterion once",
      });
      return z.NEVER;
    }
    const parsed = productDiscoveryQuerySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) {
      context.addIssue({
        code: "custom",
        path: ["scope"],
        message: "Invalid product search scope",
      });
      return z.NEVER;
    }
    const criteria = parsed.data;
    delete criteria[input.field];
    if (input.field === "family")
      for (const field of [
        "condition",
        "classification",
        "oilViscosityGrade",
        "packVolumeMl",
        "productType",
      ] as const)
        delete criteria[field];
    return {
      field: input.field,
      criteria,
      search: input.search,
      cursor: input.cursor,
      limit: input.limit,
    };
  });
export type ProductOptionQuery = z.infer<typeof productOptionQuerySchema>;
