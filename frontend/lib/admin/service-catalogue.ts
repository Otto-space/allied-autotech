import { z } from "zod";
import { nairaToKobo } from "@/lib/format/currency-input";

const uuid = z.uuid();
const category = z.object({
  id: uuid,
  name: z.string().min(1).max(120),
  slug: z.string().max(120),
});
const image = z.object({
  id: uuid,
  url: z.string(),
  altText: z.string().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const adminServiceSchema = z
  .object({
    id: uuid,
    name: z.string().min(1).max(160),
    slug: z.string().min(2).max(120),
    categoryId: uuid.nullable(),
    category: category.nullable(),
    image: image.nullable(),
    shortDescription: z.string().max(500).nullable(),
    description: z.string().max(10000).nullable(),
    pricingType: z.enum(["FIXED", "QUOTE_REQUIRED"]),
    priceKobo: z
      .string()
      .regex(/^(?:0|[1-9][0-9]{0,15})$/)
      .nullable(),
    currency: z.literal("NGN"),
    durationMinutes: z.number().int().min(15).max(1440).nullable(),
    isActive: z.boolean(),
    version: z.number().int().nonnegative().max(2147483647),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .refine((r) => (r.category?.id ?? null) === r.categoryId, "Invalid category identity")
  .refine(
    (r) =>
      !r.image ||
      r.image.url === `/api/v1/admin/services/${r.id}/images/${r.image.id}/content`,
    "Invalid image identity",
  );
export type AdminService = z.infer<typeof adminServiceSchema>;
export const parseAdminService = (value: unknown) => adminServiceSchema.parse(value);
export const parseAdminServices = (value: unknown) =>
  z
    .object({ items: z.array(adminServiceSchema).max(25), nextCursor: uuid.optional() })
    .refine(
      (page) => new Set(page.items.map((r) => r.id)).size === page.items.length,
      "Duplicate services",
    )
    .parse(value);
export const parseAdminServiceCategories = (value: unknown) =>
  z
    .object({
      items: z.array(category.extend({ isActive: z.boolean() })).max(100),
      nextCursor: z
        .string()
        .regex(/^[A-Za-z0-9_-]{1,1024}$/)
        .optional(),
    })
    .parse(value);

export function adminServiceQuery(input: URLSearchParams) {
  const params = new URLSearchParams(),
    api = new URLSearchParams({ limit: "25" });
  let invalid = false;
  for (const key of [
    "search",
    "isActive",
    "pricingType",
    "categoryId",
    "cursor",
    "_trail",
  ])
    if (input.getAll(key).length > 1) invalid = true;
  const search = input.get("search")?.trim();
  if (search) {
    if (search.length < 2 || search.length > 100 || /[\u0000-\u001f\u007f]/.test(search))
      invalid = true;
    else {
      params.set("search", search);
      api.set("search", search);
    }
  }
  for (const [key, values] of [
    ["isActive", ["true", "false"]],
    ["pricingType", ["FIXED", "QUOTE_REQUIRED"]],
  ] as const) {
    const value = input.get(key);
    if (value) {
      if (!(values as readonly string[]).includes(value)) invalid = true;
      else {
        params.set(key, value);
        api.set(key, value);
      }
    }
  }
  for (const key of ["categoryId", "cursor"]) {
    const value = input.get(key);
    if (value) {
      if (!uuid.safeParse(value).success) invalid = true;
      else {
        params.set(key, value);
        api.set(key, value);
      }
    }
  }
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length &&
    trail.length <= 50 &&
    trail[0] === "start" &&
    trail.slice(1).every((v) => uuid.safeParse(v).success)
  )
    params.set("_trail", trail.join(","));
  return { params, api, invalid, path: invalid ? null : `/admin/services?${api}` };
}

const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .max(max)
    .refine(
      (v) => !/[\u0000-\u001f\u007f]/.test(v),
      "Remove unsupported control characters.",
    );
export const serviceFormSchema = z
  .object({
    name: text(160, "a service name"),
    slug: text(120, "a URL name")
      .min(2)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."),
    categoryId: z.union([z.literal(""), uuid]),
    shortDescription: z
      .string()
      .trim()
      .max(500)
      .refine(
        (v) => !/[\u0000-\u001f\u007f]/.test(v),
        "Remove unsupported control characters.",
      ),
    description: z
      .string()
      .trim()
      .max(10000)
      .refine(
        (v) => !/[\u0000-\u001f\u007f]/.test(v),
        "Remove unsupported control characters.",
      ),
    pricingType: z
      .enum(["", "FIXED", "QUOTE_REQUIRED"])
      .refine((v) => v !== "", "Choose a pricing type."),
    price: z
      .string()
      .trim()
      .refine((v) => {
        if (!v) return true;
        try {
          return nairaToKobo(v).length <= 16;
        } catch {
          return false;
        }
      }, "Enter a valid amount with up to two decimal places, within the service price limit."),
    duration: z
      .string()
      .trim()
      .refine(
        (v) => /^\d+$/.test(v) && Number(v) >= 15 && Number(v) <= 1440,
        "Enter a whole duration from 15 to 1440 minutes.",
      ),
    isActive: z.boolean(),
  })
  .refine((v) => v.pricingType !== "FIXED" || !!v.price, {
    path: ["price"],
    message: "Enter a price for a fixed-price service.",
  });
export type ServiceFormValues = z.infer<typeof serviceFormSchema>;
