import { z } from "zod";
import type { RequestBody } from "./contracts";
export const profilePhotoSchema = z.object({
  id: z.string().uuid(),
  url: z.string().regex(/^\/api\/v1\/customers\/media\/images\/[0-9a-f-]{36}$/i),
  altText: z.string().nullable(),
  sortOrder: z.number().int(),
  isPrimary: z.boolean(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const profileSchema = z.object({
  profileVersion: z.number().int().nonnegative(),
  mediaVersion: z.number().int().nonnegative(),
  photo: profilePhotoSchema.nullable(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string(),
  user: z.object({ id: z.string().uuid(), email: z.string() }),
});
export const parseProfile = (value: unknown) => profileSchema.parse(value);
const name = z
  .string()
  .trim()
  .min(1, "Enter your name.")
  .max(80)
  .regex(
    /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u,
    "Use letters, spaces, apostrophes or hyphens.",
  );
export const profileFormSchema = z.object({
  firstName: name,
  lastName: name,
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number.")
    .max(32)
    .regex(/^\+?[0-9][0-9 ()-]*$/, "Enter a valid phone number."),
  address: z
    .string()
    .trim()
    .max(250)
    .regex(/^[^\u0000-\u001f\u007f]*$/, "Use a single line without control characters."),
  city: z
    .string()
    .trim()
    .max(100)
    .regex(/^[^\u0000-\u001f\u007f]*$/, "Use a single line without control characters."),
  state: z
    .string()
    .trim()
    .max(100)
    .regex(/^[^\u0000-\u001f\u007f]*$/, "Use a single line without control characters."),
});

export function profileFormValues(profile: z.infer<typeof profileSchema>) {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    address: profile.address ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
  };
}

// Keep the original editing baseline; current reads must not silently rebase a draft.
export function profileChanges(
  profile: z.infer<typeof profileSchema>,
  values: z.infer<typeof profileFormSchema>,
) {
  const changes: Omit<RequestBody<"/customers/profile", "patch">, "expectedVersion"> = {};
  const previous = profileFormValues(profile);
  for (const key of Object.keys(previous) as (keyof typeof values)[])
    if (values[key] !== previous[key]) {
      if (key === "address" || key === "city" || key === "state")
        changes[key] = values[key] || null;
      else changes[key] = values[key];
    }
  return changes;
}
