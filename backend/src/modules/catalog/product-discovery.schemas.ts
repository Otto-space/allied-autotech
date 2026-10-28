import { z } from "zod";
import { validSearch } from "../../common/security/catalogue-search.js";
import { catalogueCursorSchema } from "../../common/security/catalogue-cursors.js";
import {
  productListQueryBase,
  productListQuerySchema,
  checkProductQuery,
} from "./catalog.schemas.js";
import { productResponseSchema } from "./product-media.schemas.js";

const limit = z
  .string()
  .regex(/^(?:[1-9]|[1-4][0-9]|50)$/)
  .default("20")
  .transform(Number);
const kobo = z.string().regex(/^(?:0|[1-9][0-9]{0,15})$/);
export const productDiscoveryQuerySchema = productListQueryBase
  .extend({
    sort: z.enum(["best_match", "newest", "name", "price_asc", "price_desc"]).optional(),
    limit,
    cursor: z.union([z.uuid(), catalogueCursorSchema]).optional(),
    year: z
      .string()
      .regex(/^\d{4}$/)
      .transform(Number)
      .pipe(z.number().int().min(1886).max(2200))
      .optional(),
    minPriceKobo: kobo.optional(),
    maxPriceKobo: kobo.optional(),
    availability: z.enum(["in_stock", "out_of_stock"]).optional(),
  })
  .superRefine(checkProductQuery)
  .refine(
    (q) =>
      q.minPriceKobo === undefined ||
      q.maxPriceKobo === undefined ||
      BigInt(q.minPriceKobo) <= BigInt(q.maxPriceKobo),
    {
      path: ["maxPriceKobo"],
      message: "Must not be below the minimum price",
    },
  )
  .refine((q) => !q.search || validSearch(q.search), {
    path: ["search"],
    message: "Use between 1 and 20 searchable words or codes",
  })
  .transform((q) => ({
    ...q,
    sort:
      q.sort === "best_match" && !q.search
        ? ("newest" as const)
        : (q.sort ?? (q.search ? ("best_match" as const) : ("newest" as const))),
  }));
export type ProductDiscoveryQuery = z.infer<typeof productDiscoveryQuerySchema>;
export const productDiscoveryPageSchema = z.object({
  items: z.array(productResponseSchema).max(50),
  nextCursor: catalogueCursorSchema.optional(),
  totalMatches: z.number().int().nonnegative(),
  verifiedMatches: z.number().int().nonnegative().optional(),
});
export const productFacetQuerySchema = z
  .object({
    field: z.enum(["category", "brand", "make", "model"]),
    categoryId: z.uuid().optional(),
    make: productListQuerySchema.shape.make,
    search: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine(
        (value) =>
          [...value].every((char) => {
            const code = char.codePointAt(0) ?? 0;
            return code > 31 && code !== 127;
          }),
        "Contains invalid characters",
      )
      .optional(),
    cursor: catalogueCursorSchema.optional(),
    limit,
  })
  .strict()
  .superRefine((q, ctx) => {
    if ((q.field === "model") !== (q.make !== undefined))
      ctx.addIssue({
        code: "custom",
        path: ["make"],
        message: "Specify make only when requesting model options",
      });
    if (q.field === "category" && q.categoryId !== undefined)
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Omit categoryId when requesting category options",
      });
  });
export type ProductFacetQuery = z.infer<typeof productFacetQuerySchema>;
export const productFacetPageSchema = z.object({
  items: z
    .array(
      z.object({ value: z.string().min(1).max(120), label: z.string().min(1).max(120) }),
    )
    .max(50),
  nextCursor: catalogueCursorSchema.optional(),
});
