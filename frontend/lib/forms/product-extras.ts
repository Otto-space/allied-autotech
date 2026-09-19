import { z } from "zod";
const singleLine = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .refine(
      (value) =>
        [...value].every((character) => {
          const code = character.codePointAt(0) ?? 0;
          return code > 31 && code !== 127;
        }),
      "Use a single line without control characters.",
    );
const optionalYear = z.union([
  z.literal(""),
  z
    .string()
    .regex(/^\d{4}$/, "Enter a four-digit year.")
    .refine(
      (value) => Number(value) >= 1886 && Number(value) <= 2100,
      "Use a year from 1886 to 2100.",
    ),
]);
export const compatibilityFormSchema = z
  .object({
    make: singleLine(100).refine(Boolean, "Enter the vehicle make."),
    model: singleLine(100),
    yearFrom: optionalYear,
    yearTo: optionalYear,
    notes: singleLine(1000),
  })
  .superRefine((value, context) => {
    if (value.yearFrom && value.yearTo && Number(value.yearFrom) > Number(value.yearTo))
      context.addIssue({
        code: "custom",
        path: ["yearTo"],
        message: "The final year must be on or after the first year.",
      });
  });
export type CompatibilityValues = z.infer<typeof compatibilityFormSchema>;
export const imageFormSchema = z.object({
  url: singleLine(2048)
    .pipe(z.url("Enter a valid image URL."))
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "Use a public HTTPS URL without credentials."),
  altText: singleLine(250),
  sortOrder: z
    .string()
    .regex(/^\d+$/, "Enter a whole number.")
    .refine((value) => Number(value) <= 10000, "Use a sort position from 0 to 10000."),
  isPrimary: z.boolean(),
});
export type ProductImageValues = z.infer<typeof imageFormSchema>;
export const compatibilityBody = (value: CompatibilityValues) => ({
  make: value.make,
  model: value.model || null,
  yearFrom: value.yearFrom ? Number(value.yearFrom) : null,
  yearTo: value.yearTo ? Number(value.yearTo) : null,
  notes: value.notes || null,
});
export const imageBody = (value: ProductImageValues) => ({
  url: value.url,
  altText: value.altText || null,
  sortOrder: Number(value.sortOrder),
  isPrimary: value.isPrimary,
});
