import { z } from "zod";
export const profileSchema = z.object({
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
  address: z.string().trim().max(250),
  city: z.string().trim().max(100),
  state: z.string().trim().max(100),
});
